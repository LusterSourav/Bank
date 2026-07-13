import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, unique: true, required: true },
  email: String,
  name: String,
  emailVerified: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    aadhaarRef: String,
    aadhaarMasked: String,
    aadhaarVerified: { type: Boolean, default: false },
    panMasked: String,
    panVerified: { type: Boolean, default: false },
    panNameMatches: Boolean,
    panDobMatches: Boolean,
    verifiedName: String,
    verifiedDob: String,
    verifiedGender: String,
    verifiedAddress: String,
    nameMatchScore: Number,
    dobMatch: Boolean,
    recommendation: String,
    emailVerified: { type: Boolean, default: false },
    kycStartTime: Date,
    verifiedAt: Date,
  },
  // TOTP
  totpSecret: String, // encrypted with AES-256-GCM before storage
  totpEnabled: { type: Boolean, default: false },
  backupCodes: [{ // bcrypt hashes, never stored as plaintext
    hash: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedAt: Date,
  }],
  // WebAuthn
  webauthnCredentials: [{
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: [String],
    deviceName: String,
    registeredAt: { type: Date, default: Date.now },
  }],
  webauthnChallenge: String,
  // Device fingerprints (hash only)
  deviceFingerprints: [{
    hash: String,
    firstSeen: Date,
    lastSeen: Date,
  }],
  lastLogin: Date,
  // ponytail: user-overridable daily limit, default 100K
  sendLimit: { type: Number, default: 100000 },
  phone: String,
  notifyWhatsApp: { type: Boolean, default: false },
}, { timestamps: true });

const txSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'send'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'inr' },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  stripeId: String,
  razorpayId: String,
  recipient: String,
}, { timestamps: true });

const beneficiarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  ifsc: String,
  accountNumber: String,
  currency: { type: String, default: 'inr' },
}, { timestamps: true });

const otpSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: String,
  codeHash: { type: String, required: true },
  type: { type: String, enum: ['email_kyc', 'email_verify'], required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Transaction = mongoose.model('Transaction', txSchema);
export const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);
export const Otp = mongoose.model('Otp', otpSchema);
