// single json env var for firebase, avoids vercel newline issues
const serviceAccount=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

import crypto from 'node:crypto';
// generated once at startup, persist via env for consistency
let _didIssuer;
if(process.env.DID_ISSUER_PRIVATE_KEY){
  _didIssuer={
    privateKey: process.env.DID_ISSUER_PRIVATE_KEY,
    publicKey: process.env.DID_ISSUER_PUBLIC_KEY,
  };
} else{
  const{publicKey,privateKey}=crypto.generateKeyPairSync('ed25519',{
    publicKeyEncoding:{type: 'spki',format: 'der'},
    privateKeyEncoding: {type: 'pkcs8',format: 'der'},
  });


  _didIssuer={privateKey: privateKey.toString('hex'),publicKey: publicKey.toString('hex')};


}


export default{
  port: process.env.PORT || 3001,
  firebase:{
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  },
  mongoUri: process.env.MONGO_URI,
  stripeKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  razorpay:{
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  resendKey: process.env.RESEND_API_KEY || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    whatsAppFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    templateSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID || '',
  },
  sandbox:{
    apiKey: process.env.SANDBOX_API_KEY || '',
    apiSecret: process.env.SANDBOX_API_SECRET || '',
    //sandbox: test-api.sandbox.co.in w/ key_test_* keys
    baseUrl: process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in',
  },
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || '',
  totpSessionSecret: process.env.TOTP_SESSION_SECRET || '',
  ereborUrl: process.env.EREBOR_URL || 'http://localhost:3002',
  ereborRelayerShare: process.env.EREBOR_RELAYER_SHARE || '',
  polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  polygonRelayerKey: process.env.POLYGON_RELAYER_PRIVATE_KEY || '',
  remittanceEscrowAddress: process.env.REMITTANCE_ESCROW_ADDRESS || '',
  oracleProxyAddress: process.env.ORACLE_PROXY_ADDRESS || '',
  eurUsdFeed: process.env.EUR_USD_FEED || '0x73366Fe0AA0Ded304479862808e02506FE556a98',
  //zk removed, age via kyc dob
  adminEmails:(process.env.ADMIN_EMAILS || '').split(',').filter(Boolean),
  remitFeePercent: Number(process.env.REMIT_FEE_PERCENT) || 0.5,
  didIssuerPrivateKey: _didIssuer.privateKey,
  didIssuerPublicKey: _didIssuer.publicKey,
  appUrl: process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
  tokens: {


    usdc:{address: process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',decimals: 6, label: 'USDC'},
    usdt:{address: process.env.USDT_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',decimals: 6,label: 'USDT'},
    eurc:{address: process.env.EURC_ADDRESS || '0x7f50786A2b2d42E0D2D5a2d5bCcfc8ACb5f5c5C5',decimals: 6,label: 'EURC'},
  },
};

//fail fast at import, not runtime
(()=>{
  const encKey=process.env.TOTP_ENCRYPTION_KEY || '';
  const sessionKey=process.env.TOTP_SESSION_SECRET || '';

  if(!encKey)throw new Error('TOTP_ENCRYPTION_KEY env var is required (64 hex chars, 32 bytes)');
  if(encKey.length !== 64)throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');

  if(!sessionKey) throw new Error('TOTP_SESSION_SECRET env var is required (min 32 chars)');

  if(sessionKey.length < 32)throw new Error('TOTP_SESSION_SECRET must be at least 32 chars');
})();
