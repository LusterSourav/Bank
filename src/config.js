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
  // ponytail: amoy testnet by default. override with MATIC_RPC_URL for mainnet.
  polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
  polygonRelayerKey: process.env.POLYGON_RELAYER_PRIVATE_KEY || '',
  remittanceEscrowAddress: process.env.REMITTANCE_ESCROW_ADDRESS || '',
  oracleProxyAddress: process.env.ORACLE_PROXY_ADDRESS || '',
  pythEurUsdFeedId: process.env.PYTH_FEED_ID || '',
  oracleDeviationBps: Number(process.env.ORACLE_DEVIATION_BPS) || 500,
  //amoy default; mainnet: 0x73366Fe0AA0Ded304479862808e02506FE556a98
  eurUsdFeed: process.env.EUR_USD_FEED || '0xd8d927e5d52Bb7cdb2C0ae6f55ACcB18e9a2B9D7',
  //mainnet-only, dead on amoy; nothing reads it yet
  inrUsdFeed: process.env.INR_USD_FEED || '0xDA0F8Df6F5dB15b346f4B8D1156722027E194E60',
  //zk removed, age via kyc dob
  adminEmails:(process.env.ADMIN_EMAILS || '').split(',').filter(Boolean),
  remitFeePercent: Number(process.env.REMIT_FEE_PERCENT) || 0.5,
  didIssuerPrivateKey: _didIssuer.privateKey,
  didIssuerPublicKey: _didIssuer.publicKey,
  appUrl: process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
  tokens: {


    usdc:{address: process.env.USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',decimals: 6, label: 'USDC'},
    usdt:{address: process.env.USDT_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',decimals: 6,label: 'USDT'},
    eurc:{address: process.env.EURC_ADDRESS || '0x1aBAEA1f7C830bD89Acc67eC4af516284b1bC33c',decimals: 6,label: 'EURC'},
  },
  escrows:{
    usdc: process.env.REMITTANCE_ESCROW_ADDRESS || '',
    usdt: process.env.USDT_ESCROW_ADDRESS || '',
    eurc: process.env.EURC_ESCROW_ADDRESS || '',
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
