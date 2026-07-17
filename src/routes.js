import{Router} from 'express';

import Stripe from 'stripe';
import Razorpay from 'razorpay';


import admin from 'firebase-admin';
import{auth,totpRequired } from './middleware.js';
import { User, Transaction,Beneficiary,Escrow } from './models.js';
import{Notification}from './models/notification.js';
import config from './config.js';
import{ sendEmailNotification,sendWhatsAppNotification}from './notifications.js';

const router=Router();

// dont crash on missing keys
let stripe;
try { stripe =new Stripe(config.stripeKey);} catch{}

let razorpay;
try{razorpay= new Razorpay({key_id: config.razorpay.keyId,key_secret: config.razorpay.keySecret });} catch{}

//inr→usdc via chainlink, falls back to 83.5
async function inrToUsdc(inrAmount) {
  try{
    const{ethers}=await import('ethers');
    const provider =new ethers.JsonRpcProvider(config.polygonRpcUrl);
    const abi = ['function getConversionRate() view returns (uint256 rate, uint8 decimals)'];

    const contract=new ethers.Contract(config.oracleProxyAddress, abi,provider);

    const[rate,decimals] = await contract.getConversionRate();


    const usdPerInr=Number(rate)/ 10 ** Number(decimals);
    return parseFloat((inrAmount * usdPerInr).toFixed(6));
  }catch {
    return parseFloat((inrAmount / 83.5).toFixed(6)); // tried 83, too high. 83.5 works
  }
}

async function readEurUsdRate(provider){
  const{ ethers }=await import('ethers');

  const abi =['function decimals() view returns (uint8)','function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'];
  const feed=new ethers.Contract(config.eurUsdFeed,abi,provider);
  const[,answer,,updatedAt] =await feed.latestRoundData();
  if(Math.floor(Date.now()/ 1000)- Number(updatedAt)> 86400)throw new Error('stale eur/usd rate');

  return Number(answer)/ 1e8;
}

async function inrToStable(inrAmount,token= 'usdc'){
  const usdcVal=await inrToUsdc(inrAmount);
  if (token === 'eurc'){
    const { ethers}=await import('ethers');
    const provider=new ethers.JsonRpcProvider(config.polygonRpcUrl);
    const eurUsd=await readEurUsdRate(provider);
    return parseFloat((usdcVal / eurUsd).toFixed(6));
  }
  return parseFloat(usdcVal.toFixed(6));
}

// in-memory rate limiter, dies on restart
const rateLimit={};
const checkRate=(key,limit=10, windowMs =60000)=>{
  const now = Date.now();
  if(!rateLimit[key])rateLimit[key]=[];
  rateLimit[key] =rateLimit[key].filter(t => now - t < windowMs);

  if(rateLimit[key].length >= limit) return false;
  rateLimit[key].push(now);
  return true;
};

// was in send+deposit, pulled up
async function getTodayTotal(userId,type){
  const today=new Date();
  today.setHours(0,0,0,0);
  const result=await Transaction.aggregate([
    {$match:{userId, type,createdAt:{$gte: today}}},
    {$group:{_id: null,total:{$sum: '$amount' }}},
  ]);
  return result[0]?.total || 0;
}

router.post('/auth/verify',auth, async(req,res)=>{
  try{
    // explicit find/create — upsert has a nested-defaults bug in mongoose
    let user=await User.findOne({firebaseUid: req.userId });
    if(!user){
      user=await User.create({ firebaseUid: req.userId,email: req.userEmail });
    }
    user.lastLogin=new Date();

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
      webauthnCount:(user.webauthnCredentials ||[]).length,
      sendLimit: user.sendLimit || 100000,
    });
  }catch (e){
    console.error('auth/verify error:', e);
    res.status(500).json({error: e.message || 'verify failed'});
  }
});

router.put('/auth/send-limit',auth,totpRequired,async(req,res)=>{
  try{
    const{ sendLimit}= req.body;
    if(!sendLimit || sendLimit < 500 || sendLimit > 500000) {
      return res.status(400).json({ error: 'Limit must be ₹500 – ₹500,000' });

    }
    await User.updateOne({ firebaseUid: req.userId },{$set:{sendLimit} });
    res.json({ sendLimit });
  }catch(e){
    console.error('auth/send-limit error:',e.message);

    res.status(500).json({ error: 'failed to update limit'});
  }
});

