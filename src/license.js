import crypto from 'crypto';

const PUB_KEY=Buffer.from('R+SpIpMxbhWlsviwWRAXhnqjQMv6msCGnBxvNpmCLBs=','base64');

function decodeKey(raw){
  return JSON.parse(Buffer.from(raw,'base64url').toString());
}

function validate(keyStr){
  if(!keyStr)return{ok:false,error:'no key'};

  let decoded;
  try{decoded=decodeKey(keyStr);}
  catch(e){return{ok:false,error:'malformed key'};}

  const{payload,ts,sig,meta}=decoded;
  if(typeof payload!=='string')return{ok:false,error:'missing payload'};
  if(typeof sig!=='string')return{ok:false,error:'missing signature'};

  try{
    const ok=crypto.verify(null,Buffer.from(payload),PUB_KEY,Buffer.from(sig,'base64url'));
    if(!ok)return{ok:false,error:'invalid signature'};
  }catch(e){return{ok:false,error:'verify failed'};}

  if(!payload.startsWith('bank-license-v3:'))return{ok:false,error:'wrong key type'};

  if(meta&&meta.expires){
    const now=Date.now();
    if(now>meta.expires)return{ok:false,error:'key expired'};
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

export{validate,check};
