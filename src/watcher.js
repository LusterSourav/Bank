import{ ethers}from 'ethers';


import config from './config.js';

//15s poll for escrow events. not real-time, fine for mvp.
const abi=[
  'event EscrowCreated(bytes32 indexed escrowId, address indexed sender, address indexed receiver, uint256 amount, uint256 lockUntil)',
  'event EscrowReleased(bytes32 indexed escrowId)',
  'event EscrowDisputed(bytes32 indexed escrowId)',
  'event EscrowRefunded(bytes32 indexed escrowId)',
];



export function startWatching(){
  const provider =new ethers.JsonRpcProvider(config.polygonRpcUrl);
  const contract =new ethers.Contract(config.remittanceEscrowAddress, abi, provider);
  let lastBlock;




  setInterval(async ()=>{
    try {
      const current=await provider.getBlockNumber();
      if (!lastBlock) { lastBlock=current;return; }



      const events=await contract.queryFilter('*',lastBlock, current);
      for(const e of events){


        // dynamic import avoids circular deps at startup
        const { Escrow } = await import('./models.js');



        if(e.event === 'EscrowCreated'){


          await Escrow.create({
            escrowId: e.args.escrowId,
            senderAddress: e.args.sender,
            receiverAddress: e.args.receiver,
            amount: Number(e.args.amount),
            lockUntil: new Date(Number(e.args.lockUntil) * 1000),
            status: 'created',
          });
        } else if(e.event === 'EscrowReleased') {

          await Escrow.updateOne({ escrowId: e.args.escrowId }, { status: 'released' });



        }else if(e.event === 'EscrowDisputed'){


          await Escrow.updateOne({escrowId: e.args.escrowId }, {status: 'disputed' });
        }else if(e.event === 'EscrowRefunded') {


          await Escrow.updateOne({escrowId: e.args.escrowId}, { status: 'refunded'});



        }



      }


      lastBlock =current;
    } catch(err){
      console.error('watcher error:',err.message);

    }

  },15000);

}

