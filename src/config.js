// Loads env vars and exports them as a typed config object.
// ponytail: plain object, no class, no validation library. Add Zod or Joi if env
//           sprawl becomes unwieldy.
import 'dotenv/config';

export default {
  port: process.env.PORT || 3001,
  privy: {
    appId: process.env.PRIVY_APP_ID,
    appSecret: process.env.PRIVY_APP_SECRET,
  },
  mongoUri: process.env.MONGO_URI,
  stripeKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
};
