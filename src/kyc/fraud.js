// in-memory velocity + fraud check. redis for prod.
const store={};


function cleanup(key,windowMs){
  if (!store[key])store[key]=[];
  store[key]=store[key].filter(t => Date.now()- t < windowMs);
}

export function checkKycVelocity(userId,deviceFingerprint,ip){
  const now= Date.now();
  const DAY =86400000;



  const userKey=`kyc:u:${userId}`;



  cleanup(userKey,DAY);
  if(store[userKey].length > 3)return{ block: true,reason: 'too_many_kyc_attempts'};
  store[userKey].push(now);

  if(deviceFingerprint) {

    const devKey=`kyc:d:${deviceFingerprint}`;
    cleanup(devKey,DAY);
    store[devKey].push({userId,time: now});
    const users= new Set(store[devKey].map(e => e.userId));
    if(users.size > 2)return{ block: true, reason: 'device_multi_account'};



  }

  if(ip){
    const ipKey=`kyc:i:${ip}`;
    cleanup(ipKey,DAY);
    store[ipKey].push({userId,time: now});


  }

  return{ok: true};
}

export function checkKycTiming(startTime, endTime){
  const seconds=(endTime - startTime)/ 1000;
  if(seconds < 30)return{flag: true,reason: 'bot_speed',seconds};
  return{ok: true,seconds};



}
