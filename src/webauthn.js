import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const RP_NAME = 'Sendly';

export function getRpId() { return process.env.RP_ID || 'bank-app-three-psi.vercel.app'; }
export function getOrigin() { return process.env.RP_ORIGIN || 'https://bank-app-three-psi.vercel.app'; }

function rpParams(hostname) {
  const clean = (hostname || getRpId()).split(':')[0];
  return { rpID: clean, origin: `https://${clean}` };
}

export async function createRegistrationOptions(userId, userEmail, existingCredentials = [], hostname) {
  const { rpID, origin } = rpParams(hostname);
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    origin,
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

export async function verifyRegistration(userId, response, expectedChallenge, hostname) {
  const { rpID, origin } = rpParams(hostname);
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
}

export async function createAuthenticationOptions(existingCredentials = [], hostname) {
  const { rpID } = rpParams(hostname);
  return generateAuthenticationOptions({
    rpID,
    allowCredentials: existingCredentials.map(c => ({
      id: c.credentialId,
      type: 'public-key',
      transports: c.transports || ['internal'],
    })),
    userVerification: 'preferred',
  });
}

export async function verifyAuthentication(response, expectedChallenge, credential, hostname) {
  const { rpID, origin } = rpParams(hostname);
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential,
  });
}
