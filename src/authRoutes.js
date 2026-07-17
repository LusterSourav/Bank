import {Router}from 'express';
import{auth}from './middleware.js';
import{User}from './models.js';
import{generateSecret,generateQrDataUrl,verifyToken, generateBackupCodes, verifyBackupCode}from './totp.js';
import{encrypt,decrypt}from './encryption.js';
import { signTotpSession,signWebauthnSession}from './totpSession.js';
import{createRegistrationOptions,verifyRegistration,createAuthenticationOptions, verifyAuthentication,getRpId,getOrigin }from './webauthn.js';
import store from './fraud/store.js';

const router=Router();

const isValidToken =(t) => /^\d{6}$/.test(t);

router.post('/totp/setup',auth,async(req, res)=>{
  try {
    const user =await User.findOne({ firebaseUid: req.userId });

    if (!user)return res.status(404).json({error: 'user not found'});

    const{ secret,url}=generateSecret(user._id.toString());
    const qrDataUrl=await generateQrDataUrl(url);

    await User.updateOne({ firebaseUid: req.userId},{$set:{totpSecret: encrypt(secret),totpEnabled: false}});
    res.json({qrDataUrl});

  }catch(e){
    console.error('totp/setup error:', e);
    res.status(500).json({error: e.message});
  }
});

router.post('/totp/verify-enable',auth, async (req,res)=>{
  try {
    const{token }=req.body;


    if(!token || !isValidToken(token))return res.status(400).json({error: 'Valid 6-digit token required' });

    const user =await User.findOne({firebaseUid: req.userId});

    if(!user)return res.status(404).json({error: 'user not found'});


    if (!user.totpSecret) return res.status(400).json({error: 'TOTP not set up' });


    const secret= decrypt(user.totpSecret);
    if(!verifyToken(secret,token)){
      return res.status(400).json({error: 'Invalid token'});
    }

    const{ codes, hashes}=await generateBackupCodes();
    await User.updateOne({firebaseUid: req.userId},{
      $set:{ totpEnabled: true,backupCodes: hashes.map(h =>({hash: h})) },
    });
    res.json({status: 'enabled', backupCodes: codes });
  }catch (e){
    console.error('totp/verify-enable error:',e);


    res.status(500).json({error: e.message });
  }

});

