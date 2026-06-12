"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthProvider = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class OAuthProvider {
    pool;
    jwtSecret;
    constructor(pool, jwtSecret) {
        this.pool = pool;
        this.jwtSecret = jwtSecret;
    }
    async upsertUser(oauthUser) {
        const query = `
      INSERT INTO users (name, email, avatar, oauth_provider, oauth_provider_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (oauth_provider, oauth_provider_id)
      DO UPDATE SET 
        avatar = EXCLUDED.avatar,
        last_login = NOW()
      RETURNING id
    `;
        const result = await this.pool.query(query, [
            oauthUser.name,
            oauthUser.email,
            oauthUser.avatar,
            oauthUser.provider,
            oauthUser.providerId,
        ]);
        const userId = result.rows[0].id;
        const token = jsonwebtoken_1.default.sign({ userId, provider: oauthUser.provider }, this.jwtSecret, {
            expiresIn: '7d',
        });
        return { userId, token };
    }
    async getUser(userId) {
        const query = 'SELECT id, name, email, avatar FROM users WHERE id = $1';
        const result = await this.pool.query(query, [userId]);
        return result.rows[0] || null;
    }
    async linkAccount(userId, oauthUser) {
        const query = `
      INSERT INTO oauth_accounts (user_id, provider, provider_id, provider_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, provider) DO UPDATE SET provider_data = EXCLUDED.provider_data
    `;
        await this.pool.query(query, [userId, oauthUser.provider, oauthUser.providerId, JSON.stringify(oauthUser)]);
    }
}
exports.OAuthProvider = OAuthProvider;
//# sourceMappingURL=oauth-provider.js.map