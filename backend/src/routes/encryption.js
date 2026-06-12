"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// Exchange encryption keys
router.post('/exchange', async (req, res) => {
    try {
        const { sessionId, userId, publicKey, provider } = req.body;
        if (!publicKey || publicKey.length < 100) {
            return res.status(400).json({ error: 'Invalid public key' });
        }
        // Generate fingerprint
        const hash = crypto_1.default.createHash('sha256');
        hash.update(publicKey);
        const fingerprint = hash.digest('hex').substring(0, 16);
        const result = await db_1.db.query(`INSERT INTO user_encryption_keys (user_id, session_id, public_key, provider, fingerprint, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, session_id) DO UPDATE SET public_key = $3, fingerprint = $5
       RETURNING *`, [userId, sessionId, publicKey, provider || 'custom', fingerprint]);
        logger_1.logger.info('Encryption key exchanged', { sessionId, userId, fingerprint });
        res.json({
            success: true,
            fingerprint,
            keyId: result.rows[0].id
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to exchange keys:', error);
        res.status(500).json({ error: 'Failed to exchange keys' });
    }
});
// Get public key
router.get('/users/:userId/sessions/:sessionId', async (req, res) => {
    try {
        const { userId, sessionId } = req.params;
        const result = await db_1.db.query(`SELECT public_key, fingerprint, provider FROM user_encryption_keys
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at DESC LIMIT 1`, [userId, sessionId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Key not found' });
        }
        res.json({
            publicKey: result.rows[0].public_key,
            fingerprint: result.rows[0].fingerprint,
            provider: result.rows[0].provider
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch public key:', error);
        res.status(500).json({ error: 'Failed to fetch public key' });
    }
});
// Get all keys in session
router.get('/sessions/:sessionId/keys', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db_1.db.query(`SELECT user_id, public_key, fingerprint, provider, created_at
       FROM user_encryption_keys
       WHERE session_id = $1
       ORDER BY created_at DESC`, [sessionId]);
        res.json({
            keys: result.rows.map(row => ({
                userId: row.user_id,
                fingerprint: row.fingerprint,
                provider: row.provider,
                createdAt: row.created_at
            }))
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch session keys:', error);
        res.status(500).json({ error: 'Failed to fetch session keys' });
    }
});
// Verify key fingerprint (for manual verification)
router.post('/verify-fingerprint', async (req, res) => {
    try {
        const { sessionId, userId, fingerprint } = req.body;
        const result = await db_1.db.query(`SELECT fingerprint FROM user_encryption_keys
       WHERE session_id = $1 AND user_id = $2`, [sessionId, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ verified: false, error: 'Key not found' });
        }
        const verified = result.rows[0].fingerprint === fingerprint;
        res.json({
            verified,
            expectedFingerprint: verified ? undefined : result.rows[0].fingerprint
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to verify fingerprint:', error);
        res.status(500).json({ error: 'Failed to verify fingerprint' });
    }
});
// Delete key
router.delete('/users/:userId/sessions/:sessionId', async (req, res) => {
    try {
        const { userId, sessionId } = req.params;
        await db_1.db.query(`DELETE FROM user_encryption_keys
       WHERE user_id = $1 AND session_id = $2`, [userId, sessionId]);
        logger_1.logger.info('Encryption key deleted', { userId, sessionId });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete key:', error);
        res.status(500).json({ error: 'Failed to delete key' });
    }
});
exports.default = router;
//# sourceMappingURL=encryption.js.map