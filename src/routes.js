import { Router } from 'express';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import admin from 'firebase-admin';
import { auth, totpRequired } from './middleware.js';
import { User, Transaction, Beneficiary } from './models.js';
import config from './config.js';
import { sendEmailNotification, sendWhatsAppNotification } from './notifications.js';

const router = Router();
const stripe = new Stripe(config.stripeKey);
const razorpay = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });

// ponytail: simple in-memory rate limit
const rateLimit = {};
const checkRate = (key, limit = 10, windowMs = 60000) => {
  const now = Date.now();
  if (!rateLimit[key]) rateLimit[key] = [];
  rateLimit[key] = rateLimit[key].filter(t => now - t < windowMs);
  if (rateLimit[key].length >= limit) return false;
  rateLimit[key].push(now);
  return true;
};

// ponytail: shared daily total helper — was duplicated twice
async function getTodayTotal(userId, type) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const result = await Transaction.aggregate([
    { $match: { userId, type, createdAt: { $gte: today } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
}

router.post('/auth/verify', auth, async (req, res) => {
  try {
    // ponytail: explicit find/create avoids Mongoose upsert + nested defaults bug
    let user = await User.findOne({ firebaseUid: req.userId });
    if (!user) {
      user = await User.create({ firebaseUid: req.userId, email: req.userEmail });
    }
    user.lastLogin = new Date();
    await user.save();
    res.json({
      userId: user.id,
      email: user.email,
      kyc: user.kyc.status,
      balance: user.balance,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      phone: user.phone,
      notifyWhatsApp: user.notifyWhatsApp,
      name: user.kyc.verifiedName || user.name,
      aadhaarMasked: user.kyc.aadhaarMasked,
      panMasked: user.kyc.panMasked,
      verifiedDob: user.kyc.verifiedDob,
      verifiedAddress: user.kyc.verifiedAddress,
      emailVerified: user.emailVerified,
      totpEnabled: !!user.totpEnabled,
      webauthnCount: (user.webauthnCredentials || []).length,
      sendLimit: user.sendLimit || 100000,
    });
  } catch (e) {
    console.error('auth/verify error:', e);
    res.status(500).json({ error: e.message || 'verify failed' });
  }
});

router.put('/auth/send-limit', auth, totpRequired, async (req, res) => {
  try {
    const { sendLimit } = req.body;
    if (!sendLimit || sendLimit < 500 || sendLimit > 500000) {
      return res.status(400).json({ error: 'Limit must be ₹500 – ₹500,000' });
    }
    await User.updateOne({ firebaseUid: req.userId }, { $set: { sendLimit } });
    res.json({ sendLimit });
  } catch (e) {
    console.error('auth/send-limit error:', e.message);
    res.status(500).json({ error: 'failed to update limit' });
  }
});

router.put('/auth/profile', auth, totpRequired, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.length < 1) return res.status(400).json({ error: 'Name required' });
    await User.updateOne({ firebaseUid: req.userId }, { $set: { name } });
    res.json({ name });
  } catch (e) {
    console.error('auth/profile error:', e.message);
    res.status(500).json({ error: 'failed to update profile' });
  }
});

router.post('/auth/delete-account', auth, totpRequired, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user) return res.status(404).json({ error: 'not found' });
    await User.deleteOne({ firebaseUid: req.userId });
    await Transaction.deleteMany({ userId: user._id });
    await Beneficiary.deleteMany({ userId: user._id });
    await admin.auth().deleteUser(req.userId);
    res.json({ status: 'deleted' });
  } catch (e) {
    console.error('delete-account error:', e.message);
    res.status(500).json({ error: 'failed to delete account' });
  }
});

router.get('/notifications/prefs', auth, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.userId });
    res.json({ email: user.email, phone: user.phone || '', notifyWhatsApp: user.notifyWhatsApp || false });
  } catch (e) {
    console.error('notifications/prefs error:', e.message);
    res.status(500).json({ error: 'failed to get prefs' });
  }
});

router.post('/notifications/prefs', auth, async (req, res) => {
  try {
    const { phone, notifyWhatsApp } = req.body;
    const update = {};
    if (phone !== undefined) update.phone = phone;
    if (notifyWhatsApp !== undefined) update.notifyWhatsApp = notifyWhatsApp;
    await User.updateOne({ firebaseUid: req.userId }, { $set: update });
    const user = await User.findOne({ firebaseUid: req.userId });
    res.json({ email: user.email, phone: user.phone || '', notifyWhatsApp: user.notifyWhatsApp || false });
  } catch (e) {
    console.error('notifications/prefs error:', e.message);
    res.status(500).json({ error: 'failed to save prefs' });
  }
});

