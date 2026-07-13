// AES-256-GCM field-level encryption for TOTP secrets at rest.
// Key is 32 bytes (64 hex chars) from TOTP_ENCRYPTION_KEY env.
// Format: {12-byte-iv hex}:{ciphertext hex}:{16-byte-auth-tag hex}
// GCM provides authenticated encryption (confidentiality + integrity).

import crypto from 'crypto';
import config from './config.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export function encrypt(plaintext) {
  const key = Buffer.from(config.totpEncryptionKey, 'hex');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
}

export function decrypt(encoded) {
  const [ivHex, ciphertextHex, authTagHex] = encoded.split(':');
  const key = Buffer.from(config.totpEncryptionKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
