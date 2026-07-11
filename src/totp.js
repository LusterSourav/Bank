import { TOTP } from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const APP_NAME = 'Sendly';

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
