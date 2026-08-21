import {z} from 'zod';
import logger from './logger.js';

// wrap zod schemas into express middleware
export function validate(schema){
  return(req,res,next)=>{
    const r=schema.safeParse({
      body:req.body,
      params:req.params,
      query:req.query,
    });
    if(r.error){
      const msg=r.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');
      return res.status(400).json({error:msg});
    }
    req.body=r.data.body;
    req.params=r.data.params;
    next();
  };
}

const posNum={amount:z.number().positive()};
const trimmed=(min,max)=>z.string().trim().min(min||1).max(max||500);
const ethAddr=trimmed(1,42).regex(/^0x[0-9a-fA-F]{40}$/,'invalid ethereum address');
const ifscCode=trimmed(11,11).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/,'invalid ifsc code');

export const schemas={
  upiCollect:z.object({body:z.object(posNum)}),
  deposit:z.object({body:z.object({...posNum,currency:trimmed(1,8).optional()})}),
  send:z.object({body:z.object({amount:z.number().positive(),recipient:ethAddr,currency:trimmed(1,8).optional()})}),
  onramp:z.object({body:z.object({...posNum,token:trimmed(1).optional()})}),
  remit:z.object({body:z.object({receiverAddress:ethAddr,amount:z.number().positive(),lockPeriod:z.number().positive().optional(),token:trimmed(1).optional()})}),
  claim:z.object({body:z.object({escrowId:trimmed(1)})}),
  recoverWallet:z.object({body:z.object({backupShare:trimmed(1)})}),
  sendLimit:z.object({body:z.object({sendLimit:z.number().min(500).max(500000)})}),
  profile:z.object({body:z.object({name:trimmed(1,100)})}),
  notifPrefs:z.object({body:z.object({phone:trimmed(1,15).optional(),notifyWhatsApp:z.boolean().optional()})}),
  beneficiaries:z.object({body:z.object({name:trimmed(1,100),ifsc:ifscCode.optional(),accountNumber:trimmed(1,20).optional(),currency:trimmed(1,8).optional()})}),
  orderStatus:z.object({params:z.object({orderId:trimmed(1)})}),
  didUid:z.object({params:z.object({uid:trimmed(1)})}),
  issueKycVc:z.object({body:z.object({uid:trimmed(1)})}),
  sarReview:z.object({params:z.object({id:trimmed(1)})}),
};
