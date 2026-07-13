import 'dotenv/config';

// ponytail: single JSON env var for Firebase service account — avoids newline mangling across Vercel/local
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

export default {
  port: process.env.PORT || 3001,
  firebase: {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  },
  mongoUri: process.env.MONGO_URI,
  stripeKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  razorpay: {
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
  sandbox: {
    apiKey: process.env.SANDBOX_API_KEY || '',
    apiSecret: process.env.SANDBOX_API_SECRET || '',
  },
  eko: {
    developerKey: process.env.EKO_DEVELOPER_KEY || '',
    accessKey: process.env.EKO_ACCESS_KEY || '',
    initiatorId: process.env.EKO_INITIATOR_ID || '',
  },
  // AES-256-GCM key for TOTP secrets at rest — 32 bytes as 64 hex chars
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || '',
  // JWT secret for TOTP session tokens — min 32 chars
  totpSessionSecret: process.env.TOTP_SESSION_SECRET || '',
};

// ponytail: fail fast at import time instead of cryptic runtime errors
(() => {
  const encKey = process.env.TOTP_ENCRYPTION_KEY || '';
  const sessionKey = process.env.TOTP_SESSION_SECRET || '';
  if (!encKey) throw new Error('TOTP_ENCRYPTION_KEY env var is required (64 hex chars, 32 bytes)');
  if (encKey.length !== 64) throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  if (!sessionKey) throw new Error('TOTP_SESSION_SECRET env var is required (min 32 chars)');
  if (sessionKey.length < 32) throw new Error('TOTP_SESSION_SECRET must be at least 32 chars');
})();
