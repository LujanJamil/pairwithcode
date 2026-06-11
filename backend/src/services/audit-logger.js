"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogger = void 0;
class AuditLogger {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async log(userId, eventType, resourceType, resourceId, ipAddress, userAgent, changes, status = 'success', errorMessage) {
        const query = `
      INSERT INTO audit_logs 
      (user_id, event_type, resource_type, resource_id, changes, ip_address, user_agent, status, error_message, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `;
        await this.pool.query(query, [
            userId, eventType, resourceType, resourceId,
            changes ? JSON.stringify(changes) : null,
            ipAddress, userAgent, status, errorMessage,
        ]);
    }
    async getLogs(userId, eventType, startDate, endDate, limit = 100) {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        if (userId) {
            query += ` AND user_id = $${params.length + 1}`;
            params.push(userId);
        }
        if (eventType) {
            query += ` AND event_type = $${params.length + 1}`;
            params.push(eventType);
        }
        if (startDate) {
            query += ` AND timestamp >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND timestamp <= $${params.length + 1}`;
            params.push(endDate);
        }
        query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await this.pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            userId: row.user_id,
            userName: row.user_name,
            eventType: row.event_type,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            changes: row.changes ? JSON.parse(row.changes) : undefined,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            status: row.status,
            errorMessage: row.error_message,
        }));
    }
    async getComplianceReport(startDate, endDate) {
        const query = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_events,
        event_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY DATE(timestamp), event_type
      ORDER BY date DESC, event_type
    `;
        const result = await this.pool.query(query, [startDate, endDate]);
        return result.rows;
    }
    async deleteOldLogs(daysToKeep = 90) {
        const query = `
      DELETE FROM audit_logs 
      WHERE timestamp < NOW() - INTERVAL '1 day' * $1
    `;
        const result = await this.pool.query(query, [daysToKeep]);
        return result.rowCount || 0;
    }
}
exports.AuditLogger = AuditLogger;
//# sourceMappingURL=audit-logger.js.map