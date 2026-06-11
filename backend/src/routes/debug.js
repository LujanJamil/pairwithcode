"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Get debug state for a session
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const debugResult = await db_1.db.query(`SELECT ds.*, u.username FROM debug_sessions ds
       LEFT JOIN users u ON ds.user_id = u.id
       WHERE ds.session_id = $1
       ORDER BY ds.created_at DESC`, [sessionId]);
        const breakpointsResult = await db_1.db.query(`SELECT * FROM debug_breakpoints
       WHERE session_id = $1
       ORDER BY file_path, line_number`, [sessionId]);
        res.json({
            debugSessions: debugResult.rows,
            breakpoints: breakpointsResult.rows
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch debug state:', error);
        res.status(500).json({ error: 'Failed to fetch debug state' });
    }
});
// Get breakpoints for a session
router.get('/sessions/:sessionId/breakpoints', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db_1.db.query(`SELECT * FROM debug_breakpoints
       WHERE session_id = $1
       ORDER BY file_path, line_number`, [sessionId]);
        res.json({ breakpoints: result.rows });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch breakpoints:', error);
        res.status(500).json({ error: 'Failed to fetch breakpoints' });
    }
});
// Get breakpoints for specific file
router.get('/sessions/:sessionId/files/:filePath/breakpoints', async (req, res) => {
    try {
        const { sessionId, filePath } = req.params;
        const result = await db_1.db.query(`SELECT * FROM debug_breakpoints
       WHERE session_id = $1 AND file_path = $2
       ORDER BY line_number`, [sessionId, decodeURIComponent(filePath)]);
        res.json({ breakpoints: result.rows });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch file breakpoints:', error);
        res.status(500).json({ error: 'Failed to fetch file breakpoints' });
    }
});
// Create breakpoint
router.post('/breakpoints', async (req, res) => {
    try {
        const { sessionId, filePath, lineNumber } = req.body;
        const result = await db_1.db.query(`INSERT INTO debug_breakpoints (session_id, file_path, line_number, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`, [sessionId, filePath, lineNumber, req.user?.id || 'anonymous']);
        res.status(201).json({ breakpoint: result.rows[0] });
    }
    catch (error) {
        logger_1.logger.error('Failed to create breakpoint:', error);
        res.status(500).json({ error: 'Failed to create breakpoint' });
    }
});
// Delete breakpoint
router.delete('/breakpoints/:breakpointId', async (req, res) => {
    try {
        const { breakpointId } = req.params;
        await db_1.db.query(`DELETE FROM debug_breakpoints WHERE id = $1`, [breakpointId]);
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete breakpoint:', error);
        res.status(500).json({ error: 'Failed to delete breakpoint' });
    }
});
exports.default = router;
//# sourceMappingURL=debug.js.map