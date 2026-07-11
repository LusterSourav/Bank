import admin from 'firebase-admin';
import config from './config.js';

// ponytail: wrapped in try-catch so a bad key doesn't crash the function
let adminInitialized = false;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
  }
  adminInitialized = true;
} catch (e) {
  console.error('Firebase init error:', e.message);
}

export async function auth(req, res, next) {
  if (!adminInitialized) return res.status(500).json({ error: 'auth service unavailable' });

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });

  try {
    const claims = await admin.auth().verifyIdToken(header.slice(7));
    req.userId = claims.uid;
    req.userEmail = claims.email || '';
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}
