import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { logger } from '../utils/logger';
import {
  generateKeyPair,
  generateFingerprint,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
  EncryptedPayload
} from '../utils/encryption';
import { buildSocketUrl } from '../utils/api-config';

interface EncryptionSession {
  userId: string;
  userName: string;
  publicKey: string;
  fingerprint: string;
  verified: boolean;
  algorithm: 'nacl-box';
}

export class EncryptionManager {
  private encryptionEnabled = false;
  private localPublicKey: string | null = null;
  private localSecretKey: string | null = null;
  private remotePublicKeys: Map<string, EncryptionSession> = new Map();
  private verifiedFingerprints: Set<string> = new Set();

  constructor(
    private store: StateStore,
    private context: vscode.ExtensionContext
  ) {
    this.loadEncryptionState();
  }

  private async loadEncryptionState(): Promise<void> {
    try {
      const enabled = await this.context.secrets.get('pair-encryption-enabled');
      const publicKey = await this.context.secrets.get('pair-encryption-public-key');
      const secretKey = await this.context.secrets.get('pair-encryption-secret-key');
      const verifiedFps = await this.context.secrets.get('pair-verified-fingerprints');

      this.encryptionEnabled = enabled === 'true';
      this.localPublicKey = publicKey || null;
      this.localSecretKey = secretKey || null;

      if (verifiedFps) {
        try {
          const fps = JSON.parse(verifiedFps) as string[];
          this.verifiedFingerprints = new Set(fps);
        } catch {
          logger.warn('Failed to parse verified fingerprints');
        }
      }

      if (this.encryptionEnabled && (!this.localPublicKey || !this.localSecretKey)) {
        logger.warn('Encryption enabled but keys missing - regenerating');
        await this.generateLocalKeyPair();
      }

      logger.info('Encryption state loaded', { enabled: this.encryptionEnabled });
    } catch (error) {
      logger.error('Failed to load encryption state', { error });
    }
  }