router.put('/auth/profile', auth, totpRequired, async (req, res) => {
  try{
    const{name} =req.body;
    if(!name || name.length < 1)return res.status(400).json({error: 'Name required'});
    await User.updateOne({ firebaseUid: req.userId },{$set:{ name}});
    res.json({name});

  }catch(e){
    console.error('auth/profile error:', e.message);
    res.status(500).json({error: 'failed to update profile'});

  }
});

router.post('/auth/delete-account', auth, totpRequired,async (req, res) =>{

  try{

    const user= await User.findOne({firebaseUid: req.userId});

    if (!user)return res.status(404).json({ error: 'not found'});

    await User.deleteOne({firebaseUid: req.userId});
    await Transaction.deleteMany({ userId: user._id});

    await Beneficiary.deleteMany({ userId: user._id});
    await admin.auth().deleteUser(req.userId);
    res.json({ status: 'deleted'});

  }catch(e){
    console.error('delete-account error:',e.message);

    res.status(500).json({error: 'failed to delete account' });
  }
});

router.get('/notifications/prefs',auth,async(req,res) => {
  try{

    const user= await User.findOne({firebaseUid: req.userId});

    if (!user)return res.status(404).json({error: 'user not found'});
    res.json({ email: user.email,phone: user.phone || '',notifyWhatsApp: user.notifyWhatsApp || false});
  }catch(e){
    console.error('notifications/prefs error:', e.message);
    res.status(500).json({error: 'failed to get prefs'});
  }
});

router.post('/notifications/prefs',auth,async (req,res)=> {
  try{
    const{phone,notifyWhatsApp }= req.body;
    const update={};
    if (phone !== undefined){
      // ponytail: strip non-digits, basic length check
      const cleaned = phone.replace(/\D/g,'');
      if (cleaned.length < 10) return res.status(400).json({error: 'invalid phone'});
      update.phone=cleaned;
    }
    if(notifyWhatsApp !== undefined)update.notifyWhatsApp=notifyWhatsApp;

    await User.updateOne({ firebaseUid: req.userId },{ $set: update });

    const user = await User.findOne({ firebaseUid: req.userId});
    if(!user)return res.status(404).json({error: 'user not found'});
    res.json({email: user.email,phone: user.phone || '',notifyWhatsApp: user.notifyWhatsApp || false});
  }catch(e){
    console.error('notifications/prefs error:',e.message);
    res.status(500).json({error: 'failed to save prefs'});
  }
});

router.get('/notifications/history', auth, async (req, res) => {
  try{
    const user = await User.findOne({ firebaseUid: req.userId });
    if (!user) return res.status(404).json({error: 'user not found'});
    const notifs = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 }).limit(20).lean();
    res.json(notifs.map(n => ({
      id: n._id, channel: n.channel, type: n.type,
      status: n.status, recipient: n.recipient,
      createdAt: n.createdAt,
    })));
  }catch(e){
    console.error('notifications/history error:', e.message);
    res.status(500).json({error: 'failed to get history'});
  }
});


router.post('/upi-collect',auth, async (req, res)=>{
  const {amount} = req.body;



  if(!amount || amount <= 0) return res.status(400).json({ error: 'invalid amount'});
  if(!checkRate(`deposit:${req.userId}`, 5))return res.status(429).json({error: 'too many requests' });


  const user = await User.findOne({firebaseUid: req.userId});
  if(!user)return res.status(404).json({error: 'user not found'});
  const limit=user.sendLimit || 100000;

  const todayTotal =await getTodayTotal(user._id,'deposit');
  if (todayTotal + amount > limit){
    return res.status(400).json({ error: `daily limit ₹${limit.toLocaleString()} exceeded`});
  }

  const order= await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `dep_${user.id}_${Date.now()}`,
    notes:{ userId: user.id.toString()},
  });

  await Transaction.create({userId: user.id,type: 'deposit',amount,currency: 'inr',razorpayId: order.id,status: 'pending'});

  res.json({
    orderId: order.id,
    amount,
    upiUrl: `upi://pay?pa=bank@razorpay&pn=Bank&am=${amount}&cu=INR&tn=Deposit`,
    key: config.razorpay.keyId,
  });
});

