import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { query } from '../config/db';

interface RoomSession {
  id: string;
  name: string;
  participants: Set<string>;
}

const activeSessions: Map<string, RoomSession> = new Map();

export const setupSocketHandlers = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // ============ ROOM MANAGEMENT ============
    socket.on('JOIN_ROOM', (data: any) => {
      const { roomName, userId, userName } = data;
      socket.join(roomName);

      if (!activeSessions.has(roomName)) {
        activeSessions.set(roomName, {
          id: roomName,
          name: roomName,
          participants: new Set()
        });
      }

      const session = activeSessions.get(roomName)!;
      session.participants.add(userId);

      io.to(roomName).emit('ROOM_UPDATE', {
        roomName,
        count: session.participants.size,
        participants: Array.from(session.participants)
      });

      logger.info('User joined room', { roomName, userId, userName });
    });

    socket.on('LEAVE_ROOM', (data: any) => {
      const { roomName, userId } = data;
      socket.leave(roomName);

      const session = activeSessions.get(roomName);
      if (session) {
        session.participants.delete(userId);
        if (session.participants.size === 0) {
          activeSessions.delete(roomName);
        } else {
          io.to(roomName).emit('ROOM_UPDATE', {
            roomName,
            count: session.participants.size
          });
        }
      }

      logger.info('User left room', { roomName, userId });
    });

    // ============ RECORDING FEATURE ============
    socket.on('RECORDING_STARTED', async (data: any) => {
      const { roomName, startTime } = data;

      try {
        const result = await query(
          `INSERT INTO session_recordings (session_id, status, started_at, created_at)
           VALUES ($1, $2, $3, NOW()) RETURNING id`,
          [roomName, 'recording', new Date(startTime)]
        );

        const recordingId = result.rows[0].id;
        io.to(roomName).emit('RECORDING_STARTED_NOTIFY', { recordingId });
        logger.info('Recording started', { roomName, recordingId });
      } catch (err) {
        logger.error('Failed to create recording:', err);
      }
    });

    socket.on('RECORDING_FRAMES', async (data: any) => {
      const { roomName, frames } = data;

      try {
        // Get active recording
        const result = await query(
          `SELECT id FROM session_recordings
           WHERE session_id = $1 AND status = 'recording'
           ORDER BY created_at DESC LIMIT 1`,
          [roomName]
        );

        if (result.rows.length > 0) {
          const recordingId = result.rows[0].id;

          // Store frames (would be stored as JSON or in S3)
          await query(
            `UPDATE session_recordings
             SET frames = COALESCE(frames, '[]'::jsonb) || $1
             WHERE id = $2`,
            [JSON.stringify(frames), recordingId]
          );

          io.to(roomName).emit('RECORDING_FRAME_SYNCED');
        }
      } catch (err) {
        logger.error('Failed to store frames:', err);
      }
    });

    socket.on('RECORDING_STOPPED', async (data: any) => {
      const { roomName, duration } = data;

      try {
        await query(
          `UPDATE session_recordings
           SET status = 'completed', ended_at = NOW(), duration = $1
           WHERE session_id = $2 AND status = 'recording'`,
          [duration, roomName]
        );

        const result = await query(
          `SELECT id FROM session_recordings
           WHERE session_id = $1
           ORDER BY created_at DESC LIMIT 1`,
          [roomName]
        );

        const recordingId = result.rows[0]?.id;
        socket.emit('RECORDING_SAVED', { recordingId });
        io.to(roomName).emit('RECORDING_COMPLETED', { recordingId });

        logger.info('Recording stopped', { roomName, recordingId, duration });
      } catch (err) {
        logger.error('Failed to stop recording:', err);
      }
    });

    // ============ TERMINAL FEATURE ============
    socket.on('TERMINAL_START', (data: any) => {
      const { roomName, terminalName, shellType } = data;

      io.to(roomName).emit('TERMINAL_OPENED', {
        ptyId: `pty-${socket.id}`,
        terminalName,
        shellType
      });

      logger.info('Terminal started', { roomName, terminalName });
    });

    socket.on('TERMINAL_INPUT', (data: any) => {
      const { roomName, input } = data;
      io.to(roomName).emit('TERMINAL_OUTPUT', { data: input });
    });

    // ============ DEBUG FEATURE ============
    socket.on('DEBUG_STATE_CHANGED', async (data: any) => {
      const { roomName, sessionName, state } = data;

      try {
        await query(
          `INSERT INTO debug_sessions (session_id, user_id, state, session_name, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (session_id, user_id) DO UPDATE SET state = $3`,
          [roomName, socket.id, state, sessionName]
        );

        io.to(roomName).emit('REMOTE_DEBUG_STATE', data);
        logger.debug('Debug state updated', { roomName, state });
      } catch (err) {
        logger.error('Failed to update debug state:', err);
      }
    });

    socket.on('DEBUG_BREAKPOINTS', async (data: any) => {
      const { roomName, added, removed } = data;

      try {
        // Store breakpoints in database
        for (const bp of added) {
          await query(
            `INSERT INTO debug_breakpoints (session_id, file_path, line_number, user_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [roomName, bp.file, bp.line, socket.id]
          );
        }

        for (const bp of removed) {
          await query(
            `DELETE FROM debug_breakpoints
             WHERE session_id = $1 AND file_path = $2 AND line_number = $3`,
            [roomName, bp.file, bp.line]
          );
        }

        io.to(roomName).emit('DEBUG_BREAKPOINTS', { added, removed });
        logger.debug('Breakpoints updated', { roomName, added: added.length, removed: removed.length });
      } catch (err) {
        logger.error('Failed to update breakpoints:', err);
      }
    });

    // ============ A/V FEATURE ============
    socket.on('AV_CALL_OFFER', (data: any) => {
      const { roomName, targetUserId, offer } = data;

      // Broadcast to specific user or entire room
      io.to(roomName).emit('INCOMING_AV_CALL', {
        userId: socket.id,
        offer,
        timestamp: Date.now()
      });

      logger.info('AV call initiated', { from: socket.id, roomName });
    });

    socket.on('AV_CALL_ANSWER', (data: any) => {
      const { roomName, answer } = data;

      io.to(roomName).emit('AV_CALL_ANSWERED', {
        userId: socket.id,
        answer,
        timestamp: Date.now()
      });

      logger.info('AV call answered', { roomName });
    });

    socket.on('ICE_CANDIDATE', (data: any) => {
      const { roomName, candidate } = data;

      io.to(roomName).emit('ICE_CANDIDATE', {
        userId: socket.id,
        candidate
      });

      logger.debug('ICE candidate shared', { roomName });
    });

    socket.on('AV_CALL_ENDED', (data: any) => {
      const { roomName } = data;

      io.to(roomName).emit('AV_CALL_ENDED', {
        userId: socket.id,
        timestamp: Date.now()
      });

      logger.info('AV call ended', { roomName });
    });

    // ============ ENCRYPTION FEATURE ============
    socket.on('ENCRYPTION_KEY_EXCHANGE', async (data: any) => {
      const { roomName, publicKey, provider } = data;

      try {
        await query(
          `INSERT INTO user_encryption_keys (user_id, room_id, public_key, provider, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, room_id) DO UPDATE SET public_key = $3`,
          [socket.id, roomName, publicKey, provider]
        );

        io.to(roomName).emit('ENCRYPTION_KEY_SHARED', {
          userId: socket.id,
          publicKey
        });

        logger.info('Encryption key exchanged', { roomName });
      } catch (err) {
        logger.error('Failed to exchange encryption key:', err);
      }
    });

    // ============ CLEANUP ============
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);

      // Clean up session recordings
      activeSessions.forEach((session, roomName) => {
        session.participants.delete(socket.id);
        if (session.participants.size === 0) {
          activeSessions.delete(roomName);
        }
      });
    });

    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('Socket.io handlers configured');
};
