import { Router } from 'express';


import{ ethers}from 'ethers';

const router= Router();



//shared secret — gig platform sends as X-Gig-Key header
const GIG_KEY =process.env.GIG_WEBHOOK_SECRET || '';

router.post('/gig-completed',async (req, res)=>{
  if (GIG_KEY && req.headers['x-gig-key'] !== GIG_KEY) {
    return res.status(401).json({error: 'bad key' });




  }

  try{
    const{ jobId,workerWallet, clientWallet,amount,platform}=req.body;
    if (!jobId || !workerWallet || !amount){


      return res.status(400).json({ error: 'missing required fields'});
    }



    const{relayTx}= await import('../relayer.js');
    const cfg= (await import('../config.js')).default;





    const iface =new ethers.Interface([
      'function createRemittance(address receiver, uint256 amount, uint256 lockPeriod) returns (bytes32)',
    ]);
    const data =iface.encodeFunctionData('createRemittance',[workerWallet, amount,259200]);

    const txHash=await relayTx(cfg.remittanceEscrowAddress,data);

    res.json({ status: 'escrow_created', txHash, jobId });


  } catch (err) {




    console.error('gig webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }




});



export default router;




