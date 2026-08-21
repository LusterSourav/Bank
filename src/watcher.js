import{ethers}from 'ethers';
import config from './config.js';
import logger from './logger.js';

//15s poll for escrow events. not real-time, fine for mvp.
const abi=[
  'event EscrowCreated(bytes32 indexed escrowId, address indexed sender, address indexed receiver, uint256 amount, uint256 lockUntil)',
  'event EscrowReleased(bytes32 indexed escrowId)',
  'event EscrowDisputed(bytes32 indexed escrowId)',
  'event EscrowRefunded(bytes32 indexed escrowId)',
  'function refund(bytes32 escrowId)',
];

let pollTimer, refundTimer;



function retry(fn,retries=2){
  return fn().catch(e=> retries > 0 ? retry(fn,retries-1) : Promise.reject(e));
}

export function startWatching(){
  const provider=new ethers.JsonRpcProvider(config.polygonRpcUrl);
  // one contract per token, in case a token ever gets its own escrow
  const contracts=Object.entries(config.escrows)
    .filter(([,addr])=>addr)
    .map(([token,addr])=>({token,contract:new ethers.Contract(addr,abi,provider)}));
  if(contracts.length===0){logger.error('no escrow addresses configured watcher idle');return;}
  let lastBlock;

  pollTimer=setInterval(async()=>{
    try{
      const current=await retry(()=>provider.getBlockNumber());
      if(!lastBlock){lastBlock=current;return;}


      for(const {token,contract} of contracts){
        const events=await retry(()=>contract.queryFilter('*',lastBlock,current));
        for(const e of events){
          const{ Escrow} = await import('./models.js');

          if(e.event === 'EscrowCreated'){
            await Escrow.updateOne(
              {escrowId: e.args.escrowId},
              {$set:{
                senderAddress: e.args.sender,
                receiverAddress: e.args.receiver,
                amount: Number(e.args.amount),
                token,
                escrowAddress: contract.target,
                lockUntil: new Date(Number(e.args.lockUntil)* 1000),
                status: 'created',
              }},
              {upsert: true}
            );
          }else if(e.event === 'EscrowReleased'){
          await Escrow.updateOne({ escrowId: e.args.escrowId},{status: 'released'});
        }else if(e.event === 'EscrowDisputed'){
          await Escrow.updateOne({escrowId: e.args.escrowId},{status: 'disputed'});
        }else if(e.event === 'EscrowRefunded'){
          await Escrow.updateOne({ escrowId: e.args.escrowId}, { status: 'refunded'});
        }
      }
      }
      lastBlock=current;
    }catch(err){
      logger.error({err:err.message}, 'watcher error');

    }

  },15000);

  // checks and refunds expired escrows every 60s. avoids separate cron infra.
  refundTimer=setInterval(async()=>{
    try{
      const{Escrow } =await import('./models.js');
      const {relayTx }=await import('./relayer.js');
      const expired =await Escrow.find({status: 'created',lockUntil:{$lte: new Date()}});
      for(const e of expired){
        const iface =new ethers.Interface(['function refund(bytes32 escrowId)']);
        const data=iface.encodeFunctionData('refund',[e.escrowId]);
        await retry(()=>relayTx(e.escrowAddress || config.remittanceEscrowAddress,data));
        e.status ='refunded';
        await e.save();
      }
    }catch(err){
      logger.error({err:err.message}, 'refund check error');

    }
  },60000);
}

export function stopWatching(){
  clearInterval(pollTimer);
  clearInterval(refundTimer);
}