router.post('/deposit', auth,async(req,res) =>{
  const { amount, currency='inr'} =req.body;


  if(!amount || amount <= 0)return res.status(400).json({error: 'invalid amount'});

  const unitAmount=Math.round(amount * 100);
  const user=await User.findOne({firebaseUid: req.userId });

  if(!user)return res.status(404).json({error: 'user not found' });

  const intent= await stripe.paymentIntents.create({


    amount: unitAmount,
    currency,
    automatic_payment_methods:{enabled: true},
    metadata:{userId: user.id},
  });

  await Transaction.create({ userId: user.id, type: 'deposit',amount,currency,stripeId: intent.id,status: 'pending' });

  res.json({clientSecret: intent.client_secret,amount, currency});
});

router.get('/forex',async (req,res)=>{
  try {
    const resp= await fetch('https://api.frankfurter.app/latest?from=INR&to=USD,EUR,GBP,AED,SGD');
    const data=await resp.json();
    res.json({base: 'INR',rates: data.rates,date: data.date});
  } catch {
    res.status(503).json({error: 'forex rates unavailable'});
  }
});

router.get('/order-status/:orderId',auth, async(req,res)=>{

  const tx=await Transaction.findOne({razorpayId: req.params.orderId});
  if(!tx)return res.status(404).json({error: 'order not found'});
  res.json({status: tx.status });

});

router.post('/send', auth, totpRequired,async(req,res)=> {
  const {amount,recipient, currency ='inr'}=req.body;

  if (!amount || amount <= 0 || !recipient)return res.status(400).json({ error: 'missing amount or recipient'});
  if(!checkRate(`send:${req.userId}`,10))return res.status(429).json({error: 'too many requests'});

  const user= await User.findOne({firebaseUid: req.userId});
  if(!user)return res.status(404).json({error: 'user not found'});
  if(user.balance < amount)return res.status(400).json({ error: 'insufficient balance' });


  const limit=user.sendLimit || 100000;
  const todayTotal= await getTodayTotal(user._id,'send');
  if (todayTotal + amount > limit){
    return res.status(400).json({error: `daily limit ₹${limit.toLocaleString()} exceeded`});
  }


  const tx = await Transaction.create({userId: user.id, type: 'send',amount, currency, recipient, status: 'processing' });

  user.balance -= amount;
  await user.save();

  res.json({txId: tx.id,balance: user.balance,amount,recipient, currency,status: tx.status});

  //dont wait for this
  sendEmailNotification(user.email,'Money Sent',`<p>You sent <b>₹${amount}</b> to ${recipient}.</p>`, user._id, 'send');

  if (user.notifyWhatsApp && user.phone){
    sendWhatsAppNotification(user.phone,`You sent ₹${amount} to ${recipient}.`, null, user._id, 'send');
  }

});

router.get('/transactions',auth,async (req,res)=> {
  const user=await User.findOne({firebaseUid: req.userId });

  if (!user) return res.status(404).json({error: 'user not found'});

  const txs =await Transaction.find({userId: user._id }).sort({ createdAt: -1 }).limit(50);
  res.json(txs.map(t =>({id: t.id,type: t.type,amount: t.amount,currency: t.currency,status: t.status,recipient: t.recipient,createdAt: t.createdAt})));
});

router.get('/beneficiaries',auth,async(req,res)=>{
  const user =await User.findOne({firebaseUid: req.userId});

  if (!user)return res.status(404).json({error: 'user not found'});

  const list=await Beneficiary.find({userId: user._id }).sort({name: 1});
  res.json(list.map(b => ({id: b.id,name: b.name,ifsc: b.ifsc,accountNumber: b.accountNumber,currency: b.currency })));
});


