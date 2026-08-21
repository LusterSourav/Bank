import{Router}from 'express';
import{ethers }from 'ethers';
import logger from '../logger.js';

const router = Router();
const GIG_KEY=process.env.GIG_WEBHOOK_SECRET || '';

router.post('/gig-completed',async(req,res)=>{
  if(GIG_KEY && req.headers['x-gig-key']!== GIG_KEY){
    return res.status(401).json({error: 'bad key'});
  }
  try{
    const{jobId,workerWallet,clientWallet,amount}=req.body;
    if (!jobId || !workerWallet || !amount){
      return res.status(400).json({error: 'missing required fields'});
    }
    //ponytail: no public gig apis. trust is based on client kyc/did.
    const {User} =await import('../models.js');
    const client= clientWallet ? await User.findOne({walletAddress: clientWallet}).select('did kyc.status'): null;
    const clientTrusted=client?.did && client?.kyc?.status === 'verified';
    const lockPeriod=clientTrusted ? 60 : 259200;

    const{ relayTx}=await import('../relayer.js');
    const cfg = (await import('../config.js')).default;
    const iface = new ethers.Interface([
      'function createRemittance(address receiver, uint256 amount, uint256 lockPeriod) returns (bytes32)',
    ]);
    const data=iface.encodeFunctionData('createRemittance',[workerWallet,amount,lockPeriod]);
    const txHash=await relayTx(cfg.remittanceEscrowAddress,data);

    res.json({status: 'escrow_created',txHash,jobId,clientTrusted,lockPeriod });
  }catch(err){
    logger.error({err:err.message}, 'gig webhook error');
    res.status(500).json({error: err.message});
  }
});

export default router;