  async generateLocalKeyPair(): Promise<{ publicKey: string; fingerprint: string } | null> {
    try {
      logger.info('Generating new encryption keypair');

      const keypair = generateKeyPair();
      const fingerprint = generateFingerprint(keypair.publicKey);

      // Store keys securely in VS Code secrets
      await this.context.secrets.store('pair-encryption-public-key', keypair.publicKey);
      await this.context.secrets.store('pair-encryption-secret-key', keypair.secretKey);
      await this.context.secrets.store('pair-encryption-enabled', 'true');

      this.localPublicKey = keypair.publicKey;
      this.localSecretKey = keypair.secretKey;
      this.encryptionEnabled = true;

      logger.info('Encryption keypair generated', { fingerprint });
      vscode.window.showInformationMessage(`🔐 Encryption enabled. Key fingerprint: ${fingerprint}`);

      return {
        publicKey: keypair.publicKey,
        fingerprint
      };
    } catch (error) {
      logger.error('Failed to generate keypair', { error });
      vscode.window.showErrorMessage(`Encryption setup failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async enableEncryption(): Promise<boolean> {
    if (!this.localPublicKey || !this.localSecretKey) {
      const result = await this.generateLocalKeyPair();
      return result !== null;
    }

    this.encryptionEnabled = true;
    await this.context.secrets.store('pair-encryption-enabled', 'true');
    logger.info('Encryption enabled');
    return true;
  }

  async disableEncryption(): Promise<void> {
    this.encryptionEnabled = false;
    await this.context.secrets.store('pair-encryption-enabled', 'false');
    logger.info('Encryption disabled');
  }

  isEncryptionEnabled(): boolean {
    return this.encryptionEnabled;
  }

  getLocalPublicKeyFingerprint(): string | null {
    if (!this.localPublicKey) return null;
    return generateFingerprint(this.localPublicKey);
  }

  addRemotePublicKey(userId: string, userName: string, publicKey: string): EncryptionSession {
    const fingerprint = generateFingerprint(publicKey);
    const verified = this.verifiedFingerprints.has(fingerprint);

    const session: EncryptionSession = {
      userId,
      userName,
      publicKey,
      fingerprint,
      verified,
      algorithm: 'nacl-box'
    };

    this.remotePublicKeys.set(userId, session);
    logger.debug('Remote public key added', { userId, fingerprint, verified });

    return session;
  }

  async verifyKeyFingerprint(userId: string, fingerprint: string): Promise<boolean> {
    const session = this.remotePublicKeys.get(userId);
    if (!session || session.fingerprint !== fingerprint) {
      logger.warn('Key fingerprint verification failed', { userId, provided: fingerprint, actual: session?.fingerprint });
      return false;
    }

    // Mark as verified
    this.verifiedFingerprints.add(fingerprint);
    session.verified = true;

    // Save verified fingerprints
    await this.context.secrets.store(
      'pair-verified-fingerprints',
      JSON.stringify(Array.from(this.verifiedFingerprints))
    );

    logger.info('Key fingerprint verified', { userId, fingerprint });
    vscode.window.showInformationMessage(`✅ Encryption key verified for ${session.userName}`);

    return true;
  }

  encryptMessage(message: string, recipientUserId: string): EncryptedPayload | null {
    if (!this.encryptionEnabled || !this.localSecretKey) {
      return null;
    }

    const remoteSession = this.remotePublicKeys.get(recipientUserId);
    if (!remoteSession) {
      logger.warn('No public key found for recipient', { userId: recipientUserId });
      return null;
    }

    try {
      const encrypted = encryptMessage(
        message,
        remoteSession.publicKey,
        this.localSecretKey
      );

      return encrypted;
    } catch (error) {
      logger.error('Message encryption failed', { error, recipientUserId });
      return null;
    }
  }

  decryptMessage(payload: EncryptedPayload, senderUserId: string): string | null {
    if (!this.encryptionEnabled || !this.localSecretKey) {
      return null;
    }

    const senderSession = this.remotePublicKeys.get(senderUserId);
    if (!senderSession) {
      logger.warn('No public key found for sender', { userId: senderUserId });
      return null;
    }

    try {
      const decrypted = decryptMessage(
        payload,
        senderSession.publicKey,
        this.localSecretKey
      );

      return decrypted;
    } catch (error) {
      logger.error('Message decryption failed', { error, senderId: senderUserId });
      return null;
    }
  }

  signMessage(message: string): string | null {
    if (!this.localSecretKey) return null;

    try {
      return signMessage(message, this.localSecretKey);
    } catch (error) {
      logger.error('Message signing failed', { error });
      return null;
    }
  }

  verifyMessageSignature(signatureBase64: string, senderUserId: string): string | null {
    const senderSession = this.remotePublicKeys.get(senderUserId);
    if (!senderSession) return null;

    try {
      return verifySignature(signatureBase64, senderSession.publicKey);
    } catch (error) {
      logger.error('Signature verification failed', { error });
      return null;
    }
  }

  getRemoteSession(userId: string): EncryptionSession | undefined {
    return this.remotePublicKeys.get(userId);
  }

  getAllRemoteSessions(): EncryptionSession[] {
    return Array.from(this.remotePublicKeys.values());
  }

  async rotateKeys(): Promise<{ publicKey: string; fingerprint: string } | null> {
    try {
      logger.info('Rotating encryption keys');

      // Generate new keypair
      const keypair = generateKeyPair();
      const fingerprint = generateFingerprint(keypair.publicKey);

      // Store new keys
      await this.context.secrets.store('pair-encryption-public-key', keypair.publicKey);
      await this.context.secrets.store('pair-encryption-secret-key', keypair.secretKey);

      this.localPublicKey = keypair.publicKey;
      this.localSecretKey = keypair.secretKey;

      // Clear remote sessions (must re-exchange keys with new keypair)
      this.remotePublicKeys.clear();

      logger.info('Keys rotated', { fingerprint });
      vscode.window.showInformationMessage('🔐 Encryption keys rotated. Please re-verify keys with collaborators.');

      return { publicKey: keypair.publicKey, fingerprint };
    } catch (error) {
      logger.error('Key rotation failed', { error });
      return null;
    }
  }

  dispose(): void {
    this.remotePublicKeys.clear();
    this.verifiedFingerprints.clear();
  }
}

export const createEncryptionManager = (store: StateStore, context: vscode.ExtensionContext) => {
  return new EncryptionManager(store, context);
};
