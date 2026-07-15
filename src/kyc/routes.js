import { Router } from 'express';
import { auth } from '../middleware.js';
import { User, Otp } from '../models.js';
import { generateAadhaarOtp, verifyAadhaarOtp, verifyPan, maskAadhaar, validateAadhaar } from './provider.js';
import { checkKycVelocity, checkKycTiming } from './fraud.js';
import { crossVerify } from './nameMatch.js';
import { generateOtp, hashOtp, verifyOtpHash, otpExpiry } from '../otp.js';
import { sendEmailNotification } from '../notifications.js';
import store from '../fraud/store.js';
import { scoreIp, isHighRisk } from '../fraud/ip.js';

const router = Router();

// Step 1: Send Aadhaar OTP
router.post('/kyc/aadhaar/send-otp', auth, async (req, res) => {
  try {
    const { aadhaarNumber } = req.body;
    if (!aadhaarNumber) return res.status(400).json({ error: 'Aadhaar number required' });

    // Fraud checks — device velocity + IP scoring
    const user = await User.findOne({ firebaseUid: req.userId });

    // Device velocity (old check using existing fraud module)
    const velocity = checkKycVelocity(user._id, req.headers['x-device-fingerprint'], req.ip);
    if (velocity.block) return res.status(429).json({ error: velocity.reason });

    // IP fraud scoring via IPASIS
    const ipResult = await scoreIp(req.ip);
    if (isHighRisk(ipResult)) {
      store.append(`kyc:ip_block:${user._id}`, { ip: req.ip, reason: 'high_risk_ip' });
      return res.status(403).json({ error: 'KYC not available from this network. Use a regular connection.' });
    }

    // Store IP info for audit
    store.append(`kyc:ip:${user._id}`, { ip: req.ip, score: ipResult.score, country: ipResult.country, asn: ipResult.asn });

    // Aadhaar checksum
    if (!validateAadhaar(aadhaarNumber)) {
      return res.status(400).json({ error: 'Invalid Aadhaar number' });
    }

    const result = await generateAadhaarOtp(aadhaarNumber);

    // Store reference
    await User.updateOne({ firebaseUid: req.userId }, {
      $set: {
        'kyc.status': 'pending',
        'kyc.aadhaarRef': result.referenceId,
        'kyc.aadhaarMasked': maskAadhaar(aadhaarNumber),
        'kyc.kycStartTime': new Date(),
      }
    });

    res.json({ referenceId: result.referenceId, message: result.message });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Step 2: Verify Aadhaar OTP
router.post('/kyc/aadhaar/verify-otp', auth, async (req, res) => {
  try {
    const { referenceId, otp } = req.body;
    if (!referenceId || !otp) return res.status(400).json({ error: 'Reference ID and OTP required' });

    const aadhaarResult = await verifyAadhaarOtp(referenceId, otp);

    const user = await User.findOne({ firebaseUid: req.userId });
    await User.updateOne({ firebaseUid: req.userId }, {
      $set: {
        'kyc.verifiedName': aadhaarResult.name,
        'kyc.verifiedDob': aadhaarResult.dateOfBirth,
        'kyc.verifiedGender': aadhaarResult.gender,
        'kyc.verifiedAddress': `${aadhaarResult.address.house}, ${aadhaarResult.address.street}, ${aadhaarResult.address.city}, ${aadhaarResult.address.state} - ${aadhaarResult.address.pincode}`,
        'kyc.aadhaarVerified': true,
      }
    });

    res.json({ status: 'aadhaar_verified', name: aadhaarResult.name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Step 3: Verify PAN
router.post('/kyc/pan/verify', auth, async (req, res) => {
  try {
    const { panNumber, name } = req.body;
    if (!panNumber || !name) return res.status(400).json({ error: 'PAN number and name required' });

    // ponytail: use Aadhaar-verified DOB for PAN match — avoids asking user twice
    const user = await User.findOne({ firebaseUid: req.userId });
    const dob = user.kyc?.verifiedDob || '';
    const panResult = await verifyPan(panNumber.toUpperCase(), name, dob);
    if (!panResult.valid) return res.status(400).json({ error: panResult.status });

    await User.updateOne({ firebaseUid: req.userId }, {
      $set: {
        'kyc.panMasked': panResult.panMasked,
        'kyc.panVerified': true,
        'kyc.panNameMatches': panResult.nameMatches,
        'kyc.panDobMatches': panResult.dobMatches,
      }
    });

    res.json({ status: 'pan_verified', panMasked: panResult.panMasked });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Step 4: Cross-document verification + finalize
router.post('/kyc/finalize', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.kyc.aadhaarVerified || !user.kyc.panVerified) {
      return res.status(400).json({ error: 'Complete Aadhaar and PAN verification first' });
    }

    const crossResult = crossVerify(
      { name: user.kyc.verifiedName, dob: user.kyc.verifiedDob },
      { name: req.body.name || user.kyc.verifiedName, dob: user.kyc.verifiedDob, aadhaarLinked: true }
    );

    // Timing check
    const timing = checkKycTiming(user.kyc.kycStartTime, new Date());

    let status;
    if (crossResult.recommendation === 'APPROVE') {
      status = 'verified';
    } else if (crossResult.recommendation === 'MANUAL_REVIEW') {
      status = 'pending';
    } else {
      status = 'rejected';
    }

    await User.updateOne({ firebaseUid: req.userId }, {
      $set: {
        'kyc.status': status,
        'kyc.verifiedAt': new Date(),
        'kyc.nameMatchScore': crossResult.nameMatch.score,
        'kyc.dobMatch': crossResult.dobMatch,
        'kyc.recommendation': crossResult.recommendation,
      },
      $unset: { 'kyc.kycStartTime': '' },
    });

    res.json({ status, recommendation: crossResult.recommendation, nameMatch: crossResult.nameMatch });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Step 5: Send email OTP for KYC binding
router.post('/kyc/email/send-otp', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user.email) return res.status(400).json({ error: 'No email on file' });

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    // Invalidate old OTPs
    await Otp.deleteMany({ userId: user._id, type: 'email_kyc' });

    await Otp.create({
      userId: user._id,
      email: user.email,
      codeHash: otpHash,
      type: 'email_kyc',
      expiresAt: otpExpiry(5),
    });

    // Fire-and-forget email
    sendEmailNotification(user.email, 'Verify your email', `
      <p>Your verification code is:</p>
      <h2 style="letter-spacing:4px;font-family:monospace">${otp}</h2>
      <p>This code expires in 5 minutes.</p>
    `);

    res.json({ message: 'OTP sent to email' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Step 6: Verify email OTP
router.post('/kyc/email/verify-otp', auth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP required' });

    const user = await User.findOne({ firebaseUid: req.userId });
    const record = await Otp.findOne({
      userId: user._id,
      type: 'email_kyc',
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ error: 'No valid OTP found. Request a new one.' });
    if (record.attempts >= 3) {
      await Otp.deleteMany({ userId: user._id, type: 'email_kyc' });
      return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
    }

    const valid = await verifyOtpHash(otp, record.codeHash);
    if (!valid) {
      await Otp.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Mark verified
    await Otp.updateOne({ _id: record._id }, { used: true });
    await User.updateOne({ firebaseUid: req.userId }, {
      $set: { 'kyc.emailVerified': true, emailVerified: true },
    });

    res.json({ status: 'email_verified' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get KYC status
router.get('/kyc/status', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    const k = user.kyc || {};
    res.json({
      status: k.status || 'none',
      aadhaarVerified: !!k.aadhaarVerified,
      panVerified: !!k.panVerified,
      emailVerified: !!k.emailVerified || !!user.emailVerified,
      verifiedName: k.verifiedName,
      verifiedDob: k.verifiedDob,
      verifiedAddress: k.verifiedAddress,
      aadhaarMasked: k.aadhaarMasked,
      panMasked: k.panMasked,
      verifiedAt: k.verifiedAt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
