"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeReviewService = void 0;
class CodeReviewService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async createComment(comment) {
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
    async getComments(sessionId, filePath) {
        const query = `
      SELECT * FROM code_review_comments 
      WHERE session_id = $1 AND file_path = $2 AND thread_id IS NULL
      ORDER BY line_number ASC, created_at DESC
    `;
        const result = await this.pool.query(query, [sessionId, filePath]);
        const comments = [];
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
    async getReplies(threadId) {
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
    async resolveComment(commentId) {
        const query = `
      UPDATE code_review_comments 
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = $1
    `;
        await this.pool.query(query, [commentId]);
    }
    async getStats(sessionId) {
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
exports.CodeReviewService = CodeReviewService;
//# sourceMappingURL=code-review.js.map