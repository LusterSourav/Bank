import config from '../config.js';

// ── Aadhaar utilities (pure, no API calls) ──

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

// ── Sandbox auth (24h token, auto-refresh) ──

let sandboxToken = null;
let sandboxTokenExpiry = 0;

async function getSandboxToken() {
  if (sandboxToken && Date.now() < sandboxTokenExpiry) return sandboxToken;

  const res = await fetch(`${config.sandbox.baseUrl}/authenticate`, {
    method: 'POST',
    headers: {
      'x-api-key': config.sandbox.apiKey,
      'x-api-secret': config.sandbox.apiSecret,
      'x-api-version': '1.0',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sandbox auth failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  sandboxToken = json.data.access_token;
  // ponytail: 24h token, refresh 5 min early
  sandboxTokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return sandboxToken;
}

async function sandboxFetch(path, body) {
  const token = await getSandboxToken();
  const res = await fetch(`${config.sandbox.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': config.sandbox.apiKey,
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    // ponytail: token expired, refresh once and retry
    sandboxToken = null;
    sandboxTokenExpiry = 0;
    return sandboxFetch(path, body);
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Sandbox error (${res.status})`);
  return json;
}

function hasSandboxKeys() {
  return !!(config.sandbox.apiKey && config.sandbox.apiSecret);
}

// ── Aadhaar OTP (Sandbox) ──

export async function generateAadhaarOtp(aadhaarNumber) {
  if (!validateAadhaar(aadhaarNumber)) {
    throw new Error('INVALID_UID');
  }

  if (!hasSandboxKeys()) {
    // ponytail: mock fallback — Sandbox deprecated OTP Aadhaar, migrate to DigiLocker when it fails
    return {
      referenceId: `MOCK_${Date.now()}`,
      message: 'OTP sent to registered mobile',
    };
  }

  const res = await sandboxFetch('/kyc/aadhaar/okyc/otp', {
    '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
    aadhaar_number: aadhaarNumber,
    consent: 'Y',
    reason: 'KYC verification',
  });

  return {
    referenceId: String(res.data.reference_id),
    message: res.data.message,
  };
}

export async function verifyAadhaarOtp(referenceId, otp) {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('INVALID_OTP');
  }

  if (!hasSandboxKeys()) {
    // ponytail: mock fallback
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
      photo: null,
      aadhaarNumber: maskAadhaar(referenceId.replace('MOCK_', '')),
    };
  }

  const res = await sandboxFetch('/kyc/aadhaar/okyc/otp/verify', {
    '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
    reference_id: referenceId,
    otp,
  });

  if (res.data.status !== 'VALID') {
    throw new Error(res.data.message || 'Aadhaar verification failed');
  }

  const addr = res.data.address || {};
  return {
    status: res.data.status,
    name: res.data.name,
    dateOfBirth: res.data.date_of_birth,
    gender: res.data.gender,
    address: {
      house: addr.house || '',
      street: addr.street || '',
      city: addr.vtc || addr.district || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      country: addr.country || 'India',
    },
    photo: res.data.photo || null,
    aadhaarNumber: maskAadhaar(referenceId.replace(/\D/g, '').slice(-12)),
  };
}

// ── PAN verification (Sandbox) ──

export async function verifyPan(pan, name, dob) {
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return { valid: false, status: 'INVALID_FORMAT' };
  }

  if (!hasSandboxKeys()) {
    // ponytail: mock fallback
    const nameMatch = name && name.length > 2;
    const dobMatch = !!dob;
    return {
      valid: true, status: 'VALID',
      nameMatches: nameMatch, dobMatches: dobMatch,
      aadhaarLinked: true, category: 'INDIVIDUAL',
      panMasked: maskPan(pan),
    };
  }

  // ponytail: normalize DOB separators to Sandbox DD/MM/YYYY format
  const normalizedDob = dob ? dob.replace(/[-]/g, '/') : '';

  const res = await sandboxFetch('/kyc/pan/verify', {
    '@entity': 'in.co.sandbox.kyc.pan_verification.request',
    pan,
    name_as_per_pan: name,
    date_of_birth: normalizedDob,
    consent: 'Y',
    reason: 'KYC verification for user onboarding',
  });

  const data = res.data || {};
  const panValid = data.status === 'valid';
  const nameMatches = data.name_as_per_pan_match === true;
  const dobMatches = data.date_of_birth_match === true;

  return {
    valid: panValid,
    status: panValid ? 'VALID' : (data.status || 'INVALID').toUpperCase(),
    nameMatches,
    dobMatches,
    aadhaarLinked: data.aadhaar_seeding_status === 'y',
    category: data.category || 'UNKNOWN',
    panMasked: maskPan(pan),
  };
}