router.post('/totp/verify',auth, async(req,res)=>{
  try{
    const{token,backupCode}=req.body;

    if (!token && !backupCode) return res.status(400).json({ error: 'Token or backup code required' });
    if(token && !isValidToken(token))return res.status(400).json({ error: 'Valid 6-digit token required' });

    const user =await User.findOne({firebaseUid: req.userId});
    if(!user)return res.status(404).json({error: 'user not found'});

    if(!user.totpEnabled || !user.totpSecret){
      return res.status(400).json({error: 'TOTP not enabled'});
    }

    // rate limit totp — 5 per 15min
    if(store.count(`totp:${user._id}`,900000)>= 5){
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    store.append(`totp:${user._id}`,1, 900000);

    let verified=false;
    if(backupCode){
      verified= await verifyBackupCode(user,backupCode);
      if(verified){
        await User.updateOne(
          {firebaseUid: req.userId,'backupCodes.hash': { $in: user.backupCodes.filter(c => !c.used).map(c => c.hash)}},
          {$set:{'backupCodes.$.used': true,'backupCodes.$.usedAt': new Date()} },
        );

      }

    }else{

      const secret = decrypt(user.totpSecret);

      verified=verifyToken(secret,token);
    }

    if (!verified) {
      return res.status(400).json({error: backupCode ? 'Invalid backup code' : 'Invalid token'});
    }

    store.delete(`totp:${user._id}`);
    res.json({status: 'verified', expiresIn: 3600,totpToken: signTotpSession(req.userId) });
  }catch(e){
    console.error('totp/verify error:',e);
    res.status(500).json({error: e.message});
  }
});

router.post('/totp/disable',auth,async (req,res)=>{
  try{
    const{token}=req.body;
    if(!token || !isValidToken(token))return res.status(400).json({error: 'Valid 6-digit token required'});

    const user=await User.findOne({firebaseUid: req.userId});
    if(!user) return res.status(404).json({ error: 'user not found'});

    if(user.totpEnabled && user.totpSecret) {
      const secret=decrypt(user.totpSecret);

      if(!verifyToken(secret,token)){
        return res.status(400).json({error: 'Valid token required to disable TOTP'});
      }
    }

    // also clears backup codes since totp is being fully disabled
    await User.updateOne({firebaseUid: req.userId}, {
      $unset:{totpSecret: '',backupCodes: ''},
      $set: {totpEnabled: false},
    });

    res.json({status: 'disabled' });
  } catch (e) {
    console.error('totp/disable error:',e);
    res.status(500).json({error: e.message});
  }
});

router.get('/totp/status', auth,async(req,res)=>{
  try {
    const user=await User.findOne({firebaseUid: req.userId});

    if (!user)return res.status(404).json({error: 'user not found' });

    const backupCodesRemaining= (user.backupCodes ||[]).filter(c => !c.used).length;
    res.json({enabled: !!user.totpEnabled,hasSecret: !!user.totpSecret,backupCodesRemaining});
  }catch (e){
    console.error('totp/status error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/totp/backup-codes', auth,async(req,res)=> {
  try {
    const{token}=req.body;
    if(!token || !isValidToken(token))return res.status(400).json({ error: 'Valid 6-digit token required'});

    const user =await User.findOne({firebaseUid: req.userId });

    if(!user)return res.status(404).json({ error: 'user not found'});

    if(!user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({error: 'TOTP not enabled'});
    }

    const secret=decrypt(user.totpSecret);
    if (!verifyToken(secret, token)) {
      return res.status(400).json({error: 'Invalid token'});
    }

    const {codes, hashes}= await generateBackupCodes();
    await User.updateOne({firebaseUid: req.userId},{
      $set:{backupCodes: hashes.map(h =>({hash: h}))},
    });

    res.json({backupCodes: codes});
  }catch(e) {
    console.error('totp/backup-codes error:', e);
    res.status(500).json({error: e.message});
  }
});


router.post('/webauthn/register/begin', auth,async(req,res)=>{
  try{
    const user=await User.findOne({ firebaseUid: req.userId});
    if(!user)return res.status(404).json({ error: 'user not found' });
    const email=user.email || user._id.toString();
    const existing=user.webauthnCredentials || [];

    const options =await createRegistrationOptions(user._id.toString(),email,existing,req.headers.host);

    await User.updateOne({ firebaseUid: req.userId},{$set:{ webauthnChallenge: options.challenge}});
    res.json(options);
  }catch (e) {
    res.status(500).json({error: e.message});
  }
});

router.post('/webauthn/register/complete',auth,async(req, res)=>{
  try {
    const user =await User.findOne({firebaseUid: req.userId});
    if (!user) return res.status(404).json({error: 'user not found' });
    if(!user.webauthnChallenge)return res.status(400).json({error: 'No registration in progress' });

    const verification=await verifyRegistration(
      user._id.toString(),
      req.body,
      user.webauthnChallenge,
      req.headers.host,
    );

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({error: 'WebAuthn registration failed'});
    }


    const {credential}=verification.registrationInfo;

    await User.updateOne({firebaseUid: req.userId},{
      $push: {
        webauthnCredentials: {
          credentialId: Buffer.from(credential.id).toString('base64url'),
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: req.body.response?.transports?.length ? req.body.response.transports :['internal'],
          authenticatorAttachment: req.body.response?.authenticatorAttachment || '',
          deviceName: req.body.deviceName || 'Unknown device',
          registeredAt: new Date(),
        },
      },
      $unset:{webauthnChallenge: ''},
    });

    res.json({status: 'registered'});
  } catch(e){
    res.status(500).json({error: e.message});
  }
});

router.get('/webauthn/credentials',auth,async(req, res)=>{
  try{
    const user=await User.findOne({firebaseUid: req.userId});

    if(!user)return res.status(404).json({error: 'user not found'});
    const creds=(user.webauthnCredentials ||[]).map(c =>({

      id: c.credentialId,
      deviceName: c.deviceName,
      authenticatorAttachment: c.authenticatorAttachment,
      registeredAt: c.registeredAt,
    }));

    res.json({credentials: creds,rpId: getRpId(),origin: getOrigin()});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

router.post('/webauthn/authenticate/begin',auth,async (req, res)=>{
  try {
    const user = await User.findOne({firebaseUid: req.userId });
    if(!user) return res.status(404).json({error: 'user not found' });
    const existing=user.webauthnCredentials ||[];
    if(!existing.length)return res.status(400).json({error: 'No biometric credentials registered' });
    const options=await createAuthenticationOptions(existing,req.headers.host);

    await User.updateOne({firebaseUid: req.userId},{ $set: { webauthnChallenge: options.challenge}});
    res.json(options);
  } catch (e){
    res.status(500).json({error: e.message });
  }
});



router.post('/webauthn/authenticate/complete',auth,async(req, res)=>{
  try{
    const user= await User.findOne({firebaseUid: req.userId});
    if(!user)return res.status(404).json({ error: 'user not found'});

    if(!user.webauthnChallenge)return res.status(400).json({error: 'No authentication in progress'});



    const credentialId = req.body.id;
    const storedCred=(user.webauthnCredentials ||[]).find(
      c => Buffer.from(c.credentialId, 'base64url').toString('base64url')=== credentialId
    );
    if(!storedCred)return res.status(400).json({error: 'Credential not found' });


    const credential={
      id: Buffer.from(storedCred.credentialId,'base64url'),
      publicKey: Buffer.from(storedCred.publicKey, 'base64url'),
      counter: storedCred.counter,
      transports: storedCred.transports?.length ? storedCred.transports : ['internal'],
    };

    const verification =await verifyAuthentication(req.body,user.webauthnChallenge,credential,req.headers.host);

    if(!verification.verified){
      return res.status(400).json({error: 'Authentication failed'});
    }

    await User.updateOne(
      {firebaseUid: req.userId, 'webauthnCredentials.credentialId': storedCred.credentialId},
      {$set:{'webauthnCredentials.$.counter': verification.authenticationInfo?.newCounter || storedCred.counter }},
    );

    await User.updateOne({firebaseUid: req.userId},{$unset: { webauthnChallenge: '' }});

    res.json({status: 'authenticated',webauthnToken: signWebauthnSession(req.userId)});
  }catch (e){
    res.status(500).json({error: e.message});
  }
});

router.delete('/webauthn/credentials/:id',auth,async(req,res) =>{
  try{
    const user= await User.findOne({firebaseUid: req.userId});
    if(!user)return res.status(404).json({error: 'user not found'});
    await User.updateOne(
      { firebaseUid: req.userId },
      { $pull: { webauthnCredentials:{ credentialId: req.params.id} } },
    );

    res.json({status: 'removed'});
  }catch (e) {
    res.status(500).json({error: e.message });
  }
});

router.get('/device/fingerprints', auth,async(req,res)=>{
  try {
    const user =await User.findOne({firebaseUid: req.userId});
    if (!user) return res.status(404).json({ error: 'user not found'});

    res.json({devices: user.deviceFingerprints || []});
  }catch(e){
    console.error('device/fingerprints error:', e.message);
    res.status(500).json({error: 'failed to get devices'});


  }
});

router.post('/device/fingerprint', auth,async(req,res)=> {
  try {
    const{hash}=req.body;
    if(!hash)return res.status(400).json({error: 'Hash required' });

    const user=await User.findOne({firebaseUid: req.userId});
    if(!user) return res.status(404).json({error: 'user not found'});

    const existing=(user.deviceFingerprints ||[]).find(d => d.hash === hash);
    const now=new Date();

    if (existing){

      await User.updateOne(
        { firebaseUid: req.userId,'deviceFingerprints.hash': hash},
        {$set: {'deviceFingerprints.$.lastSeen': now}},
      );
    } else{
      await User.updateOne(
        {firebaseUid: req.userId},
        { $push: { deviceFingerprints: { hash, firstSeen: now, lastSeen: now} }},
      );
    }

    res.json({status: 'recorded'});
  }catch (e){
    res.status(500).json({error: e.message});
  }
});

export default router;
