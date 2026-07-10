// Express entry point. Registers webhooks (raw body), JSON middleware, API routes,
// and starts listening. Webhooks must be registered before express.json() to get
// the raw body for signature verification.
// ponytail: no cluster mode, no graceful shutdown. Add those when you have more
//           than one instance behind a load balancer.
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import crypto from 'crypto';
import connect from './db.js';
import config from './config.js';
import routes from './routes.js';

const app = express();
const stripe = new Stripe(config.stripeKey);

app.use(cors());

// ponytail: Stripe webhook — raw body required
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

// ponytail: Razorpay webhook — raw body required for signature verification
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
      tx.razorpayId = payment.id;
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

app.get('/health', (_, res) => res.json({ ok: true }));

await connect();
app.listen(config.port, () => console.log(`listening on ${config.port}`));
