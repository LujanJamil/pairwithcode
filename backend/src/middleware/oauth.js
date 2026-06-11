"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeGitLabCode = exports.exchangeGitHubCode = exports.requireAuth = exports.generateToken = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        req.token = token;
        next();
    }
    catch (error) {
        logger_1.logger.error('Token verification failed:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.verifyToken = verifyToken;
// Middleware to generate JWT token
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        username: user.username,
        oauthProvider: user.oauthProvider,
        oauthId: user.oauthId
    }, JWT_SECRET, { expiresIn: '30d' });
};
exports.generateToken = generateToken;
// Optional: Middleware for routes that require authentication
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};
exports.requireAuth = requireAuth;
// Parse GitHub OAuth code and exchange for token
const exchangeGitHubCode = async (code) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('GitHub OAuth credentials not configured');
    }
    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code
            })
        });
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(tokenData.error_description);
        }
        const accessToken = tokenData.access_token;
        // Fetch user profile
        const profileResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const profile = await profileResponse.json();
        return {
            accessToken,
            profile: {
                id: profile.id.toString(),
                login: profile.login,
                email: profile.email || '',
                avatar_url: profile.avatar_url
            }
        };
    }
    catch (error) {
        logger_1.logger.error('GitHub OAuth exchange failed:', error);
        throw error;
    }
};
exports.exchangeGitHubCode = exchangeGitHubCode;
// Parse GitLab OAuth code
const exchangeGitLabCode = async (code) => {
    const clientId = process.env.GITLAB_CLIENT_ID;
    const clientSecret = process.env.GITLAB_CLIENT_SECRET;
    const redirectUri = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/auth/gitlab/callback';
    if (!clientId || !clientSecret) {
        throw new Error('GitLab OAuth credentials not configured');
    }
    try {
        const tokenResponse = await fetch('https://gitlab.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        });
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(tokenData.error_description);
        }
        const accessToken = tokenData.access_token;
        // Fetch user profile
        const profileResponse = await fetch('https://gitlab.com/api/v4/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const profile = await profileResponse.json();
        return {
            accessToken,
            profile: {
                id: profile.id.toString(),
                username: profile.username,
                email: profile.email,
                avatar_url: profile.avatar_url
            }
        };
    }
    catch (error) {
        logger_1.logger.error('GitLab OAuth exchange failed:', error);
        throw error;
    }
};
exports.exchangeGitLabCode = exchangeGitLabCode;
//# sourceMappingURL=oauth.js.map