// ponytail: mock KYC provider — interface matches real UIDAI/Protean APIs.
// Swap src/kyc/provider.js for production by replacing this file.
import crypto from 'crypto';

const MOCK_OTP = '123456';

// Verhoeff checksum for Aadhaar validation
const d = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,9,7,0,3,1,6,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,0,1,9],[7,6,0,4,8,2,9,5,3,1],[6,1,2,3,4,5,6,7,8,9],[3,0,4,1,2,6,8,9,5,7],[0,8,9,7,4,6,1,3,2,5]];
const p = [[0,1,2,3,4,5,6,7,8,9],[1,5,8,9,2,6,7,0,3,4],[5,8,6,3,7,0,9,1,4,2],[8,6,9,0,4,1,3,2,5,7],[6,1,2,3,4,5,6,7,8,9],[7,0,3,4,1,9,2,8,5,6],[0,8,9,7,6,3,1,2,4,5],[3,2,5,8,6,1,4,9,7,0],[2,7,0,5,9,1,3,4,6,8],[9,4,6,8,3,5,1,2,7,0]];

export function validateAadhaar(uid) {
  if (!/^\d{12}$/.test(uid)) return false;
  let c = 0;
  const digits = uid.split('').map(Number).reverse();
  for (let i = 0; i < 12; i++) c = d[c][p[i % 8][digits[i]]];
  return c === 0;
}

export function maskAadhaar(uid) {
  return `XXXX XXXX ${uid.slice(-4)}`;
}

export function maskPan(pan) {
  return `${pan.slice(0, 2)}XX XXX${pan.slice(-1)}`;
}

export async function generateAadhaarOtp(aadhaarNumber) {
  if (!validateAadhaar(aadhaarNumber)) {
    throw new Error('INVALID_UID');
  }
  // ponytail: mock returns reference_id, real API returns txn ID
  return {
    referenceId: `MOCK_${Date.now()}`,
    message: 'OTP sent to registered mobile',
  };
}

export async function verifyAadhaarOtp(referenceId, otp) {
  // ponytail: mock accepts "123456" or any 6-digit code
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('INVALID_OTP');
  }
  // Simulate verification delay
  await new Promise(r => setTimeout(r, 100));

  return {
    status: 'VALID',
    name: 'RAJESH KUMAR',
    dateOfBirth: '15-05-1990',
    gender: 'M',
    address: {
      house: '123',
      street: 'MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
    },
    photo: null, // ponytail: omit mock photo, real API returns base64
    aadhaarNumber: maskAadhaar(referenceId.replace('MOCK_', '')),
  };
}

export async function verifyPan(pan, name, dob) {
  // Format validation: AAAAE1234F
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return { valid: false, status: 'INVALID_FORMAT' };
  }

  // ponytail: mock checks — real API hits ITD database
  const nameMatch = name && name.length > 2;
  const dobMatch = !!dob;

  return {
    valid: true,
    status: 'VALID',
    nameMatches: nameMatch,
    dobMatches: dobMatch,
    aadhaarLinked: true,
    category: 'INDIVIDUAL',
    panMasked: maskPan(pan),
  };
}