router.post('/beneficiaries',auth,async (req,res) =>{
  const{ name,ifsc,accountNumber,currency='inr'}=req.body;

  if(!name)return res.status(400).json({error: 'name required'});
  const user = await User.findOne({firebaseUid: req.userId });
  if(!user)return res.status(404).json({error: 'user not found'});

  const count= await Beneficiary.countDocuments({ userId: user._id});

  if (count >= 20) return res.status(400).json({ error: 'max 20 beneficiaries'});
  const b=await Beneficiary.create({userId: user._id,name,ifsc,accountNumber,currency });

  res.json({id: b.id,name: b.name,ifsc: b.ifsc,accountNumber: b.accountNumber,currency: b.currency });
});

// eslint-disable-next-line max-len
router.get('/escrows/pending',auth, async(req,res) => {
  try{
    const user =await User.findOne({firebaseUid: req.userId});
    if(!user?.walletAddress)return res.json([]);

    const escrows =await Escrow.find({receiverAddress: user.walletAddress,status: 'created'}).sort({createdAt: -1 }).limit(20);
    res.json(escrows);

  }catch(err){
    console.error('pending escrows error:',err.message);
    res.status(500).json({error: err.message});
  }
});

router.get('/rate', async (req,res)=> {
  try{

    const {ethers } =await import('ethers');
    const provider = new ethers.JsonRpcProvider(config.polygonRpcUrl);

    const abi= ['function getConversionRate() view returns (uint256 rate, uint8 decimals)'];
    const contract=new ethers.Contract(config.oracleProxyAddress, abi, provider);



    const [rate, decimals]= await contract.getConversionRate();
    const adjusted=Number(rate)/ 10 ** Number(decimals);

    res.json({ rate: adjusted, raw: rate.toString(), decimals: Number(decimals) });
  } catch(err){
    console.error('rate error:', err.message);
    res.status(503).json({error: 'rate unavailable'});
  }
});

// deducts inr, relayer sends usdc
router.post('/onramp',auth, async(req,res)=>{
  try{
    const {amount,token='usdc'}=req.body;
    if(!amount || amount <= 0)return res.status(400).json({error: 'invalid amount'});
    if(!config.tokens[token])return res.status(400).json({ error: 'unsupported token'});

    const user = await User.findOne({firebaseUid: req.userId });
    if(!user) return res.status(404).json({ error: 'user not found'});

    if(user.balance < amount) return res.status(400).json({error: 'insufficient balance'});

    if (!user.walletAddress) {
      // atomic claim — stops race on concurrent requests
      const claimed=await User.findOneAndUpdate(
        {firebaseUid: req.userId,walletAddress: null},
        {$set:{ walletPending: true}},
        { new: true }
      );

      if(claimed){
        const{createWallet}=await import('./erebor.js');
        const w=await createWallet(user.firebaseUid);
        await User.updateOne(
          { firebaseUid: req.userId },
          {$set:{walletAddress: w.address,ereborWalletId: w.walletId},$unset:{walletPending: ''}}
        );
        user.walletAddress =w.address;
        user.ereborWalletId= w.walletId;
      }else{

        const refreshed=await User.findOne({ firebaseUid: req.userId });
        user.walletAddress = refreshed.walletAddress;
        user.ereborWalletId=refreshed.ereborWalletId;
      }
    }

    const{ethers}=await import('ethers');
    const {relayTx}= await import('./relayer.js');

    const stableAmount=await inrToStable(amount,token);

    const tx = await Transaction.create({ userId: user.id, type: 'send', amount, currency: 'inr', status: 'processing', recipient: user.walletAddress });

    try {
      const iface= new ethers.Interface([
        'function transfer(address to, uint256 value) returns (bool)',
      ]);

      const t=config.tokens[token];
      const data=iface.encodeFunctionData('transfer',[user.walletAddress,ethers.parseUnits(String(stableAmount), t.decimals)]);

      user.balance -= amount;
      await user.save();

      const txHash=await relayTx(t.address, data);

      tx.status= 'completed';
      tx.stripeId= txHash;

      await tx.save();

      res.json({txHash, walletAddress: user.walletAddress,amount: stableAmount,token});
    } catch(err){
      tx.status= 'failed';

      await tx.save();

      user.balance += amount;
      await user.save();

      throw err;
    }

  }catch(err){
    console.error('onramp error:',err.message);
    res.status(500).json({error: err.message });
  }
});

