// ponytail: in-memory velocity + fraud checks. Move to Redis for production.
import { validateAadhaar } from './provider.js';

const store = {};

function cleanup(key, windowMs) {
  if (!store[key]) store[key] = [];
  store[key] = store[key].filter(t => Date.now() - t < windowMs);
}

export function checkKycVelocity(userId, deviceFingerprint, ip) {
  const now = Date.now();
  const DAY = 86400000;
  const HOUR = 3600000;

  // Per user: max 3 KYC attempts per day
  const userKey = `kyc:u:${userId}`;
  cleanup(userKey, DAY);
  store[userKey].push(now);
  if (store[userKey].length > 3) return { block: true, reason: 'too_many_kyc_attempts' };

  // Per device: max 2 accounts per day (mule factory detection)
  if (deviceFingerprint) {
    const devKey = `kyc:d:${deviceFingerprint}`;
    cleanup(devKey, DAY);
    store[devKey].push({ userId, time: now });
    const users = new Set(store[devKey].map(e => e.userId));
    if (users.size > 2) return { block: true, reason: 'device_multi_account' };
  }

  // Per IP: max 3 accounts per day
  if (ip) {
    const ipKey = `kyc:i:${ip}`;
    cleanup(ipKey, DAY);
    store[ipKey].push({ userId, time: now });
    const users = new Set(store[ipKey].map(e => e.userId));
    if (users.size > 3) return { flag: true, reason: 'ip_multi_account' };
  }

  return { ok: true };
}

export function checkKycTiming(startTime, endTime) {
  const seconds = (endTime - startTime) / 1000;
  if (seconds < 30) return { flag: true, reason: 'bot_speed', seconds };
  return { ok: true, seconds };
}

export function validateAadhaarChecksum(uid) {
  return validateAadhaar(uid);
}

// ponytail: simple rate limit for OTP endpoints
const otpRate = {};

export function checkOtpRate(key, maxAttempts = 5, windowMs = 900000) {
  cleanup.call(null, key, windowMs); // won't work, use inline
  if (!otpRate[key]) otpRate[key] = [];
  otpRate[key] = otpRate[key].filter(t => Date.now() - t < windowMs);
  if (otpRate[key].length >= maxAttempts) return false;
  otpRate[key].push(Date.now());
  return true;
}

export function resetOtpRate(key) {
  delete otpRate[key];
}
