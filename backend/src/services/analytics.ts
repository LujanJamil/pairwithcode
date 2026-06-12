import { Pool } from 'pg';

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  edits: number;
  conflicts: number;
  messages: number;
  participantCount: number;
  fileChanges: Map<string, number>;
  userActivity: Map<string, { edits: number; messages: number }>;
}

export class AnalyticsService {
  constructor(private pool: Pool) {}

  async recordEdit(sessionId: string, userId: string, filePath: string) {
    const query = `
      INSERT INTO analytics_events (session_id, user_id, event_type, file_path, timestamp)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    await this.pool.query(query, [sessionId, userId, 'edit', filePath]);
  }

  async recordConflict(sessionId: string, userId: string, filePath: string) {
    const query = `
      INSERT INTO analytics_events (session_id, user_id, event_type, file_path, timestamp)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    await this.pool.query(query, [sessionId, userId, 'conflict', filePath]);
  }

  async getSessionMetrics(sessionId: string) {
    const query = `
      SELECT 
        s.id,
        s.created_at,
        s.ended_at,
        COUNT(DISTINCT ae.id) as total_events,
        COUNT(DISTINCT CASE WHEN ae.event_type = 'edit' THEN ae.id END) as edits,
        COUNT(DISTINCT CASE WHEN ae.event_type = 'conflict' THEN ae.id END) as conflicts,
        COUNT(DISTINCT CASE WHEN ae.event_type = 'message' THEN ae.id END) as messages,
        COUNT(DISTINCT ae.user_id) as collaborators
      FROM sessions s
      LEFT JOIN analytics_events ae ON s.id = ae.session_id
      WHERE s.id = $1
      GROUP BY s.id, s.created_at, s.ended_at
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }

  async getTimelineMetrics(sessionId: string, intervalSeconds: number = 60) {
    const query = `
      SELECT 
        DATE_TRUNC('seconds', timestamp)::timestamp(0) + 
        (EXTRACT(seconds FROM timestamp)::int / $1)::int * INTERVAL '1 second' * $1 as time_bucket,
        COUNT(*) as edit_count
      FROM analytics_events
      WHERE session_id = $1 AND event_type = 'edit'
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;
    const result = await this.pool.query(query, [sessionId, intervalSeconds]);
    return result.rows;
  }

  async getFileActivity(sessionId: string) {
    const query = `
      SELECT 
        file_path,
        COUNT(*) as edit_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM analytics_events
      WHERE session_id = $1 AND event_type = 'edit'
      GROUP BY file_path
      ORDER BY edit_count DESC
      LIMIT 20
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows;
  }

  async getUserActivity(sessionId: string) {
    const query = `
      SELECT 
        u.id,
        u.name,
        COUNT(DISTINCT CASE WHEN ae.event_type = 'edit' THEN ae.id END) as edit_count,
        COUNT(DISTINCT CASE WHEN ae.event_type = 'message' THEN ae.id END) as message_count,
        EXTRACT(EPOCH FROM (MAX(ae.timestamp) - MIN(ae.timestamp)))::int as duration_seconds
      FROM sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN analytics_events ae ON s.id = ae.session_id AND u.id = ae.user_id
      WHERE s.id = $1
      GROUP BY u.id, u.name
      ORDER BY edit_count DESC
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows;
  }
}
