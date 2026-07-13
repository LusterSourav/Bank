import admin from 'firebase-admin';
import { User } from './models.js';
import { verifyTotpSession } from './totpSession.js';
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

// Server-side TOTP enforcement. Checks X-Totp-Token header for routes
// that need second-factor verification.
export async function totpRequired(req, res, next) {
  // skip if TOTP not enabled for this user
  const user = await User.findOne({ firebaseUid: req.userId });
  if (!user?.totpEnabled) return next();

  const totpToken = req.headers['x-totp-token'];
  if (!totpToken) return res.status(403).json({ error: 'TOTP verification required' });

  try {
    const payload = verifyTotpSession(totpToken);
    if (payload.sub !== req.userId) return res.status(403).json({ error: 'Invalid TOTP session' });
    next();
  } catch {
    return res.status(403).json({ error: 'TOTP session expired' });
  }
}
