"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = exports.AuditService = exports.RBACService = exports.EncryptionService = exports.RecordingService = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class RecordingService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async createRecording(sessionId) {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const result = await this.pool.query(`INSERT INTO session_recordings (id, session_id, status, started_at, created_at, updated_at)
       VALUES ($1, $2, 'recording', $3, $4, $4)
       RETURNING id, session_id, status, started_at, created_at`, [id, sessionId, now, now]);
        logger_1.logger.info('Recording created', { recordingId: id, sessionId });
        return {
            id,
            sessionId,
            status: 'recording',
            frameCount: 0,
            duration: 0,
            startedAt: now,
            frames: []
        };
    }
    async addFrames(recordingId, frames) {
        await this.pool.query(`UPDATE session_recordings
       SET frames = frames || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`, [recordingId, JSON.stringify(frames)]);
    }
    async completeRecording(recordingId, duration) {
        const endedAt = new Date();
        await this.pool.query(`UPDATE session_recordings
       SET status = 'completed',
           duration = $2,
           ended_at = $3,
           updated_at = NOW()
       WHERE id = $1`, [recordingId, duration, endedAt]);
        logger_1.logger.info('Recording completed', { recordingId, duration });
    }
    async getRecording(recordingId) {
        const result = await this.pool.query(`SELECT id, session_id, status, ARRAY_LENGTH(frames, 1) as frame_count,
              duration, started_at, ended_at, frames
       FROM session_recordings
       WHERE id = $1`, [recordingId]);
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            id: row.id,
            sessionId: row.session_id,
            status: row.status,
            frameCount: row.frame_count || 0,
            duration: row.duration || 0,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            frames: row.frames || []
        };
    }
    async getSessionRecordings(sessionId) {
        const result = await this.pool.query(`SELECT id, session_id, status, ARRAY_LENGTH(frames, 1) as frame_count,
              duration, started_at, ended_at
       FROM session_recordings
       WHERE session_id = $1
       ORDER BY created_at DESC`, [sessionId]);
        return result.rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            status: row.status,
            frameCount: row.frame_count || 0,
            duration: row.duration || 0,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            frames: []
        }));
    }
}
exports.RecordingService = RecordingService;
class EncryptionService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async storePublicKey(userId, sessionId, publicKey, fingerprint) {
        await this.pool.query(`INSERT INTO user_encryption_keys (user_id, session_id, public_key, fingerprint, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id, session_id)
       DO UPDATE SET public_key = $3, fingerprint = $4, updated_at = NOW()`, [userId, sessionId, publicKey, fingerprint]);
        logger_1.logger.info('Public key stored', { userId, sessionId, fingerprint });
    }
    async getPublicKey(userId, sessionId) {
        const result = await this.pool.query(`SELECT public_key FROM user_encryption_keys
       WHERE user_id = $1 AND session_id = $2`, [userId, sessionId]);
        return result.rows.length > 0 ? result.rows[0].public_key : null;
    }
    async verifyKeyFingerprint(userId, sessionId, fingerprint) {
        await this.pool.query(`UPDATE user_encryption_keys
       SET verified_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND session_id = $2 AND fingerprint = $3`, [userId, sessionId, fingerprint]);
        const result = await this.pool.query(`SELECT verified_at FROM user_encryption_keys
       WHERE user_id = $1 AND session_id = $2`, [userId, sessionId]);
        return result.rows.length > 0 && result.rows[0].verified_at !== null;
    }
    async getSessionKeys(sessionId) {
        const result = await this.pool.query(`SELECT user_id, public_key FROM user_encryption_keys
       WHERE session_id = $1 AND verified_at IS NOT NULL`, [sessionId]);
        const keys = new Map();
        result.rows.forEach(row => {
            keys.set(row.user_id, row.public_key);
        });
        return keys;
    }
}
exports.EncryptionService = EncryptionService;
class RBACService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async assignRole(userId, sessionId, roleName, assignedBy) {
        // Get role ID by name
        const roleResult = await this.pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
        if (roleResult.rows.length === 0) {
            throw new Error(`Role ${roleName} not found`);
        }
        const roleId = roleResult.rows[0].id;
        await this.pool.query(`INSERT INTO user_role_assignments (user_id, session_id, role_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, session_id)
       DO UPDATE SET role_id = $3, assigned_by = $4, assigned_at = NOW()`, [userId, sessionId, roleId, assignedBy]);
        logger_1.logger.info('Role assigned', { userId, sessionId, role: roleName });
    }
    async getUserRole(userId, sessionId) {
        const result = await this.pool.query(`SELECT r.name FROM user_role_assignments ura
       JOIN roles r ON ura.role_id = r.id
       WHERE ura.user_id = $1 AND ura.session_id = $2`, [userId, sessionId]);
        return result.rows.length > 0 ? result.rows[0].name : null;
    }
    async hasPermission(userId, sessionId, permission) {
        const result = await this.pool.query(`SELECT r.permissions FROM user_role_assignments ura
       JOIN roles r ON ura.role_id = r.id
       WHERE ura.user_id = $1 AND ura.session_id = $2`, [userId, sessionId]);
        if (result.rows.length === 0)
            return false;
        const permissions = result.rows[0].permissions || [];
        return permissions.includes(permission);
    }
    async getSessionMembers(sessionId) {
        const result = await this.pool.query(`SELECT ura.user_id, r.name as role FROM user_role_assignments ura
       JOIN roles r ON ura.role_id = r.id
       WHERE ura.session_id = $1`, [sessionId]);
        return result.rows.map(row => ({ userId: row.user_id, role: row.name }));
    }
}
exports.RBACService = RBACService;
class AuditService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async log(userId, action, resourceType, resourceId, sessionId, changes, status = 'success', errorMessage, ipAddress, userAgent) {
        await this.pool.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, session_id, changes, status, error_message, ip_address, user_agent, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, [userId, action, resourceType, resourceId, sessionId, changes ? JSON.stringify(changes) : null, status, errorMessage, ipAddress, userAgent]);
    }
    async getSessionLogs(sessionId, limit = 1000) {
        const result = await this.pool.query(`SELECT * FROM audit_logs
       WHERE session_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`, [sessionId, limit]);
        return result.rows;
    }
    async getUserLogs(userId, limit = 1000) {
        const result = await this.pool.query(`SELECT * FROM audit_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`, [userId, limit]);
        return result.rows;
    }
    async getComplianceReport(sessionId, startTime, endTime) {
        const result = await this.pool.query(`SELECT
         action,
         COUNT(*) as count,
         COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
         COUNT(CASE WHEN status = 'failure' THEN 1 END) as failure_count
       FROM audit_logs
       WHERE session_id = $1 AND timestamp BETWEEN $2 AND $3
       GROUP BY action`, [sessionId, startTime, endTime]);
        return {
            sessionId,
            startTime,
            endTime,
            actionStats: result.rows,
            totalEvents: result.rows.reduce((sum, row) => sum + row.count, 0)
        };
    }
}
exports.AuditService = AuditService;
class AnalyticsService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async startSession(sessionId) {
        await this.pool.query(`INSERT INTO analytics_sessions (id, session_id, start_time, created_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (session_id) DO NOTHING`, [(0, uuid_1.v4)(), sessionId]);
    }
    async logEvent(sessionId, userId, eventType, metadata) {
        await this.pool.query(`INSERT INTO analytics_events (id, session_id, user_id, event_type, timestamp, metadata)
       VALUES ($1, $2, $3, $4, NOW(), $5)`, [(0, uuid_1.v4)(), sessionId, userId, eventType, metadata ? JSON.stringify(metadata) : null]);
    }
    async getSessionAnalytics(sessionId) {
        const eventResult = await this.pool.query(`SELECT
         event_type,
         COUNT(*) as count,
         COUNT(DISTINCT user_id) as unique_users
       FROM analytics_events
       WHERE session_id = $1
       GROUP BY event_type`, [sessionId]);
        const statsResult = await this.pool.query(`SELECT * FROM analytics_sessions WHERE session_id = $1`, [sessionId]);
        const stats = statsResult.rows[0] || {};
        return {
            sessionId,
            startTime: stats.start_time,
            endTime: stats.end_time,
            totalEdits: stats.total_edits || 0,
            totalConflicts: stats.total_conflicts || 0,
            events: eventResult.rows
        };
    }
    async getUserAnalytics(userId) {
        const result = await this.pool.query(`SELECT
         COUNT(DISTINCT session_id) as session_count,
         COUNT(*) as event_count,
         COUNT(DISTINCT event_type) as event_types
       FROM analytics_events
       WHERE user_id = $1`, [userId]);
        return result.rows[0] || {};
    }
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=enterprise.js.map