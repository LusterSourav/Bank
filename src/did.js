import crypto from 'node:crypto';
import config from './config.js';

//did:web, no registry, no contract
export function createDidWeb(uid) {
  return `did:web:bank-app-three-psi.vercel.app:users:${uid}`;

}

export function buildDidDocument(uid,walletAddress){
  const did=createDidWeb(uid);
  return{
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    alsoKnownAs:[`eth:${walletAddress}`],
    verificationMethod:[{
      id: `${did}#blockchain-account`,
      type: 'EthereumAddress',
      controller: did,
      blockchainAccountId: `eip155:137:${walletAddress}`,
    }],
    authentication:[`${did}#blockchain-account`],
  };
}

// vc as signed jwt, signed w/ relayer's ed25519 key
export function issueVc(subjectDid,claims) {
  const privateKey =crypto.createPrivateKey({key: Buffer.from(config.didIssuerPrivateKey, 'hex'),type: 'pkcs8',format: 'der' });
  const header= {alg: 'EdDSA', typ: 'JWT'};
  const payload={
    sub: subjectDid,
    iss: `did:web:bank-app-three-psi.vercel.app`,
    vc:{ '@context':['https://www.w3.org/2018/credentials/v1'],type:['VerifiableCredential','KYCStatus'],credentialSubject: claims},
    iat: Math.floor(Date.now()/ 1000),
  };
  const b64=(o)=> Buffer.from(JSON.stringify(o)).toString('base64url');
  const data=`${b64(header)}.${b64(payload)}`;

  const sig=crypto.sign(null,Buffer.from(data),privateKey);
  return `${data}.${sig.toString('base64url')}`;
}
