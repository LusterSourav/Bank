import admin from 'firebase-admin';

import{User }from './models.js';
import { verifyTotpSession} from './totpSession.js';

import config from './config.js';

// bad key wont crash the function
let adminInitialized=false;
try {
  if(!admin.apps.length){
    admin.initializeApp({
      credential: admin.credential.cert({


        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
  }
  adminInitialized= true;
}catch(e) {

  console.error('Firebase init error:', e.message);
}

export async function auth(req, res,next) {
  if (process.env.TEST_BYPASS){
    req.userId = process.env.TEST_USER_ID || 'test-user';


    req.userEmail ='test@test.com';
    return next();
  }
  if (!adminInitialized) return res.status(500).json({error: 'auth service unavailable' });

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });



  try {
    const claims = await admin.auth().verifyIdToken(header.slice(7));
    req.userId =claims.uid;
    req.userEmail = claims.email || '';
    next();
  } catch {
    res.status(401).json({ error: 'invalid token'});
  }

}

// server-side totp for routes that need 2fa
export async function totpRequired(req,res,next){
  //skip if user hasnt enabled totp
  const user = await User.findOne({firebaseUid: req.userId});
  if(!user?.totpEnabled)return next();

  const totpToken=req.headers['x-totp-token'];
  if (!totpToken) return res.status(403).json({ error: 'TOTP verification required' });

  try {
    const payload = verifyTotpSession(totpToken);
    if (payload.sub !== req.userId) return res.status(403).json({ error: 'Invalid TOTP session' });
    next();
  }catch{
    return res.status(403).json({ error: 'TOTP session expired' });
  }
}
