"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
const oauth_1 = require("../middleware/oauth");
const router = (0, express_1.Router)();
// GET /api/auth/me - Get current user info
router.get('/me', oauth_1.verifyToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const result = await (0, db_1.query)(`SELECT id, email, username, oauth_provider, avatar_url, created_at
       FROM users WHERE id = $1`, [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        logger_1.logger.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// POST /api/auth/github - Initiate GitHub OAuth
router.post('/github', async (req, res) => {
    try {
        const { state } = req.body;
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ error: 'GitHub OAuth not configured' });
        }
        if (!state) {
            return res.status(400).json({ error: 'Missing CSRF state token' });
        }
        // Store state in session for validation during callback
        req.session = req.session || {};
        req.session.oauthState = { github: state, timestamp: Date.now() };
        const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/github/callback';
        const scope = 'user:email,read:user';
        // Use the provided state instead of generating new one
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
        res.status(200).json({ authUrl });
    }
    catch (error) {
        logger_1.logger.error('Error initiating GitHub OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
});
// GET /api/auth/github/callback - Handle GitHub OAuth callback
router.get('/github/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }
        // Exchange code for token
        const { accessToken, profile } = await (0, oauth_1.exchangeGitHubCode)(code);
        // Check if user exists
        let userResult = await (0, db_1.query)(`SELECT id FROM users WHERE oauth_provider = 'github' AND oauth_id = $1`, [profile.id]);
        let userId;
        if (userResult.rows.length > 0) {
            // Update existing user
            userId = userResult.rows[0].id;
            await (0, db_1.query)(`UPDATE users SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2`, [profile.avatar_url, userId]);
        }
        else {
            // Create new user
            userId = (0, uuid_1.v4)();
            await (0, db_1.query)(`INSERT INTO users (id, email, username, oauth_provider, oauth_id, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, 'github', $4, $5, NOW(), NOW())`, [userId, profile.email, profile.login, profile.id, profile.avatar_url]);
        }
        const token = (0, oauth_1.generateToken)({
            id: userId,
            email: profile.email,
            username: profile.login,
            oauthProvider: 'github',
            oauthId: profile.id
        });
        logger_1.logger.info('GitHub OAuth successful', { username: profile.login, userId });
        res.redirect(`vscode://pair-with-code/auth-success?token=${token}&provider=github`);
    }
    catch (error) {
        logger_1.logger.error('GitHub OAuth callback failed:', error);
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});
// POST /api/auth/gitlab - Initiate GitLab OAuth
router.post('/gitlab', async (req, res) => {
    try {
        const { state } = req.body;
        const clientId = process.env.GITLAB_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ error: 'GitLab OAuth not configured' });
        }
        if (!state) {
            return res.status(400).json({ error: 'Missing CSRF state token' });
        }
        // Store state in session for validation during callback
        req.session = req.session || {};
        req.session.oauthState = { gitlab: state, timestamp: Date.now() };
        const redirectUri = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/auth/gitlab/callback';
        const scope = 'read_user,read_api';
        const authUrl = `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
        res.status(200).json({ authUrl });
    }
    catch (error) {
        logger_1.logger.error('Error initiating GitLab OAuth:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
});
// GET /api/auth/gitlab/callback - Handle GitLab OAuth callback
router.get('/gitlab/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }
        const { accessToken, profile } = await (0, oauth_1.exchangeGitLabCode)(code);
        let userResult = await (0, db_1.query)(`SELECT id FROM users WHERE oauth_provider = 'gitlab' AND oauth_id = $1`, [profile.id]);
        let userId;
        if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
            await (0, db_1.query)(`UPDATE users SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2`, [profile.avatar_url, userId]);
        }
        else {
            userId = (0, uuid_1.v4)();
            await (0, db_1.query)(`INSERT INTO users (id, email, username, oauth_provider, oauth_id, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, 'gitlab', $4, $5, NOW(), NOW())`, [userId, profile.email, profile.username, profile.id, profile.avatar_url]);
        }
        const token = (0, oauth_1.generateToken)({
            id: userId,
            email: profile.email,
            username: profile.username,
            oauthProvider: 'gitlab',
            oauthId: profile.id
        });
        logger_1.logger.info('GitLab OAuth successful', { username: profile.username, userId });
        res.redirect(`vscode://pair-with-code/auth-success?token=${token}&provider=gitlab`);
    }
    catch (error) {
        logger_1.logger.error('GitLab OAuth callback failed:', error);
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});
// POST /api/auth/logout - Logout (invalidate token client-side)
router.post('/logout', oauth_1.verifyToken, async (req, res) => {
    try {
        logger_1.logger.info('User logged out', { userId: req.user?.id });
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        logger_1.logger.error('Logout failed:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});
// POST /api/auth/token/verify - Verify token validity
router.post('/token/verify', oauth_1.verifyToken, (req, res) => {
    try {
        res.status(200).json({
            valid: true,
            user: req.user,
            tokenExpiry: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes from now
        });
    }
    catch (error) {
        res.status(401).json({ valid: false });
    }
});
// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Missing refresh token' });
        }
        // Verify refresh token is valid (you'll need to implement this based on your token storage)
        // For now, we'll just generate a new access token
        // In production, store refresh tokens in database and validate against stored values
        const decodedToken = Buffer.from(refreshToken, 'base64').toString('utf-8');
        const tokenData = JSON.parse(decodedToken);
        // Verify user still exists
        const userResult = await (0, db_1.query)('SELECT id, email, username, oauth_provider FROM users WHERE id = $1', [tokenData.id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        const newToken = (0, oauth_1.generateToken)({
            id: user.id,
            email: user.email,
            username: user.username,
            oauthProvider: user.oauth_provider
        });
        logger_1.logger.info('Token refreshed', { userId: user.id });
        res.status(200).json({
            token: newToken,
            refreshToken: refreshToken, // Return same refresh token
            expiresIn: 3600 // 1 hour
        });
    }
    catch (error) {
        logger_1.logger.error('Token refresh failed:', error);
        res.status(401).json({ error: 'Token refresh failed' });
    }
});
// GET /api/auth/callback/status - Poll for OAuth callback (for extensions)
router.get('/callback/status', (req, res) => {
    try {
        const { provider } = req.query;
        // Check if we have stored state and callback data
        const session = req.session || {};
        const oauthState = session.oauthState || {};
        const callbackData = req.oauthCallback;
        if (callbackData && callbackData.provider === provider) {
            // Return the callback data and clear it
            const response = {
                token: callbackData.token,
                refreshToken: callbackData.refreshToken || null,
                state: oauthState[provider] || null,
                user: callbackData.user
            };
            // Clear the callback data
            delete req.oauthCallback;
            return res.status(200).json(response);
        }
        // No callback data yet, return pending
        res.status(202).json({ pending: true });
    }
    catch (error) {
        logger_1.logger.error('Callback status check failed:', error);
        res.status(500).json({ error: 'Failed to check callback status' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map