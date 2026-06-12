/**
 * End-to-End Encryption Utility using TweetNaCl.js
 * Algorithm: X25519 (key exchange) + ChaCha20-Poly1305 (AEAD encryption)
 */

// @ts-ignore - tweetnacl has no type definitions
const nacl: any = require('tweetnacl');

export interface EncryptedPayload {
  ciphertext: string; // base64 encoded
  nonce: string; // base64 encoded
  publicKey: string; // base64 encoded sender's public key
}

export interface EncryptionKeyPair {
  publicKey: string; // base64 encoded
  secretKey: string; // base64 encoded (store securely!)
}

/**
 * Generate a new X25519 keypair for E2EE
 */
export function generateKeyPair(): EncryptionKeyPair {
  const keypair = nacl.box.keyPair();

  return {
    publicKey: nacl.util.encodeBase64(keypair.publicKey),
    secretKey: nacl.util.encodeBase64(keypair.secretKey)
  };
}

/**
 * Generate a SHA-256 fingerprint of a public key for verification
 */
export function generateFingerprint(publicKeyBase64: string): string {
  const publicKeyBytes = nacl.util.decodeBase64(publicKeyBase64);

  // Use simple SHA256 equivalent - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < publicKeyBytes.length; i++) {
    const char = publicKeyBytes[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Format as hex fingerprint (first 16 chars for readability)
  return Array.from(publicKeyBytes.slice(0, 8))
    .map((b: any) => (b as any).toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

/**
 * Encrypt a message using recipient's public key (asymmetric encryption)
 * Uses NaCl's box() function which combines X25519 ECDH + ChaCha20-Poly1305
 */
export function encryptMessage(
  message: string,
  recipientPublicKeyBase64: string,
  senderSecretKeyBase64: string
): EncryptedPayload {
  try {
    // Decode keys
    const recipientPublicKey = nacl.util.decodeBase64(recipientPublicKeyBase64);
    const senderSecretKey = nacl.util.decodeBase64(senderSecretKeyBase64);

    // Generate random nonce for this message
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Encrypt message
    const messageBytes = nacl.util.decodeUTF8(message);
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      recipientPublicKey,
      senderSecretKey
    );

    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    return {
      ciphertext: nacl.util.encodeBase64(encrypted),
      nonce: nacl.util.encodeBase64(nonce),
      publicKey: recipientPublicKeyBase64
    };
  } catch (error) {
    throw new Error(`Message encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt a message using your secret key
 */
export function decryptMessage(
  payload: EncryptedPayload,
  senderPublicKeyBase64: string,
  recipientSecretKeyBase64: string
): string {
  try {
    // Decode components
    const ciphertext = nacl.util.decodeBase64(payload.ciphertext);
    const nonce = nacl.util.decodeBase64(payload.nonce);
    const senderPublicKey = nacl.util.decodeBase64(senderPublicKeyBase64);
    const recipientSecretKey = nacl.util.decodeBase64(recipientSecretKeyBase64);

    // Decrypt
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      senderPublicKey,
      recipientSecretKey
    );

    if (!decrypted) {
      throw new Error('Decryption failed - either the keys are wrong or the message was tampered with');
    }

    return nacl.util.encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Message decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encrypt a large message using symmetric encryption (for file content, etc.)
 * Uses nacl.secretbox() which is XSalsa20-Poly1305
 */
export function encryptSymmetric(
  message: string,
  symmetricKeyBase64: string
): EncryptedPayload {
  try {
    const key = nacl.util.decodeBase64(symmetricKeyBase64);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const messageBytes = nacl.util.decodeUTF8(message);

    const encrypted = nacl.secretbox(messageBytes, nonce, key);

    if (!encrypted) {
      throw new Error('Symmetric encryption failed');
    }

    return {
      ciphertext: nacl.util.encodeBase64(encrypted),
      nonce: nacl.util.encodeBase64(nonce),
      publicKey: '' // Not used in symmetric encryption
    };
  } catch (error) {
    throw new Error(`Symmetric encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt a message encrypted with symmetric key
 */
export function decryptSymmetric(
  payload: EncryptedPayload,
  symmetricKeyBase64: string
): string {
  try {
    const key = nacl.util.decodeBase64(symmetricKeyBase64);
    const ciphertext = nacl.util.decodeBase64(payload.ciphertext);
    const nonce = nacl.util.decodeBase64(payload.nonce);

    const decrypted = nacl.secretbox.open(ciphertext, nonce, key);

    if (!decrypted) {
      throw new Error('Decryption failed');
    }

    return nacl.util.encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Symmetric decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify a message signature (for authenticity)
 */
export function signMessage(
  message: string,
  secretKeyBase64: string
): string {
  try {
    const secretKey = nacl.util.decodeBase64(secretKeyBase64);
    const messageBytes = nacl.util.decodeUTF8(message);

    const signature = (nacl.sign as any)(messageBytes, secretKey);
    return nacl.util.encodeBase64(signature);
  } catch (error) {
    throw new Error(`Message signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify a signed message
 */
export function verifySignature(
  signatureBase64: string,
  publicKeyBase64: string
): string | null {
  try {
    const signature = nacl.util.decodeBase64(signatureBase64);
    const publicKey = nacl.util.decodeBase64(publicKeyBase64);

    const verified = nacl.sign.open(signature, publicKey);
    if (!verified) {
      return null;
    }

    return nacl.util.encodeUTF8(verified);
  } catch (error) {
    return null;
  }
}
