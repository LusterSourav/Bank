import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const RP_NAME = 'Sendly';
const RP_ID = process.env.RP_ID || 'bank-app-three-psi.vercel.app';
const ORIGIN = process.env.RP_ORIGIN || 'https://bank-app-three-psi.vercel.app';

export function getRpId() { return RP_ID; }
export function getOrigin() { return ORIGIN; }

export async function createRegistrationOptions(userId, userEmail, existingCredentials = []) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userEmail,
    userDisplayName: userEmail,
    userID: Buffer.from(userId, 'utf-8'),
    attestationType: 'none',
    excludeCredentials: existingCredentials.map(c => ({
      id: c.credentialId,
      type: 'public-key',
      transports: c.transports,
    })),
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
  });
}

export async function verifyRegistration(userId, response, expectedChallenge) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });
}

export async function createAuthenticationOptions(existingCredentials = []) {
  return generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: existingCredentials.map(c => ({
      id: c.credentialId,
      type: 'public-key',
      transports: c.transports,
    })),
    userVerification: 'preferred',
  });
}

export async function verifyAuthentication(response, expectedChallenge, credential) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential,
  });
}
