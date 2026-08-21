import crypto from 'crypto';
import fs from 'fs';
import{createRequire}from'module';
const require=createRequire(import.meta.url);

const PUB_KEY=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from('dFcTHv141kSJSgfBzCOpFXu1bDs0r+w+EV5ewpoj/dg=','base64')]),format:'der',type:'spki'});
const EXPECTED_HASH='b1e5f222a0723000c3f8e484852fcbf505125f368cfde7b3b0a3993f9e3cf922';
const LOCAL_PROJECT='bank-app';

function canonicalJson(obj){
  if(obj===null||typeof obj!=='object')return JSON.stringify(obj);
  if(Array.isArray(obj))return'['+obj.map(canonicalJson).join(',')+']';
  return'{' + Object.keys(obj).sort().map(k=>'"'+k+'":'+canonicalJson(obj[k])).join(',') + '}';
}

function selfCheck(){
  try{
    let src;
    try{
      const url=new URL(import.meta.url);
      src=fs.readFileSync(url.pathname,'utf8');
    }catch{
      const m=require.resolve('./license.js');
      src=fs.readFileSync(m,'utf8');
    }
    const stripped=src.replace(/^const EXPECTED_HASH=.*$/m,'');
    const actual=crypto.createHash('sha256').update(stripped).digest('hex');
    if(actual!==EXPECTED_HASH){
      console.error('license integrity check failed');
      process.exit(1);
    }
  }catch(e){
    console.error('license integrity check error');
    process.exit(1);
  }
}

function decodeKey(raw){
  return JSON.parse(Buffer.from(raw,'base64url').toString());
}

function validate(keyStr){
  if(!keyStr)return{ok:false,error:'no key'};

  selfCheck();

  let decoded;
  try{decoded=decodeKey(keyStr);}
  catch(e){return{ok:false,error:'malformed key'};}

  const{payload,ts,sig,meta}=decoded;
  if(typeof payload!=='string')return{ok:false,error:'missing payload'};
  if(typeof sig!=='string')return{ok:false,error:'missing signature'};

  const canonical=canonicalJson({payload,ts,meta});
  const hash=crypto.createHash('sha256').update(canonical).digest();

  try{
    const ok=crypto.verify(null,hash,PUB_KEY,Buffer.from(sig,'base64url'));
    if(!ok)return{ok:false,error:'invalid signature'};
  }catch(e){return{ok:false,error:'verify failed'};}

  if(!payload.startsWith('bank-license-v3:'))return{ok:false,error:'wrong key type'};

  const now=Date.now();

  if(meta&&meta.expires){
    if(now>meta.expires)return{ok:false,error:'key expired'};
  }

  if(meta&&meta.nbf){
    if(now<meta.nbf)return{ok:false,error:'key not yet active'};
  }

  const envProject=process.env.VERCEL_PROJECT_ID||LOCAL_PROJECT;
  if(meta&&meta.project){
    if(meta.project!==envProject){
      return{ok:false,error:'wrong project'};
    }
  }

  const revoked=process.env.REVOKED_KEYS;
  if(revoked){
    const payloadHash=crypto.createHash('sha256').update(payload).digest('hex');
    const list=revoked.split(',').map(s=>s.trim());
    if(list.includes(payloadHash)){
      return{ok:false,error:'key revoked'};
    }
  }

  return{ok:true,meta:meta||{}};
}

function check(){
  const raw=process.env.LICENSE_KEY;
  if(!raw){
    console.error('LICENSE_KEY not set');
    process.exit(1);
  }
  const r=validate(raw);
  if(!r.ok){
    console.error(`license check failed: ${r.error}`);
    process.exit(1);
  }
  return r.meta;
}

export{validate,check,canonicalJson,EXPECTED_HASH};
