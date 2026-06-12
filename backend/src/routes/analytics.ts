import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/analytics/events - Log analytics event
router.post('/events', async (req, res) => {
  try {
    const { sessionId, userId, eventType, metadata } = req.body;

    if (!sessionId || !userId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const eventId = uuidv4();

    await query(
      `INSERT INTO session_analytics (id, session_id, user_id, event_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [eventId, sessionId, userId, eventType]
    );

    logger.debug('Analytics event logged', { eventType, sessionId, userId });

    res.status(201).json({ eventId, success: true });
  } catch (error) {
    logger.error('Error logging analytics:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// POST /api/analytics/batch - Batch log multiple events
router.post('/batch', async (req, res) => {
  try {
    const { sessionId, userId, events } = req.body;

    if (!sessionId || !userId || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const values = events
      .map((e: any) => `('${uuidv4()}', '${sessionId}', '${userId}', '${e.eventType}', NOW())`)
      .join(',');

    await query(
      `INSERT INTO session_analytics (id, session_id, user_id, event_type, created_at)
       VALUES ${values}`
    );

    logger.debug('Batch analytics logged', { sessionId, count: events.length });

    res.status(201).json({ count: events.length, success: true });
  } catch (error) {
    logger.error('Error batch logging analytics:', error);
    res.status(500).json({ error: 'Failed to log batch' });
  }
});

// GET /api/analytics/sessions/:sessionId - Get session analytics
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Event timeline
    const eventsResult = await query(
      `SELECT event_type, COUNT(*) as count, user_id
       FROM session_analytics
       WHERE session_id = $1
       GROUP BY event_type, user_id
       ORDER BY user_id`,
      [sessionId]
    );

    // Participant stats
    const statsResult = await query(
      `SELECT sp.user_id, u.username,
              COUNT(DISTINCT sa.id) as event_count,
              SUM(CASE WHEN sa.event_type = 'typing' THEN 1 ELSE 0 END) as typing_events,
              SUM(CASE WHEN sa.event_type = 'cursor_move' THEN 1 ELSE 0 END) as cursor_events,
              SUM(CASE WHEN sa.event_type = 'file_switch' THEN 1 ELSE 0 END) as file_switches
       FROM session_participants sp
       LEFT JOIN users u ON sp.user_id = u.id
       LEFT JOIN session_analytics sa ON sp.session_id = sa.session_id AND sp.user_id = sa.user_id
       WHERE sp.session_id = $1
       GROUP BY sp.user_id, u.username`,
      [sessionId]
    );

    logger.debug('Session analytics retrieved', { sessionId });

    res.status(200).json({
      sessionId,
      events: eventsResult.rows,
      participantStats: statsResult.rows.map((row: any) => ({
        userId: row.user_id,
        userName: row.username,
        eventCount: row.event_count,
        typingEvents: row.typing_events,
        cursorEvents: row.cursor_events,
        fileSwitches: row.file_switches
      }))
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/users/:userId - Get user analytics
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT s.id, s.name, COUNT(sa.id) as event_count,
              SUM(CASE WHEN sa.event_type = 'typing' THEN 1 ELSE 0 END) as typing_count
       FROM session_participants sp
       JOIN sessions s ON sp.session_id = s.id
       LEFT JOIN session_analytics sa ON s.id = sa.session_id AND sa.user_id = $1
       WHERE sp.user_id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id, s.name
       ORDER BY s.created_at DESC`,
      [userId]
    );

    logger.debug('User analytics retrieved', { userId });

    res.status(200).json({
      userId,
      sessions: result.rows.map((row: any) => ({
        sessionId: row.id,
        sessionName: row.name,
        eventCount: row.event_count,
        typingCount: row.typing_count
      }))
    });
  } catch (error) {
    logger.error('Error fetching user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

export default router;
