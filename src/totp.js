import {TOTP,Secret}from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const APP_NAME ='Sendly';
const BACKUP_CODE_COUNT=10;
const BACKUP_CODE_BYTES=5;// 5 bytes = 10 hex chars → XXXX-XXXX

export function generateSecret(userId) {
  const s=new Secret({size: 20});
  const totp=new TOTP({
    issuer: APP_NAME,
    label: userId,
    secret: s,
    digits:6,period:30,
  });
  return{secret:s.base32,url: totp.toString()};
}

// svg avoids node-canvas dep, works in vercel serverless
export async function generateQrDataUrl(url){
  const svg=await QRCode.toString(url, {type: 'svg',width:240,margin:2,color:{dark:'#000',light:'#fff'}});

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function verifyToken(secret,token){
  const totp=new TOTP({
    issuer:APP_NAME,label:'verify',secret,digits:6,period:30,
  });
  const delta=totp.validate({token,window:1});

  return delta!==null;
}

export async function generateBackupCodes(){


  const codes=[],hashes=[];
  for(let i=0;i<BACKUP_CODE_COUNT;i++){
    const bytes=crypto.randomBytes(BACKUP_CODE_BYTES);
    const code=bytes.toString('hex').toUpperCase().replace(/(.{4})/g,'$1-').slice(0,-1);
    codes.push(code);
    hashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }
  return{codes,hashes};

}

export async function verifyBackupCode(user,code){

  const normalized=code.toUpperCase().trim();
  for(const entry of user.backupCodes||[]){
    if(entry.used)continue;
    if(crypto.createHash('sha256').update(normalized).digest('hex')===entry.hash)return true;
  }
  return false;
}