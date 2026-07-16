import { Router }from 'express';
import{ethers }from 'ethers';
import { verifyJob} from '../gig/platforms.js';

const router = Router();
const GIG_KEY=process.env.GIG_WEBHOOK_SECRET || '';

router.post('/gig-completed',async(req,res) =>{
  if(GIG_KEY && req.headers['x-gig-key'] !== GIG_KEY) {
    return res.status(401).json({ error: 'bad key' });
  }



  try{
    const { jobId,workerWallet, clientWallet,amount, platform }= req.body;
    if (!jobId || !workerWallet || !amount) {
      return res.status(400).json({ error: 'missing required fields'});

    }

    // verify job completion with platform API (best-effort, null = can't verify)
    const verified =platform ? await verifyJob(platform,jobId): null;

    // ponytail: if client has a DID + verified KYC, they're a known entity
    const { User } = await import('../models.js');
    const client = clientWallet ? await User.findOne({ walletAddress: clientWallet }).select('did kyc.status') : null;
    const clientTrusted = client?.did && client?.kyc?.status === 'verified';



    //ponytail: verified jobs from trusted clients get near-instant release
    const lockPeriod = verified === true && clientTrusted ? 60 : 259200;

    const{ relayTx }=await import('../relayer.js');
    const cfg = (await import('../config.js')).default;
    const iface = new ethers.Interface([
      'function createRemittance(address receiver, uint256 amount, uint256 lockPeriod) returns (bytes32)',
    ]);
    const data=iface.encodeFunctionData('createRemittance',[workerWallet,amount, lockPeriod]);
    const txHash =await relayTx(cfg.remittanceEscrowAddress,data);



    res.json({ status: 'escrow_created', txHash, jobId, verified, clientTrusted,lockPeriod });
  }catch (err) {
    console.error('gig webhook error:',err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
