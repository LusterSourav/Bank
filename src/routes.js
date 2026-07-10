// All API routes. Auth via Bearer token -> Privy verify -> req.userId.
// Public: /auth/verify, /forex. Protected: everything else.
// ponytail: inline rate-limit map, one-file routing. Split into controllers
//           only if route count exceeds ~20.
import { Router } from 'express';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { auth, privy } from './middleware.js';
import { User, Transaction, Beneficiary } from './models.js';
import config from './config.js';

const router = Router();
const stripe = new Stripe(config.stripeKey);
const razorpay = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });

// ponytail: simple in-memory rate limit — replace with Redis in production
const rateLimit = {};
const checkRate = (key, limit = 10, windowMs = 60000) => {
  const now = Date.now();
  if (!rateLimit[key]) rateLimit[key] = [];
  rateLimit[key] = rateLimit[key].filter(t => now - t < windowMs);
  if (rateLimit[key].length >= limit) return false;
  rateLimit[key].push(now);
  return true;
};

// ponytail: daily transaction limits per user
const DAILY_LIMIT = 100000; // ₹1 lakh

router.post('/auth/verify', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });

  try {
    const claims = await privy.verifyAuthToken(header.slice(7));
    const linked = await privy.getUser(claims.userId);
    const email = linked.linkedAccounts.find(a => a.type === 'email')?.address;

    let user = await User.findOne({ privyDid: claims.userId });
    if (!user) user = await User.create({ privyDid: claims.userId, email });
    res.json({ userId: user.id, email: user.email, kyc: user.kyc.status, balance: user.balance });
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
});

// ponytail: UPI collect via Razorpay — creates order, returns QR data
router.post('/upi-collect', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount' });
  if (!checkRate(`deposit:${req.userId}`, 5)) return res.status(429).json({ error: 'too many requests' });

  const user = await User.findOne({ privyDid: req.userId });

  // ponytail: check daily limit
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTx = await Transaction.aggregate([
    { $match: { userId: user._id, type: 'deposit', createdAt: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const todayTotal = todayTx[0]?.total || 0;
  if (todayTotal + amount > DAILY_LIMIT) {
    return res.status(400).json({ error: `daily limit ₹${DAILY_LIMIT.toLocaleString()} exceeded` });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `dep_${user.id}_${Date.now()}`,
    notes: { userId: user.id.toString() },
  });

  await Transaction.create({ userId: user.id, type: 'deposit', amount, currency: 'inr', razorpayId: order.id, status: 'pending' });

  // ponytail: return order + UPI intent URL for QR generation
  res.json({
    orderId: order.id,
    amount,
    upiUrl: `upi://pay?pa=bank@razorpay&pn=Bank&am=${amount}&cu=INR&tn=Deposit`,
    key: config.razorpay.keyId,
  });
});

// ponytail: Stripe deposit still works for card payments
router.post('/deposit', auth, async (req, res) => {
  const { amount, currency = 'inr' } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount' });

  const unitAmount = Math.round(amount * 100);
  const user = await User.findOne({ privyDid: req.userId });

  const intent = await stripe.paymentIntents.create({
    amount: unitAmount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { userId: user.id },
  });

  await Transaction.create({ userId: user.id, type: 'deposit', amount, currency, stripeId: intent.id, status: 'pending' });
  res.json({ clientSecret: intent.client_secret, amount, currency });
});

// ponytail: forex rates from free API
router.get('/forex', async (req, res) => {
  try {
    const resp = await fetch('https://api.frankfurter.app/latest?from=INR&to=USD,EUR,GBP,AED,SGD');
    const data = await resp.json();
    res.json({ base: 'INR', rates: data.rates, date: data.date });
  } catch {
    // ponytail: fallback static rates if API fails
    res.json({ base: 'INR', rates: { USD: 0.012, EUR: 0.011, GBP: 0.0095, AED: 0.044, SGD: 0.016 }, date: 'fallback' });
  }
});

// ponytail: check order status for polling
router.get('/order-status/:orderId', auth, async (req, res) => {
  const tx = await Transaction.findOne({ razorpayId: req.params.orderId });
  if (!tx) return res.status(404).json({ error: 'order not found' });
  res.json({ status: tx.status });
});

// ponytail: send money — deduct balance + initiate payout via RazorpayX
router.post('/send', auth, async (req, res) => {
  const { amount, recipient, currency = 'inr', bankAccount } = req.body;
  if (!amount || amount <= 0 || !recipient) return res.status(400).json({ error: 'missing amount or recipient' });
  if (!checkRate(`send:${req.userId}`, 10)) return res.status(429).json({ error: 'too many requests' });

  const user = await User.findOne({ privyDid: req.userId });
  if (user.balance < amount) return res.status(400).json({ error: 'insufficient balance' });

  // ponytail: daily limit check
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTx = await Transaction.aggregate([
    { $match: { userId: user._id, type: 'send', createdAt: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const todayTotal = todayTx[0]?.total || 0;
  if (todayTotal + amount > DAILY_LIMIT) {
    return res.status(400).json({ error: `daily limit ₹${DAILY_LIMIT.toLocaleString()} exceeded` });
  }

  user.balance -= amount;
  await user.save();
  const tx = await Transaction.create({ userId: user.id, type: 'send', amount, currency, recipient, status: 'processing' });

  // ponytail: if bank details provided, initiate RazorpayX payout
  if (bankAccount?.ifsc && bankAccount?.accountNumber) {
    try {
      const payout = await razorpay.payouts.create({
        account_number: 'YOUR_RAZORPAYX_ACCOUNT', // ponytail: replace with actual account
        fund_account_id: null, // ponytail: need to create fund account first
        amount: Math.round(amount * 100),
        currency: 'INR',
        mode: 'NEFT',
        purpose: 'payout',
        reference_id: tx.id.toString(),
      });
      tx.razorpayId = payout.id;
      tx.status = 'processing';
    } catch (e) {
      // ponytail: payout failed, but balance already deducted — mark failed
      tx.status = 'failed';
      user.balance += amount;
      await user.save();
      return res.status(500).json({ error: 'payout failed', details: e.message });
    }
  }

  await tx.save();
  res.json({ txId: tx.id, balance: user.balance, amount, recipient, currency, status: tx.status });
});

router.get('/transactions', auth, async (req, res) => {
  const txs = await Transaction.find({ userId: (await User.findOne({ privyDid: req.userId }))._id }).sort({ createdAt: -1 }).limit(50);
  res.json(txs.map(t => ({ id: t.id, type: t.type, amount: t.amount, currency: t.currency, status: t.status, recipient: t.recipient, createdAt: t.createdAt })));
});

// ponytail: beneficiary CRUD
router.get('/beneficiaries', auth, async (req, res) => {
  const user = await User.findOne({ privyDid: req.userId });
  const list = await Beneficiary.find({ userId: user._id }).sort({ name: 1 });
  res.json(list.map(b => ({ id: b.id, name: b.name, ifsc: b.ifsc, accountNumber: b.accountNumber, currency: b.currency })));
});

router.post('/beneficiaries', auth, async (req, res) => {
  const { name, ifsc, accountNumber, currency = 'inr' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = await User.findOne({ privyDid: req.userId });
  const count = await Beneficiary.countDocuments({ userId: user._id });
  if (count >= 20) return res.status(400).json({ error: 'max 20 beneficiaries' });
  const b = await Beneficiary.create({ userId: user._id, name, ifsc, accountNumber, currency });
  res.json({ id: b.id, name: b.name, ifsc: b.ifsc, accountNumber: b.accountNumber, currency: b.currency });
});

export default router;
