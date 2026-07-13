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
};
