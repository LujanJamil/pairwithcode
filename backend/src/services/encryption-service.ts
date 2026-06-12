import { Pool } from 'pg';
import crypto from 'crypto';

export class EncryptionService {
  constructor(
    private pool: Pool,
    private masterKey: string
  ) {}

  encryptMessage(plaintext: string, publicKey: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.masterKey, 'hex'), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return JSON.stringify({ iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted });
  }

  decryptMessage(encryptedData: string): string {
    const parsed = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.masterKey, 'hex'), Buffer.from(parsed.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async storeEncryptedKey(userId: string, keyData: any): Promise<void> {
    const encrypted = this.encryptMessage(JSON.stringify(keyData), '');
    const query = 'INSERT INTO user_encryption_keys (user_id, key_data) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET key_data = EXCLUDED.key_data';
    await this.pool.query(query, [userId, encrypted]);
  }

  async getEncryptedKey(userId: string): Promise<any> {
    const query = 'SELECT key_data FROM user_encryption_keys WHERE user_id = $1';
    const result = await this.pool.query(query, [userId]);
    if (result.rows[0]) {
      const decrypted = this.decryptMessage(result.rows[0].key_data);
      return JSON.parse(decrypted);
    }
    return null;
  }

  rotateKeys(): { oldKey: string; newKey: string } {
    const newKey = crypto.randomBytes(32).toString('hex');
    return { oldKey: this.masterKey, newKey };
  }
}
