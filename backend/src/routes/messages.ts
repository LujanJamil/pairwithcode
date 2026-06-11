import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../config/db';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/messages - Send a new message
router.post('/', async (req, res) => {
  try {
    const { sessionId, userId, userName, content, messageType = 'text' } = req.body;

    if (!sessionId || !userId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const result = await query(
      `INSERT INTO messages (id, session_id, user_id, content, message_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, content, message_type, created_at, status`,
      [messageId, sessionId, userId, content, messageType, timestamp]
    );

    const message = result.rows[0];

    logger.info('Message created', { messageId, sessionId, userId });

    res.status(201).json({
      id: message.id,
      userId: message.user_id,
      userName,
      content: message.content,
      messageType: message.message_type,
      timestamp: message.created_at,
      status: 'sent',
      reactions: []
    });
  } catch (error) {
    logger.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// GET /api/messages/:sessionId - Get all messages for a session
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query(
      `SELECT m.id, m.user_id, u.username as user_name, m.content, m.message_type,
              m.created_at, m.status, json_agg(
                json_build_object('emoji', mr.emoji, 'userIds', array_agg(mr.user_id))
              ) FILTER (WHERE mr.emoji IS NOT NULL) as reactions
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN message_reactions mr ON m.id = mr.message_id
       WHERE m.session_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.id, m.user_id, u.username, m.content, m.message_type, m.created_at, m.status
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );

    const messages = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      messageType: row.message_type,
      timestamp: row.created_at,
      status: row.status,
      reactions: row.reactions || []
    }));

    logger.debug('Messages retrieved', { sessionId, count: messages.length });

    res.status(200).json({
      messages: messages.reverse(),
      total: messages.length,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// PUT /api/messages/:messageId - Edit a message
router.put('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, userId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify user owns the message
    const checkResult = await query(
      'SELECT user_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `UPDATE messages
       SET content = $1, edited_at = NOW(), edit_count = edit_count + 1
       WHERE id = $2
       RETURNING id, content, edited_at, edit_count`,
      [content, messageId]
    );

    const message = result.rows[0];
    logger.info('Message updated', { messageId, userId });

    res.status(200).json({
      id: message.id,
      content: message.content,
      editedAt: message.edited_at,
      editCount: message.edit_count
    });
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// DELETE /api/messages/:messageId - Soft delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    // Verify user owns the message
    const checkResult = await query(
      'SELECT user_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await query(
      'UPDATE messages SET deleted_at = NOW() WHERE id = $1',
      [messageId]
    );

    logger.info('Message deleted', { messageId, userId });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// POST /api/messages/:messageId/reactions - Add or remove reaction
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji, userId, action = 'add' } = req.body;

    if (!emoji || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (action === 'add') {
      await query(
        `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [uuidv4(), messageId, userId, emoji]
      );
    } else if (action === 'remove') {
      await query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, userId, emoji]
      );
    }

    logger.info('Message reaction updated', { messageId, emoji, action });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error updating reaction:', error);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

// GET /api/messages/search/:sessionId - Search messages
router.get('/search/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const result = await query(
      `SELECT m.id, m.user_id, u.username as user_name, m.content, m.created_at
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.session_id = $1 AND m.deleted_at IS NULL
       AND (m.content ILIKE $2 OR u.username ILIKE $2)
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [sessionId, `%${q}%`]
    );

    logger.debug('Messages searched', { sessionId, query: q, count: result.rows.length });

    res.status(200).json({
      results: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        content: row.content,
        timestamp: row.created_at
      }))
    });
  } catch (error) {
    logger.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

export default router;