router.post('/upi-collect', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount' });
  if (!checkRate(`deposit:${req.userId}`, 5)) return res.status(429).json({ error: 'too many requests' });

  const user = await User.findOne({ firebaseUid: req.userId });
  const limit = user.sendLimit || 100000;
  const todayTotal = await getTodayTotal(user._id, 'deposit');
  if (todayTotal + amount > limit) {
    return res.status(400).json({ error: `daily limit ₹${limit.toLocaleString()} exceeded` });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `dep_${user.id}_${Date.now()}`,
    notes: { userId: user.id.toString() },
  });

  await Transaction.create({ userId: user.id, type: 'deposit', amount, currency: 'inr', razorpayId: order.id, status: 'pending' });

  res.json({
    orderId: order.id,
    amount,
    upiUrl: `upi://pay?pa=bank@razorpay&pn=Bank&am=${amount}&cu=INR&tn=Deposit`,
    key: config.razorpay.keyId,
  });
});

router.post('/deposit', auth, async (req, res) => {
  const { amount, currency = 'inr' } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount' });

  const unitAmount = Math.round(amount * 100);
  const user = await User.findOne({ firebaseUid: req.userId });

  const intent = await stripe.paymentIntents.create({
    amount: unitAmount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { userId: user.id },
  });

  await Transaction.create({ userId: user.id, type: 'deposit', amount, currency, stripeId: intent.id, status: 'pending' });
  res.json({ clientSecret: intent.client_secret, amount, currency });
});

router.get('/forex', async (req, res) => {
  try {
    const resp = await fetch('https://api.frankfurter.app/latest?from=INR&to=USD,EUR,GBP,AED,SGD');
    const data = await resp.json();
    res.json({ base: 'INR', rates: data.rates, date: data.date });
  } catch {
    res.json({ base: 'INR', rates: { USD: 0.012, EUR: 0.011, GBP: 0.0095, AED: 0.044, SGD: 0.016 }, date: 'fallback' });
  }
});

router.get('/order-status/:orderId', auth, async (req, res) => {
  const tx = await Transaction.findOne({ razorpayId: req.params.orderId });
  if (!tx) return res.status(404).json({ error: 'order not found' });
  res.json({ status: tx.status });
});

router.post('/send', auth, totpRequired, async (req, res) => {
  const { amount, recipient, currency = 'inr' } = req.body;
  if (!amount || amount <= 0 || !recipient) return res.status(400).json({ error: 'missing amount or recipient' });
  if (!checkRate(`send:${req.userId}`, 10)) return res.status(429).json({ error: 'too many requests' });

  const user = await User.findOne({ firebaseUid: req.userId });
  if (user.balance < amount) return res.status(400).json({ error: 'insufficient balance' });

  const limit = user.sendLimit || 100000;
  const todayTotal = await getTodayTotal(user._id, 'send');
  if (todayTotal + amount > limit) {
    return res.status(400).json({ error: `daily limit ₹${limit.toLocaleString()} exceeded` });
  }

  user.balance -= amount;
  await user.save();
  const tx = await Transaction.create({ userId: user.id, type: 'send', amount, currency, recipient, status: 'processing' });

  // ponytail: bank payout stub — RazorpayX account not configured
  res.json({ txId: tx.id, balance: user.balance, amount, recipient, currency, status: tx.status });

  // ponytail: fire-and-forget notifications after response
  sendEmailNotification(user.email, 'Money Sent', `<p>You sent <b>₹${amount}</b> to ${recipient}.</p>`);
  if (user.notifyWhatsApp && user.phone) {
    sendWhatsAppNotification(user.phone, `You sent ₹${amount} to ${recipient}.`);
  }
});

router.get('/transactions', auth, async (req, res) => {
  const txs = await Transaction.find({ userId: (await User.findOne({ firebaseUid: req.userId }))._id }).sort({ createdAt: -1 }).limit(50);
  res.json(txs.map(t => ({ id: t.id, type: t.type, amount: t.amount, currency: t.currency, status: t.status, recipient: t.recipient, createdAt: t.createdAt })));
});

router.get('/beneficiaries', auth, async (req, res) => {
  const user = await User.findOne({ firebaseUid: req.userId });
  const list = await Beneficiary.find({ userId: user._id }).sort({ name: 1 });
  res.json(list.map(b => ({ id: b.id, name: b.name, ifsc: b.ifsc, accountNumber: b.accountNumber, currency: b.currency })));
});

router.post('/beneficiaries', auth, async (req, res) => {
  const { name, ifsc, accountNumber, currency = 'inr' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = await User.findOne({ firebaseUid: req.userId });
  const count = await Beneficiary.countDocuments({ userId: user._id });
  if (count >= 20) return res.status(400).json({ error: 'max 20 beneficiaries' });
  const b = await Beneficiary.create({ userId: user._id, name, ifsc, accountNumber, currency });
  res.json({ id: b.id, name: b.name, ifsc: b.ifsc, accountNumber: b.accountNumber, currency: b.currency });
});

export default router;
