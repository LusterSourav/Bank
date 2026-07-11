// ponytail: email OTP generation + verification for KYC binding.
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export function generateOtp(length = 6) {
  const max = Math.pow(10, length);
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

export async function hashOtp(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

export async function verifyOtpHash(otp, hash) {
  return bcrypt.compare(otp, hash);
}

export function otpExpiry(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
