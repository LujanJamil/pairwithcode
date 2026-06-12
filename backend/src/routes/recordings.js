"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// List recordings for a session
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db_1.db.query(`SELECT id, session_id, status, duration, frames, started_at, created_at
       FROM session_recordings
       WHERE session_id = $1
       ORDER BY created_at DESC`, [sessionId]);
        res.json({
            recordings: result.rows.map(r => ({
                id: r.id,
                sessionId: r.session_id,
                status: r.status,
                duration: r.duration,
                frameCount: r.frames ? r.frames.length : 0,
                createdAt: r.created_at,
                fileSize: Math.random() * 50000000 // Placeholder
            }))
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recordings:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
});
// Get specific recording
router.get('/:recordingId', async (req, res) => {
    try {
        const { recordingId } = req.params;
        const result = await db_1.db.query(`SELECT id, session_id, status, frames, duration, created_at
       FROM session_recordings
       WHERE id = $1`, [recordingId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recording not found' });
        }
        res.json({
            recording: result.rows[0]
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recording:', error);
        res.status(500).json({ error: 'Failed to fetch recording' });
    }
});
// Get recording video (placeholder)
router.get('/:recordingId/video', async (req, res) => {
    try {
        const { recordingId } = req.params;
        // In production, this would stream video from S3 or local storage
        res.json({
            message: 'Video streaming not yet implemented',
            recordingId,
            note: 'FFmpeg encoding required on backend'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to stream video:', error);
        res.status(500).json({ error: 'Failed to stream video' });
    }
});
// Delete recording
router.delete('/:recordingId', async (req, res) => {
    try {
        const { recordingId } = req.params;
        await db_1.db.query(`DELETE FROM session_recordings WHERE id = $1`, [recordingId]);
        logger_1.logger.info('Recording deleted', { recordingId });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete recording:', error);
        res.status(500).json({ error: 'Failed to delete recording' });
    }
});
// Batch store frames
router.post('/frames/batch', async (req, res) => {
    try {
        const { recordingId, frames } = req.body;
        await db_1.db.query(`UPDATE session_recordings
       SET frames = COALESCE(frames, '[]'::jsonb) || $1
       WHERE id = $2`, [JSON.stringify(frames), recordingId]);
        res.json({ success: true, frameCount: frames.length });
    }
    catch (error) {
        logger_1.logger.error('Failed to store frames:', error);
        res.status(500).json({ error: 'Failed to store frames' });
    }
});
exports.default = router;
//# sourceMappingURL=recordings.js.map