// Express app setup — no listen(), no db connect. Imported by both local
// dev (src/index.js) and Vercel serverless (api/index.js).
// ponytail: webhooks registered before express.json() so they get the raw body.
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import crypto from 'crypto';
import config from './config.js';
import routes from './routes.js';

const app = express();
const stripe = new Stripe(config.stripeKey);

app.use(cors());

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);

  if (event.type === 'payment_intent.succeeded') {
    const { Transaction, User } = await import('./models.js');
    const pi = event.data.object;
    const tx = await Transaction.findOne({ stripeId: pi.id });
    if (tx && tx.status === 'pending') {
      tx.status = 'completed';
      await tx.save();
      await User.findByIdAndUpdate(tx.userId, { $inc: { balance: tx.amount } });
    }
  }
  res.json({ received: true });
});

app.post('/api/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(req.body).digest('hex');

  if (sig !== expected) return res.status(400).json({ error: 'invalid signature' });

  const event = JSON.parse(req.body);

  if (event.event === 'payment.captured') {
    const { Transaction, User } = await import('./models.js');
    const payment = event.payload.payment.entity;
    const tx = await Transaction.findOne({ razorpayId: payment.order_id });
    if (tx && tx.status === 'pending') {
      tx.status = 'completed';
      await tx.save();
      await User.findByIdAndUpdate(tx.userId, { $inc: { balance: tx.amount } });
    }
  }

  if (event.event === 'payout.processed' || event.event === 'payout.reversed') {
    const { Transaction } = await import('./models.js');
    const payout = event.payload.payout.entity;
    const tx = await Transaction.findOne({ razorpayId: payout.id });
    if (tx) {
      tx.status = event.event === 'payout.processed' ? 'completed' : 'failed';
      await tx.save();
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use('/api', routes);
app.get('/api/health', (_, res) => res.json({ ok: true }));

export default app;
