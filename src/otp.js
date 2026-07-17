//email otp gen + verify for kyc binding
import crypto from 'crypto';

export function generateOtp(length=6){
  const max=Math.pow(10,length);

  return crypto.randomInt(0,max).toString().padStart(length,'0');

}

export async function hashOtp(otp){
  return crypto.createHash('sha256').update(otp).digest('hex');


}

export async function verifyOtpHash(otp, hash){
  const h=crypto.createHash('sha256').update(otp).digest('hex');
  return h===hash;
}

export function otpExpiry(minutes=5){
  return new Date(Date.now() + minutes * 60 * 1000);
}