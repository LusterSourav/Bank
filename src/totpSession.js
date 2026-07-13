import jwt from 'jsonwebtoken';
import config from './config.js';

// TOTP session — sent via X-Totp-Token, used for settings/sensitive routes
export function signTotpSession(userId) {
  return jwt.sign({ sub: userId, totp: true }, config.totpSessionSecret, { expiresIn: '1h' });
}
export function verifyTotpSession(token) {
  return jwt.verify(token, config.totpSessionSecret);
}

// WebAuthn session — sent via X-Webauthn-Token, used for dashboard biometric gate
export function signWebauthnSession(userId) {
  return jwt.sign({ sub: userId, webauthn: true }, config.totpSessionSecret, { expiresIn: '1h' });
}
export function verifyWebauthnSession(token) {
  return jwt.verify(token, config.totpSessionSecret);
}
