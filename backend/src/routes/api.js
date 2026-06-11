"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAPIRouter = createAPIRouter;
const express_1 = __importDefault(require("express"));
const analytics_1 = require("../services/analytics");
const code_review_1 = require("../services/code-review");
const audit_logger_1 = require("../services/audit-logger");
const ai_conflict_resolver_1 = require("../services/ai-conflict-resolver");
function createAPIRouter(pool) {
    const router = express_1.default.Router();
    const analytics = new analytics_1.AnalyticsService(pool);
    const codeReview = new code_review_1.CodeReviewService(pool);
    const auditLogger = new audit_logger_1.AuditLogger(pool);
    const aiResolver = new ai_conflict_resolver_1.AIConflictResolver(process.env.CLAUDE_API_KEY || '');
    // Analytics Endpoints
    router.get('/analytics/:sessionId', async (req, res) => {
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
                timeline: timeline.map((t) => ({ time: t.time_bucket, edits: t.edit_count })),
                fileActivity: fileActivity.map((f) => ({ file: f.file_path, edits: f.edit_count })),
                collaborators: userActivity.map((u) => ({ name: u.name, edits: u.edit_count, duration: u.duration_seconds })),
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    });
    // Code Review Endpoints
    router.get('/code-review/:sessionId/:filePath', async (req, res) => {
        try {
            const comments = await codeReview.getComments(req.params.sessionId, req.params.filePath);
            const stats = await codeReview.getStats(req.params.sessionId);
            res.json({ comments, stats });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch code review' });
        }
    });
    router.post('/code-review', async (req, res) => {
        try {
            const comment = await codeReview.createComment(req.body);
            await auditLogger.log(req.body.userId, 'comment_create', 'comment', comment.id, req.ip || '', req.get('user-agent') || '');
            res.json(comment);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create comment' });
        }
    });
    router.put('/code-review/:commentId/resolve', async (req, res) => {
        try {
            await codeReview.resolveComment(req.params.commentId);
            await auditLogger.log(req.body.userId, 'comment_resolve', 'comment', req.params.commentId, req.ip || '', req.get('user-agent') || '');
            res.json({ status: 'resolved' });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to resolve comment' });
        }
    });
    // AI Conflict Resolution
    router.post('/ai/resolve-conflict', async (req, res) => {
        try {
            const result = await aiResolver.resolvConflict(req.body);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to resolve conflict' });
        }
    });
    // Audit Log Endpoints
    router.get('/audit-logs', async (req, res) => {
        try {
            const logs = await auditLogger.getLogs(req.query.userId, req.query.eventType, req.query.startDate ? new Date(req.query.startDate) : undefined, req.query.endDate ? new Date(req.query.endDate) : undefined);
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch audit logs' });
        }
    });
    router.get('/compliance-report', async (req, res) => {
        try {
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            const report = await auditLogger.getComplianceReport(startDate, endDate);
            res.json(report);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to generate compliance report' });
        }
    });
    // Health Check
    router.get('/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    return router;
}
//# sourceMappingURL=api.js.map