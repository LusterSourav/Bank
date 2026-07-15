import jwt from 'jsonwebtoken';


import config from './config.js';

// TOTP session — sent via X-Totp-Token, used for settings/sensitive routes
export function signTotpSession(userId){


  return jwt.sign({sub: userId,totp: true },config.totpSessionSecret,{expiresIn: '1h'});
}
export function verifyTotpSession(token){
  const payload =jwt.verify(token,config.totpSessionSecret);




  if (!payload.totp) throw new Error('Not a TOTP session');
  return payload;
}

// WebAuthn session — sent via X-Webauthn-Token, used for dashboard biometric gate
export function signWebauthnSession(userId) {


  return jwt.sign({sub: userId,webauthn: true}, config.totpSessionSecret, {expiresIn: '1h'});
}


function verifyWebauthnSession(token){
  const payload= jwt.verify(token, config.totpSessionSecret);




  if (!payload.webauthn)throw new Error('Not a WebAuthn session');
  return payload;
}
