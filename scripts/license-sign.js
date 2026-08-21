#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';

function loadPrivateKey(){
  if(process.env.LICENSE_PRIVATE_KEY){
    return Buffer.from(process.env.LICENSE_PRIVATE_KEY,'base64url');
  }

  const keyPath=process.argv[2];
  if(keyPath&&fs.existsSync(keyPath)){
    return Buffer.from(fs.readFileSync(keyPath,'utf8').trim(),'base64url');
  }

  return null;
}

function genKeyPair(){
  const{publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  return{
    pub:publicKey.export({type:'spki',format:'der'}).subarray(-32),
    priv:privateKey.export({type:'pkcs8',format:'der'}).subarray(-32)
  };
}

function sign(privKey,payload,meta={}){
  const sig=crypto.sign(null,Buffer.from(payload),privKey);
  return Buffer.from(JSON.stringify({payload,ts:Date.now(),meta,sig:sig.toString('base64url')})).toString('base64url');
}

function prompt(q){
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  return new Promise(r=>rl.question(q,a=>{rl.close();r(a.trim());}));
}

async function main(){
  let priv=loadPrivateKey();

  if(!priv){
    console.log('No private key found. Generating new key pair.');
    const kp=genKeyPair();
    priv=kp.priv;
    const pubB64=kp.pub.toString('base64');
    console.log(`\nPublic key (embed in src/license.js): ${pubB64}`);
    const savePath=await prompt('Save private key to file (leave blank to skip): ');
    if(savePath){
      fs.writeFileSync(savePath,kp.priv.toString('base64url'));
      console.log(`Private key saved to ${savePath}`);
    }
    console.log('IMPORTANT: Store the private key securely outside this repo.\n');
  }

  const licensee=await prompt('Licensee name/entity: ');
  const expiresStr=await prompt('Expiration date (YYYY-MM-DD) or blank for no expiry: ');
  const features=await prompt('Permitted features (comma-separated) or blank for all: ');

  const payload=`bank-license-v3:${licensee}`;

  const meta={};
  if(licensee)meta.licensee=licensee;
  if(expiresStr){
    const exp=new Date(expiresStr+'T23:59:59Z');
    if(isNaN(exp.getTime())){console.error('invalid date');process.exit(1);}
    meta.expires=exp.getTime();
  }
  if(features)meta.features=features.split(',').map(f=>f.trim());

  const key=sign(priv,payload,meta);

  console.log('\n=== LICENSE_KEY ===');
  console.log(key);
  console.log('==================\n');
  console.log('Set this as the LICENSE_KEY environment variable.');
}

main().catch(e=>{console.error(e.message);process.exit(1);});
