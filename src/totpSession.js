// JWT-based TOTP session tokens. Signed server-side after TOTP verification.
// Sent via X-Totp-Token header on sensitive routes.

import jwt from 'jsonwebtoken';
import config from './config.js';

export function signTotpSession(userId) {
  return jwt.sign({ sub: userId, totp: true }, config.totpSessionSecret, { expiresIn: '1h' });
}

export function verifyTotpSession(token) {
  return jwt.verify(token, config.totpSessionSecret);
}
