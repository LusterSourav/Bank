import express from 'express';

import cors from 'cors';
import helmet from 'helmet';

import Stripe from 'stripe';
import crypto from 'crypto';
import config from './config.js';
import routes from './routes.js';


import kycRoutes from './kyc/routes.js';
import authRoutes from './authRoutes.js';
import gigWebhook from './webhooks/gig.js';

const app = express();

const stripe = new Stripe(config.stripeKey);

app.use(helmet());

app.use(cors({origin: process.env.CORS_ORIGIN || 'https://bank-app-three-psi.vercel.app'}));

async function creditAndNotify(txId, stripeOrderId){


  const{ Transaction, User} = await import('./models.js');
  const{ sendEmailNotification,sendWhatsAppNotification } =await import('./notifications.js');

  const tx = stripeOrderId
    ? await Transaction.findOne({ razorpayId: stripeOrderId })
    : await Transaction.findOne({stripeId: txId });

  if(!tx || tx.status !== 'pending')return;


  await User.findByIdAndUpdate(tx.userId, { $inc: { balance: tx.amount } });


  tx.status='completed';
  await tx.save();

  const depositor = await User.findById(tx.userId);


  sendEmailNotification(depositor.email, 'Deposit Received', `<p>Your account was credited with <b>₹${tx.amount}</b>.</p>`);

  if(depositor.notifyWhatsApp && depositor.phone){


    sendWhatsAppNotification(depositor.phone,`Your account was credited with ₹${tx.amount}.`);
  }
}

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  try {
    const sig = req.headers['stripe-signature'];

    const event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);

    if(event.type === 'payment_intent.succeeded'){
      await creditAndNotify(event.data.object.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('stripe webhook error:',err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/razorpay-webhook',express.raw({type: 'application/json' }), async (req, res) =>{
  try {
    const sig= req.headers['x-razorpay-signature'];


    const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(req.body).digest('hex');

    if (sig !== expected) return res.status(400).json({ error: 'invalid signature' });

    const event =JSON.parse(req.body);


    if (event.event === 'payment.captured') {
      await creditAndNotify(null,event.payload.payment.entity.order_id);
    }

    if (event.event === 'payout.processed' || event.event === 'payout.reversed') {
      const{ Transaction}= await import('./models.js');
      const payout= event.payload.payout.entity;
      const tx = await Transaction.findOne({ razorpayId: payout.id });
      if (tx){
        tx.status = event.event === 'payout.processed' ? 'completed' : 'failed';
        await tx.save();


      }
    }

    res.json({received: true});
  }catch(err){
    console.error('razorpay webhook error:',err.message);

    res.status(400).json({ error: err.message });
  }
});

app.use(express.json());
app.use('/api',routes);

app.use('/api',kycRoutes);
app.use('/api', authRoutes);
app.use('/api/webhook',gigWebhook);
app.get('/api/health', (_,res) => res.json({ok: true}));


export default app;
