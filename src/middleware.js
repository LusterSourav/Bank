// Privy client singleton and Express auth middleware.
// Extracts Bearer token, verifies via Privy, sets req.userId on success.
// ponytail: no refresh logic, no session cache. The Privy SDK handles token
//           expiry internally. Add Redis-backed session cache if token verification
//           latency becomes measurable.
import { PrivyClient } from '@privy-io/server-auth';
import config from './config.js';

export const privy = new PrivyClient(config.privy.appId, config.privy.appSecret);

export async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });

  try {
    const claims = await privy.verifyAuthToken(header.slice(7));
    req.userId = claims.userId;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}
