import jwt from 'jsonwebtoken';

import config from './config.js';

//totp session — sent via X-Totp-Token for settings/sensitive routes
export function signTotpSession(userId){
  return jwt.sign({sub: userId,totp: true},config.totpSessionSecret,{expiresIn: '1h'});
}

export function verifyTotpSession(token){
  const payload=jwt.verify(token,config.totpSessionSecret);
  if (!payload.totp)throw new Error('Not a TOTP session');

  return payload;


}

// webauthn session — sent via X-Webauthn-Token for dashboard biometric gate
export function signWebauthnSession(userId){
  return jwt.sign({ sub: userId,webauthn: true}, config.totpSessionSecret, {expiresIn: '1h'});
}


