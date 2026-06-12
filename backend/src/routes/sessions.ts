import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/sessions - Create a new session
router.post('/', async (req, res) => {
  try {
    const { name, ownerId, isPublic = false } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();

    await query(
      `INSERT INTO sessions (id, name, owner_id, is_public, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [sessionId, name, ownerId, isPublic, timestamp]
    );

    // Add owner as participant
    await query(
      `INSERT INTO session_participants (id, session_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'owner', NOW())`,
      [uuidv4(), sessionId, ownerId]
    );

    logger.info('Session created', { sessionId, name, ownerId });

    res.status(201).json({
      id: sessionId,
      name,
      ownerId,
      isPublic,
      createdAt: timestamp,
      participantCount: 1
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions/:sessionId - Get session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await query(
      `SELECT s.id, s.name, s.owner_id, s.is_public, s.status,
              s.created_at, COUNT(sp.user_id) as participant_count
       FROM sessions s
       LEFT JOIN session_participants sp ON s.id = sp.session_id AND sp.is_active = true
       WHERE s.id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id, s.name, s.owner_id, s.is_public, s.status, s.created_at`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    logger.debug('Session retrieved', { sessionId });

    res.status(200).json({
      id: session.id,
      name: session.name,
      ownerId: session.owner_id,
      isPublic: session.is_public,
      status: session.status,
      createdAt: session.created_at,
      participantCount: session.participant_count
    });
  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /api/sessions/:sessionId/participants - Add participant
router.post('/:sessionId/participants', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await query(
      `INSERT INTO session_participants (id, session_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'editor', NOW())
       ON CONFLICT (session_id, user_id) DO UPDATE
       SET is_active = true, left_at = NULL`,
      [uuidv4(), sessionId, userId]
    );

    logger.info('Participant added', { sessionId, userId });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Error adding participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// DELETE /api/sessions/:sessionId/participants/:userId - Remove participant
router.delete('/:sessionId/participants/:userId', async (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    await query(
      `UPDATE session_participants
       SET is_active = false, left_at = NOW()
       WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    logger.info('Participant removed', { sessionId, userId });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// GET /api/sessions - List user's sessions
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await query(
      `SELECT s.id, s.name, s.owner_id, s.status, s.created_at,
              COUNT(sp.user_id) as participant_count
       FROM sessions s
       JOIN session_participants sp ON s.id = sp.session_id
       WHERE sp.user_id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id, s.name, s.owner_id, s.status, s.created_at
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [userId]
    );

    logger.debug('Sessions retrieved', { userId, count: result.rows.length });

    res.status(200).json({
      sessions: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        status: row.status,
        createdAt: row.created_at,
        participantCount: row.participant_count
      }))
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
