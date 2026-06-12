import express, { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics';
import { CodeReviewService } from '../services/code-review';
import { AuditLogger } from '../services/audit-logger';
import { AIConflictResolver } from '../services/ai-conflict-resolver';
import { Pool } from 'pg';

export function createAPIRouter(pool: Pool): Router {
  const router = express.Router();
  const analytics = new AnalyticsService(pool);
  const codeReview = new CodeReviewService(pool);
  const auditLogger = new AuditLogger(pool);
  const aiResolver = new AIConflictResolver(process.env.CLAUDE_API_KEY || '');

  // Analytics Endpoints
  router.get('/analytics/:sessionId', async (req: Request, res: Response) => {
    try {
      const metrics = await analytics.getSessionMetrics(req.params.sessionId);
      const timeline = await analytics.getTimelineMetrics(req.params.sessionId);
      const fileActivity = await analytics.getFileActivity(req.params.sessionId);
      const userActivity = await analytics.getUserActivity(req.params.sessionId);

      res.json({
        sessionDuration: metrics?.total_events || 0,
        editCount: metrics?.edits || 0,
        conflictCount: metrics?.conflicts || 0,
        collaboratorCount: metrics?.collaborators || 0,
        messagesCount: metrics?.messages || 0,
        timeline: timeline.map((t: any) => ({ time: t.time_bucket, edits: t.edit_count })),
        fileActivity: fileActivity.map((f: any) => ({ file: f.file_path, edits: f.edit_count })),
        collaborators: userActivity.map((u: any) => ({ name: u.name, edits: u.edit_count, duration: u.duration_seconds })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // Code Review Endpoints
  router.get('/code-review/:sessionId/:filePath', async (req: Request, res: Response) => {
    try {
      const comments = await codeReview.getComments(req.params.sessionId, req.params.filePath);
      const stats = await codeReview.getStats(req.params.sessionId);
      res.json({ comments, stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch code review' });
    }
  });

  router.post('/code-review', async (req: Request, res: Response) => {
    try {
      const comment = await codeReview.createComment(req.body);
      await auditLogger.log(req.body.userId, 'comment_create', 'comment', comment.id, req.ip || '', req.get('user-agent') || '');
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  router.put('/code-review/:commentId/resolve', async (req: Request, res: Response) => {
    try {
      await codeReview.resolveComment(req.params.commentId);
      await auditLogger.log(req.body.userId, 'comment_resolve', 'comment', req.params.commentId, req.ip || '', req.get('user-agent') || '');
      res.json({ status: 'resolved' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to resolve comment' });
    }
  });

  // AI Conflict Resolution
  router.post('/ai/resolve-conflict', async (req: Request, res: Response) => {
    try {
      const result = await aiResolver.resolvConflict(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to resolve conflict' });
    }
  });

  // Audit Log Endpoints
  router.get('/audit-logs', async (req: Request, res: Response) => {
    try {
      const logs = await auditLogger.getLogs(req.query.userId as string, req.query.eventType as any, req.query.startDate ? new Date(req.query.startDate as string) : undefined, req.query.endDate ? new Date(req.query.endDate as string) : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  router.get('/compliance-report', async (req: Request, res: Response) => {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const report = await auditLogger.getComplianceReport(startDate, endDate);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate compliance report' });
    }
  });

  // OAuth Endpoints
  router.post('/auth/github/callback', async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      // This would be handled by Passport.js middleware in production
      res.json({ success: true, message: 'OAuth callback received' });
      await auditLogger.log('unknown', 'login', 'user', 'oauth', req.ip || '', req.get('user-agent') || '');
    } catch (error) {
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  });

  router.post('/auth/logout', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      await auditLogger.log(userId, 'logout', 'user', userId, req.ip || '', req.get('user-agent') || '');
      res.json({ success: true, message: 'Logged out' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  router.get('/auth/user/:userId', async (req: Request, res: Response) => {
    try {
      // Get user profile from database
      const query = 'SELECT id, name, email, avatar_url, oauth_provider FROM users WHERE id = $1';
      const result = await pool.query(query, [req.params.userId]);
      if (result.rows[0]) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Recording Endpoints
  router.post('/recording/start', async (req: Request, res: Response) => {
    try {
      const { sessionId, userId } = req.body;
      const query = `
        INSERT INTO session_recordings (session_id, recorded_by, start_time, status)
        VALUES ($1, $2, NOW(), 'recording')
        RETURNING id, start_time
      `;
      const result = await pool.query(query, [sessionId, userId]);
      await auditLogger.log(userId, 'create_session', 'recording', result.rows[0].id, req.ip || '', req.get('user-agent') || '');
      res.json({ recordingId: result.rows[0].id, startTime: result.rows[0].start_time });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start recording' });
    }
  });

  router.post('/recording/stop', async (req: Request, res: Response) => {
    try {
      const { recordingId, userId } = req.body;
      const query = `
        UPDATE session_recordings
        SET end_time = NOW(), status = 'processing'
        WHERE id = $1
        RETURNING id, end_time
      `;
      const result = await pool.query(query, [recordingId]);
      await auditLogger.log(userId, 'leave_session', 'recording', recordingId, req.ip || '', req.get('user-agent') || '');
      res.json({ recordingId, endTime: result.rows[0].end_time });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop recording' });
    }
  });

  router.get('/recording/:recordingId', async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT id, session_id, recorded_by, start_time, end_time, video_url, status
        FROM session_recordings
        WHERE id = $1
      `;
      const result = await pool.query(query, [req.params.recordingId]);
      if (result.rows[0]) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Recording not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recording' });
    }
  });

  // Terminal Endpoints
  router.post('/terminal/connect', async (req: Request, res: Response) => {
    try {
      const { sessionId, userId, shell } = req.body;
      res.json({ success: true, ptyId: `pty-${Date.now()}`, shell: shell || 'bash' });
      await auditLogger.log(userId, 'join_session', 'terminal', sessionId, req.ip || '', req.get('user-agent') || '');
    } catch (error) {
      res.status(500).json({ error: 'Failed to connect terminal' });
    }
  });

  router.post('/terminal/disconnect', async (req: Request, res: Response) => {
    try {
      const { ptyId, userId } = req.body;
      await auditLogger.log(userId, 'leave_session', 'terminal', ptyId, req.ip || '', req.get('user-agent') || '');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to disconnect terminal' });
    }
  });

  // Settings Endpoints
  router.get('/settings/:userId', async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT id, name, email, avatar_url
        FROM users
        WHERE id = $1
      `;
      const result = await pool.query(query, [req.params.userId]);
      if (result.rows[0]) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'User settings not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  router.put('/settings/:userId', async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;
      const query = `
        UPDATE users
        SET name = COALESCE($2, name), email = COALESCE($3, email)
        WHERE id = $1
        RETURNING id, name, email
      `;
      const result = await pool.query(query, [req.params.userId, name, email]);
      await auditLogger.log(req.params.userId, 'settings_change', 'user', req.params.userId, req.ip || '', req.get('user-agent') || '');
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Health Check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return router;
}