//fatf r.16 — log originator/beneficiary over threshold
async function logTravelRule(user,receiverAddress,amount,txHash,token,txId){
  const{ TravelRuleRecord }=await import('./models.js');

  await TravelRuleRecord.create({
    txId,
    originatorName: user.kyc?.verifiedName || user.name || user.email,
    originatorWallet: user.walletAddress,
    beneficiaryWallet: receiverAddress,
    amount,
    currency: 'inr',
    token,
    txHash,
    thresholdMet: amount >= 1000,
  });
}

router.post('/remit', auth, async(req,res) =>{
  try{
    const{receiverAddress, amount,lockPeriod=259200, token = 'usdc' } = req.body;

    if (!receiverAddress || !amount) return res.status(400).json({error: 'missing receiver or amount'});

    const user=await User.findOne({firebaseUid: req.userId});
    if(!user)return res.status(404).json({error: 'user not found'});
    user.lastIp=req.ip;

    if (!user.walletAddress) return res.status(400).json({error: 'no wallet, deposit first'});

    const fee =Math.ceil(amount * config.remitFeePercent / 100);
    if (user.balance < amount + fee) return res.status(400).json({error: 'insufficient balance'});

    const{ethers} =await import('ethers');


    if(!ethers.isAddress(receiverAddress)){
      return res.status(400).json({ error: 'invalid receiver address'});
    }

    // deduct first, refund on failure
    user.balance -= amount + fee;
    await user.save();

    try {
      const {ethers }=await import('ethers');
      const{ relayTx}=await import('./relayer.js');
      //remit is usdc-only for now. multi-token later if demand
      const usdcAmount=await inrToUsdc(amount);
      const lockedRate =parseFloat((usdcAmount / amount).toFixed(8));


      const iface =new ethers.Interface([
        'function createRemittance(address receiver, uint256 amount, uint256 lockPeriod) returns (bytes32)',
      ]);

      const data=iface.encodeFunctionData('createRemittance',[receiverAddress,ethers.parseUnits(String(usdcAmount), 6), lockPeriod]);

      const txHash=await relayTx(config.remittanceEscrowAddress,data);

      const tx =await Transaction.create({ userId: user._id,type: 'send', amount,currency: 'inr',status: 'completed',recipient: receiverAddress,fee,lockedRate});
      res.json({txHash, receiverAddress,amount: usdcAmount,token: 'usdc', lockPeriod});

      logTravelRule(user, receiverAddress, amount,txHash, 'usdc',tx._id).catch(() =>{});
      import('./suspicious.js').then(m => m.default(user, amount)).catch(()=> {});

    }catch(err){
      user.balance += amount + fee;
      await user.save();
      throw err;
    }
  }catch(err) {
    console.error('remit error:',err.message);

    res.status(500).json({error: err.message });
  }
});

router.post('/claim',auth, async(req,res)=>{
  try{
    const{ escrowId}=req.body;
    if(!escrowId)return res.status(400).json({error: 'missing escrowId'});

    const escrow=await Escrow.findOne({escrowId});
    if (!escrow)return res.status(404).json({error: 'escrow not found'});

    const user = await User.findOne({firebaseUid: req.userId });
    if(!user)return res.status(404).json({error: 'user not found' });

    if(user.walletAddress !== escrow.receiverAddress) {

      return res.status(403).json({error: 'not the receiver'});
    }

    // age via kyc dob, no zk needed
    const age = ((Date.now() - new Date(user.kyc.verifiedDob).getTime()) / 31557600000) | 0;
    if(age < 18)return res.status(403).json({error: 'KYC age verification required' });

    const{ethers }=await import('ethers');
    const { relayTx}=await import('./relayer.js');
    const iface=new ethers.Interface([
      'function release(bytes32 escrowId)',
    ]);

    const data=iface.encodeFunctionData('release',[escrowId]);

    const txHash= await relayTx(config.remittanceEscrowAddress,data);

    res.json({txHash,escrowId,status: 'released' });
  } catch (err){
    console.error('claim error:',err.message);
    res.status(500).json({error: err.message});
  }
});

