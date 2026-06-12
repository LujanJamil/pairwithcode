import { Pool } from 'pg';

export interface CodeReviewComment {
  id: string;
  sessionId: string;
  filePath: string;
  lineNumber: number;
  userId: string;
  userName: string;
  content: string;
  type: 'suggestion' | 'question' | 'issue' | 'blocker';
  severity: 'info' | 'warning' | 'error';
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Date;
  resolvedAt?: Date;
  threadId?: string;
  replies: CodeReviewComment[];
}

export class CodeReviewService {
  constructor(private pool: Pool) {}

  async createComment(comment: Omit<CodeReviewComment, 'id' | 'createdAt'>): Promise<CodeReviewComment> {
    const query = `
      INSERT INTO code_review_comments 
      (session_id, file_path, line_number, user_id, user_name, content, type, severity, status, thread_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at
    `;
    const result = await this.pool.query(query, [
      comment.sessionId, comment.filePath, comment.lineNumber,
      comment.userId, comment.userName, comment.content,
      comment.type, comment.severity, comment.status, comment.threadId || null,
    ]);

    const row = result.rows[0];
    return { ...comment, id: row.id, createdAt: row.created_at, replies: [] };
  }

  async getComments(sessionId: string, filePath: string): Promise<CodeReviewComment[]> {
    const query = `
      SELECT * FROM code_review_comments 
      WHERE session_id = $1 AND file_path = $2 AND thread_id IS NULL
      ORDER BY line_number ASC, created_at DESC
    `;
    const result = await this.pool.query(query, [sessionId, filePath]);
    
    const comments: CodeReviewComment[] = [];
    for (const row of result.rows) {
      const replies = await this.getReplies(row.id);
      comments.push({
        id: row.id,
        sessionId: row.session_id,
        filePath: row.file_path,
        lineNumber: row.line_number,
        userId: row.user_id,
        userName: row.user_name,
        content: row.content,
        type: row.type,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        threadId: row.thread_id,
        replies,
      });
    }
    return comments;
  }

  private async getReplies(threadId: string): Promise<CodeReviewComment[]> {
    const query = `
      SELECT * FROM code_review_comments 
      WHERE thread_id = $1
      ORDER BY created_at ASC
    `;
    const result = await this.pool.query(query, [threadId]);
    return result.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      filePath: row.file_path,
      lineNumber: row.line_number,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      type: row.type,
      severity: row.severity,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      replies: [],
    }));
  }

  async addReply(data: any): Promise<CodeReviewComment> {
    const { commentId, userId, userName, content } = data;
    const query = `
      INSERT INTO code_review_comments 
      (session_id, file_path, line_number, user_id, user_name, content, type, severity, status, thread_id)
      SELECT session_id, file_path, line_number, $2, $3, $4, 'reply', 'info', 'open', id
      FROM code_review_comments WHERE id = $1
      RETURNING id, created_at
    `;
    const result = await this.pool.query(query, [commentId, userId, userName, content]);
    return {
      id: result.rows[0].id,
      sessionId: '',
      filePath: '',
      lineNumber: 0,
      userId,
      userName,
      content,
      type: 'reply' as any,
      severity: 'info' as any,
      status: 'open' as any,
      createdAt: result.rows[0].created_at,
      replies: [],
    };
  }

  async getSessionComments(sessionId: string): Promise<CodeReviewComment[]> {
    const query = `
      SELECT * FROM code_review_comments 
      WHERE session_id = $1 AND thread_id IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [sessionId]);
     
    const comments: CodeReviewComment[] = [];
    for (const row of result.rows) {
      const replies = await this.getReplies(row.id);
      comments.push({
        id: row.id,
        sessionId: row.session_id,
        filePath: row.file_path,
        lineNumber: row.line_number,
        userId: row.user_id,
        userName: row.user_name,
        content: row.content,
        type: row.type,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        threadId: row.thread_id,
        replies,
      });
    }
    return comments;
  }

  async getFileComments(sessionId: string, filePath: string): Promise<CodeReviewComment[]> {
    return this.getComments(sessionId, filePath);
  }

  async resolveComment(commentId: string): Promise<void> {
    const query = `
      UPDATE code_review_comments 
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = $1
    `;
    await this.pool.query(query, [commentId]);
  }

  async updateCommentStatus(commentId: string, status: string): Promise<void> {
    const query = `
      UPDATE code_review_comments 
      SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
      WHERE id = $2
    `;
    await this.pool.query(query, [status, commentId]);
  }

  async deleteComment(commentId: string): Promise<void> {
    const query = `
      DELETE FROM code_review_comments 
      WHERE id = $1 OR thread_id = $1
    `;
    await this.pool.query(query, [commentId]);
  }

  async generateReviewReport(sessionId: string) {
    const stats = await this.getStats(sessionId);
    const query = `
      SELECT type, severity, COUNT(*) as count
      FROM code_review_comments
      WHERE session_id = $1
      GROUP BY type, severity
    `;
    const result = await this.pool.query(query, [sessionId]);
    return {
      ...stats,
      breakdown: result.rows,
    };
  }

  async getStats(sessionId: string) {
    const query = `
      SELECT 
        COUNT(*) as total_comments,
        COUNT(DISTINCT file_path) as files_reviewed,
        COUNT(CASE WHEN severity = 'error' THEN 1 END) as critical_issues,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warnings,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
      FROM code_review_comments
      WHERE session_id = $1
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows[0];
  }
}
