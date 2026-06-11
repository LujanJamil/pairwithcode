import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export interface OAuthConfig {
  provider: 'github' | 'gitlab' | 'google' | 'microsoft';
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface OAuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: string;
  providerId: string;
}

export class OAuthProvider {
  constructor(private pool: Pool, private jwtSecret: string) {}

  async upsertUser(oauthUser: OAuthUser): Promise<{ userId: string; token: string }> {
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
    const token = jwt.sign({ userId, provider: oauthUser.provider }, this.jwtSecret, {
      expiresIn: '7d',
    });

    return { userId, token };
  }

  async getUser(userId: string): Promise<any> {
    const query = 'SELECT id, name, email, avatar FROM users WHERE id = $1';
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async linkAccount(userId: string, oauthUser: OAuthUser): Promise<void> {
    const query = `
      INSERT INTO oauth_accounts (user_id, provider, provider_id, provider_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, provider) DO UPDATE SET provider_data = EXCLUDED.provider_data
    `;
    await this.pool.query(query, [userId, oauthUser.provider, oauthUser.providerId, JSON.stringify(oauthUser)]);
  }
}
