import { Router } from 'express';
import { auth } from './middleware.js';
import { User } from './models.js';
import { generateSecret, generateQrDataUrl, verifyToken } from './totp.js';
import { createRegistrationOptions, verifyRegistration, createAuthenticationOptions, verifyAuthentication, getRpId, getOrigin } from './webauthn.js';
import store from './fraud/store.js';

const router = Router();

// ─── TOTP ─────────────────────────────────────────────────────────

router.post('/totp/setup', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    const { secret, url } = generateSecret(user._id.toString());
    const qrDataUrl = await generateQrDataUrl(url);
    // ponytail: store temp until verified, then mark enabled
    await User.updateOne({ firebaseUid: req.userId }, { $set: { totpSecret: secret, totpEnabled: false } });
    res.json({ qrDataUrl, secret });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/verify-enable', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.totpSecret) return res.status(400).json({ error: 'TOTP not set up' });

    if (!verifyToken(user.totpSecret, token)) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    await User.updateOne({ firebaseUid: req.userId }, { $set: { totpEnabled: true } });
    res.json({ status: 'enabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: 'TOTP not enabled' });
    }

    // ponytail: rate limit TOTP attempts — 5 per 15 min
    const attempts = store.increment(`totp:${user._id}`, 900000);
    if (store.get(`totp:${user._id}`) > 5) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    if (!verifyToken(user.totpSecret, token)) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    store.delete(`totp:${user._id}`);
    res.json({ status: 'verified', expiresIn: 3600 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/disable', auth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ firebaseUid: req.userId });

    if (user.totpEnabled && user.totpSecret) {
      if (!token || !verifyToken(user.totpSecret, token)) {
        return res.status(400).json({ error: 'Valid token required to disable TOTP' });
      }
    }

    await User.updateOne({ firebaseUid: req.userId }, {
      $unset: { totpSecret: '' },
      $set: { totpEnabled: false },
    });
    res.json({ status: 'disabled' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/totp/status', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    res.json({ enabled: !!user.totpEnabled, hasSecret: !!user.totpSecret });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WebAuthn ─────────────────────────────────────────────────────

router.post('/webauthn/register/begin', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    const email = user.email || user._id.toString();
    const existing = user.webauthnCredentials || [];
    const options = await createRegistrationOptions(user._id.toString(), email, existing);

    await User.updateOne({ firebaseUid: req.userId }, { $set: { webauthnChallenge: options.challenge } });
    res.json(options);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/webauthn/register/complete', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.webauthnChallenge) return res.status(400).json({ error: 'No registration in progress' });

    const verification = await verifyRegistration(
      user._id.toString(),
      req.body,
      user.webauthnChallenge,
    );

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'WebAuthn registration failed' });
    }

    const { credential } = verification.registrationInfo;

    await User.updateOne({ firebaseUid: req.userId }, {
      $push: {
        webauthnCredentials: {
          credentialId: Buffer.from(credential.id).toString('base64url'),
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: req.body.response?.transports || [],
          deviceName: req.body.deviceName || 'Unknown device',
          registeredAt: new Date(),
        },
      },
      $unset: { webauthnChallenge: '' },
    });

    res.json({ status: 'registered' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/webauthn/credentials', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    const creds = (user.webauthnCredentials || []).map(c => ({
      id: c.credentialId,
      deviceName: c.deviceName,
      registeredAt: c.registeredAt,
    }));
    res.json({ credentials: creds, rpId: getRpId(), origin: getOrigin() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/webauthn/authenticate/begin', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    const existing = user.webauthnCredentials || [];
    const options = await createAuthenticationOptions(existing);

    await User.updateOne({ firebaseUid: req.userId }, { $set: { webauthnChallenge: options.challenge } });
    res.json(options);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/webauthn/authenticate/complete', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.webauthnChallenge) return res.status(400).json({ error: 'No authentication in progress' });

    // Find matching credential
    const credentialId = req.body.id;
    const storedCred = (user.webauthnCredentials || []).find(
      c => Buffer.from(c.credentialId, 'base64url').toString('base64url') === credentialId
    );
    if (!storedCred) return res.status(400).json({ error: 'Credential not found' });

    const credential = {
      id: Buffer.from(storedCred.credentialId, 'base64url'),
      publicKey: Buffer.from(storedCred.publicKey, 'base64url'),
      counter: storedCred.counter,
      transports: storedCred.transports || [],
    };

    const verification = await verifyAuthentication(req.body, user.webauthnChallenge, credential);

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    // Update counter
    await User.updateOne(
      { firebaseUid: req.userId, 'webauthnCredentials.credentialId': storedCred.credentialId },
      { $set: { 'webauthnCredentials.$.counter': verification.authenticationInfo?.newCounter || storedCred.counter } },
    );
    await User.updateOne({ firebaseUid: req.userId }, { $unset: { webauthnChallenge: '' } });

    res.json({ status: 'authenticated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/webauthn/credentials/:id', auth, async (req, res) => {
  try {
    await User.updateOne(
      { firebaseUid: req.userId },
      { $pull: { webauthnCredentials: { credentialId: req.params.id } } },
    );
    res.json({ status: 'removed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Device fingerprint ───────────────────────────────────────────

router.get('/device/fingerprints', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    res.json({ devices: user.deviceFingerprints || [] });
  } catch (e) {
    console.error('device/fingerprints error:', e.message);
    res.status(500).json({ error: 'failed to get devices' });
  }
});

router.post('/device/fingerprint', auth, async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: 'Hash required' });

    const user = await User.findOne({ firebaseUid: req.userId });
    const existing = (user.deviceFingerprints || []).find(d => d.hash === hash);
    const now = new Date();

    if (existing) {
      await User.updateOne(
        { firebaseUid: req.userId, 'deviceFingerprints.hash': hash },
        { $set: { 'deviceFingerprints.$.lastSeen': now } },
      );
    } else {
      await User.updateOne(
        { firebaseUid: req.userId },
        { $push: { deviceFingerprints: { hash, firstSeen: now, lastSeen: now } } },
      );
    }

    res.json({ status: 'recorded' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
