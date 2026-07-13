import { TOTP } from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const APP_NAME = 'Sendly';
const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5; // 5 bytes = 10 hex chars → formatted as XXXX-XXXX

export function generateSecret(userId) {
  const secret = crypto.randomBytes(20).toString('base64url');
  const totp = new TOTP({
    issuer: APP_NAME,
    label: userId,
    secret,
    digits: 6,
    period: 30,
  });
  return { secret, url: totp.toString() };
}

export async function generateQrDataUrl(url) {
  return QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
}

export function verifyToken(secret, token) {
  const totp = new TOTP({
    issuer: APP_NAME,
    label: 'verify',
    secret,
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// generates 10 single-use backup codes in XXXX-XXXX format
// codes returned as plaintext (shown once to user), hashes stored via bcrypt
// ponytail: bcrypt cost 10, fast enough for batch gen, slow enough for offline attacks
export async function generateBackupCodes() {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(BACKUP_CODE_BYTES);
    const code = bytes.toString('hex').toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
    codes.push(code);
    hashes.push(await bcrypt.hash(code, BCRYPT_ROUNDS));
  }
  return { codes, hashes };
}

// ponytail: iterates over all unused codes, bcrypt.compare is slow so no timing leak per code
// caller must mark the matched code as used
export async function verifyBackupCode(user, code) {
  const normalized = code.toUpperCase().trim();
  for (const entry of user.backupCodes || []) {
    if (entry.used) continue;
    if (await bcrypt.compare(normalized, entry.hash)) {
      return true;
    }
  }
  return false;
}
