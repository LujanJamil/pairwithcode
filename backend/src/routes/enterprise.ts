import { Router } from 'express';
import { Pool } from 'pg';
import { RecordingService, EncryptionService, RBACService, AuditService, AnalyticsService } from '../services/enterprise';
import { requireAuth, AuthRequest } from '../middleware/oauth';
import { logger } from '../utils/logger';

export function createEnterpriseRoutes(pool: Pool): Router {
  const router = Router();
  const recording = new RecordingService(pool);
  const encryption = new EncryptionService(pool);
  const rbac = new RBACService(pool);
  const audit = new AuditService(pool);
  const analytics = new AnalyticsService(pool);

  // ========== RECORDING ENDPOINTS ==========

  // POST /api/recordings/sessions/:sessionId - Get session recordings
  router.get('/recordings/sessions/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const recordings = await recording.getSessionRecordings(sessionId);
      res.status(200).json({ recordings });
    } catch (error) {
      logger.error('Failed to get recordings', { error });
      res.status(500).json({ error: 'Failed to get recordings' });
    }
  });

  // GET /api/recordings/:recordingId - Get recording details
  router.get('/recordings/:recordingId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { recordingId } = req.params;
      const recordingData = await recording.getRecording(recordingId);

      if (!recordingData) {
        return res.status(404).json({ error: 'Recording not found' });
      }

      res.status(200).json(recordingData);
    } catch (error) {
      logger.error('Failed to get recording', { error });
      res.status(500).json({ error: 'Failed to get recording' });
    }
  });

  // POST /api/recordings - Create recording
  router.post('/recordings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.body;
      const recordingData = await recording.createRecording(sessionId);

      await audit.log(req.user!.id, 'recording_started', 'recording', recordingData.id, sessionId);

      res.status(201).json(recordingData);
    } catch (error) {
      logger.error('Failed to create recording', { error });
      res.status(500).json({ error: 'Failed to create recording' });
    }
  });

  // POST /api/recordings/:recordingId/complete - Complete recording
  router.post('/recordings/:recordingId/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { recordingId } = req.params;
      const { duration } = req.body;

      await recording.completeRecording(recordingId, duration);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to complete recording', { error });
      res.status(500).json({ error: 'Failed to complete recording' });
    }
  });

  // ========== ENCRYPTION ENDPOINTS ==========

  // POST /api/encryption/keys/exchange - Exchange public key
  router.post('/encryption/keys/exchange', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId, publicKey, fingerprint } = req.body;
      const userId = req.user!.id;

      await encryption.storePublicKey(userId, sessionId, publicKey, fingerprint);
      await audit.log(userId, 'encryption_key_shared', 'encryption', null, sessionId, { fingerprint });

      res.status(200).json({ success: true, fingerprint });
    } catch (error) {
      logger.error('Failed to exchange encryption key', { error });
      res.status(500).json({ error: 'Failed to exchange key' });
    }
  });

  // GET /api/encryption/keys/:sessionId - Get session keys
  router.get('/encryption/keys/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const keys = await encryption.getSessionKeys(sessionId);
      const keysObject = Object.fromEntries(keys);
      res.status(200).json({ keys: keysObject });
    } catch (error) {
      logger.error('Failed to get encryption keys', { error });
      res.status(500).json({ error: 'Failed to get keys' });
    }
  });

  // POST /api/encryption/keys/verify - Verify key fingerprint
  router.post('/encryption/keys/verify', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { userId, sessionId, fingerprint } = req.body;
      const verified = await encryption.verifyKeyFingerprint(userId, sessionId, fingerprint);

      await audit.log(req.user!.id, 'encryption_key_verified', 'encryption', null, sessionId, { verified });

      res.status(200).json({ verified });
    } catch (error) {
      logger.error('Failed to verify key', { error });
      res.status(500).json({ error: 'Failed to verify key' });
    }
  });

  // ========== RBAC ENDPOINTS ==========

  // POST /api/rbac/roles/assign - Assign role to user
  router.post('/rbac/roles/assign', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { userId, sessionId, roleName } = req.body;

      // Check if user has permission to assign roles
      const hasPermission = await rbac.hasPermission(req.user!.id, sessionId, 'session:manage_users');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      await rbac.assignRole(userId, sessionId, roleName, req.user!.id);
      await audit.log(req.user!.id, 'role_assigned', 'role', null, sessionId, { userId, role: roleName });

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to assign role', { error });
      res.status(500).json({ error: 'Failed to assign role' });
    }
  });

  // GET /api/rbac/sessions/:sessionId/members - Get session members and roles
  router.get('/rbac/sessions/:sessionId/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const members = await rbac.getSessionMembers(sessionId);
      res.status(200).json({ members });
    } catch (error) {
      logger.error('Failed to get session members', { error });
      res.status(500).json({ error: 'Failed to get members' });
    }
  });

  // ========== AUDIT LOG ENDPOINTS ==========

  // GET /api/audit/sessions/:sessionId - Get audit logs for session
  router.get('/audit/sessions/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { limit = 1000 } = req.query;

      // Check permission
      const hasPermission = await rbac.hasPermission(req.user!.id, sessionId, 'session:view');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      const logs = await audit.getSessionLogs(sessionId, parseInt(limit as string));
      res.status(200).json({ logs });
    } catch (error) {
      logger.error('Failed to get audit logs', { error });
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  // GET /api/audit/compliance/:sessionId - Get compliance report
  router.get('/audit/compliance/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { startTime, endTime } = req.query;

      const report = await audit.getComplianceReport(
        sessionId,
        new Date(startTime as string),
        new Date(endTime as string)
      );

      res.status(200).json(report);
    } catch (error) {
      logger.error('Failed to generate compliance report', { error });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  // ========== ANALYTICS ENDPOINTS ==========

  // GET /api/analytics/sessions/:sessionId - Get session analytics
  router.get('/analytics/sessions/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const analyticsData = await analytics.getSessionAnalytics(sessionId);
      res.status(200).json(analyticsData);
    } catch (error) {
      logger.error('Failed to get analytics', { error });
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  // POST /api/analytics/events - Log analytics event
  router.post('/analytics/events', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId, eventType, metadata } = req.body;
      await analytics.logEvent(sessionId, req.user!.id, eventType, metadata);
      res.status(201).json({ success: true });
    } catch (error) {
      logger.error('Failed to log analytics event', { error });
      res.status(500).json({ error: 'Failed to log event' });
    }
  });

  // POST /api/analytics/batch - Log batch of events
  router.post('/analytics/batch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { sessionId, events } = req.body;

      for (const event of events) {
        await analytics.logEvent(sessionId, req.user!.id, event.eventType, event.metadata);
      }

      res.status(201).json({ success: true, count: events.length });
    } catch (error) {
      logger.error('Failed to log batch events', { error });
      res.status(500).json({ error: 'Failed to log events' });
    }
  });

  return router;
}

export default createEnterpriseRoutes;