//ZK verify route removed — age check uses KYC-verified DOB from Aadhaar

//recover from backup share (mpc: relayer + user shares)
router.post('/recover-wallet',auth, async (req,res) =>{
  try{
    const { backupShare } = req.body;
    if(!backupShare)return res.status(400).json({error: 'backupShare required'});

    const{recoverWallet }= await import('./erebor.js');
    const w=await recoverWallet(req.userId,backupShare);

    await User.updateOne({firebaseUid: req.userId}, { walletAddress: w.address,ereborWalletId: w.walletId});
    res.json({walletAddress: w.address });
  } catch(err) {

    console.error('recover-wallet error:', err.message);
    res.status(500).json({error: err.message});
  }
});

// did:web routes, no registry, no contract
router.post('/did/create',auth,async(req,res)=> {
  try{
    const user=await User.findOne({firebaseUid: req.userId});
    if (!user) return res.status(404).json({ error: 'user not found' });
    if(user.did)return res.json({did: user.did,document: user.didDocument});
    const{ createDidWeb,buildDidDocument } = await import('./did.js');


    const did=createDidWeb(req.userId);
    const doc=buildDidDocument(req.userId,user.walletAddress);
    await User.updateOne({ firebaseUid: req.userId},{ did,didDocument: doc});
    res.json({did, document: doc});
  }catch(err){res.status(500).json({error: err.message});}
});

router.get('/did',auth,async(req, res)=>{
  const user=await User.findOne({firebaseUid: req.userId});
  if (!user?.did)return res.status(404).json({ error: 'no DID' });
  res.json({ did: user.did, document: user.didDocument });
});

router.get('/did/:uid',async (req,res) =>{
  const user = await User.findOne({ firebaseUid: req.params.uid });
  if(!user?.didDocument)return res.status(404).json({error: 'DID not found'});
  res.json(user.didDocument);
});

router.post('/did/issue-kyc-vc',auth, requireAdmin,async(req, res) =>{
  const user = await User.findOne({firebaseUid: req.body.uid });

  if(!user?.did) return res.status(400).json({error: 'user has no DID'});
  if (user.kyc?.status !== 'verified') return res.status(400).json({ error: 'KYC not verified' });
  const{issueVc}=await import('./did.js');
  const vc =issueVc(user.did,{
    name: user.kyc.verifiedName,
    ageVerified: true,
    nationality: 'IN',
    kycTimestamp: user.kyc.verifiedAt?.toISOString(),
  });
  res.json({ vc });
});

//admin — basic email check, no role model needed
function requireAdmin(req,res,next){
  if(!config.adminEmails.length)return res.status(403).json({error: 'no admins configured'});
  User.findOne({firebaseUid: req.userId}).select('email').then(u =>{
    if(!u || !config.adminEmails.includes(u.email)) return res.status(403).json({error: 'not authorized' });
    next();
  }).catch(() => res.status(500).json({error: 'auth error'}));
}

router.get('/admin/travel-rule',auth, requireAdmin,async (req, res) =>{
  const {TravelRuleRecord}=await import('./models.js');
  const records =await TravelRuleRecord.find().sort({createdAt: -1}).limit(100);
  res.json(records);

});

router.get('/admin/sar',auth,requireAdmin,async(req,res) =>{
  const{SuspiciousActivityReport }=await import('./models.js');
  const reports =await SuspiciousActivityReport.find().sort({createdAt: -1}).limit(100);
  res.json(reports);
});

router.post('/admin/sar/:id/review',auth,requireAdmin, async (req,res)=>{
  const{SuspiciousActivityReport}=await import('./models.js');

  await SuspiciousActivityReport.updateOne({ _id: req.params.id},{reviewed: true});
  res.json({ ok: true});
});

export default router;
