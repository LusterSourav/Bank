//thin wrapper over erebor rest api (self-hosted rust wallet)
import config from './config.js';

const BASE= config.ereborUrl;

async function ereborFetch(path,body){
  const res= await fetch(`${BASE}${path}`,{

    method: 'POST',
    headers:{ 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err =await res.text();
    throw new Error(`erebor: ${err}`);
  }
  return res.json();
}

export async function createWallet(uid){
  const{ walletId,address}=await ereborFetch('/api/v1/wallet', {userId: uid});
  return{walletId,address};
}

//2-of-3: relayer share + user backup share
async function recoverWallet(uid,backupShare){

  const relayerShare= config.ereborRelayerShare;
  const{walletId,address}=await ereborFetch('/api/v1/recover',{
    share1: relayerShare,
    share2: backupShare,
  });
  return{walletId,address};


}
