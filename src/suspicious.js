// sar rules, runs after each send/remit. not a full aml suite.
import{scoreIp,isHighRisk}from './fraud/ip.js';
import{sendEmailNotification}from './notifications.js';
import config from './config.js';
import logger from './logger.js';

const REMIT_THRESHOLD=100000;
const STRUCTURE_WINDOW=3600000;
const RAPID_TX_WINDOW=300000;
const MAX_TX_PER_WINDOW=3;

async function checkSuspicious(user,amount){
  const{SuspiciousActivityReport,Transaction}=await import('./models.js');
  const alerts=[];

  const recentRemits=await Transaction.find({
    userId:user._id,type:'send',
    createdAt:{$gte:new Date(Date.now()-STRUCTURE_WINDOW)},
  });
  const structured=recentRemits.reduce((sum,t)=>sum+t.amount,0)+amount;
  if(structured>REMIT_THRESHOLD&&amount<REMIT_THRESHOLD&&recentRemits.length>=2){
    alerts.push({
      userId:user._id,rule:'structuring',severity:'high',
      description:`${recentRemits.length+1} remits totalling ${structured} INR in 1hr`,
    });
  }

  if(recentRemits.filter(t=>t.createdAt>new Date(Date.now()-RAPID_TX_WINDOW)).length>=MAX_TX_PER_WINDOW){
    alerts.push({
      userId:user._id,rule:'rapid_fire',severity:'medium',
      description:`>${MAX_TX_PER_WINDOW} remits in 5min`,
    });
  }

  // real ip scoring via ipasis — falls back to skip if no key
  if(user.lastIp){
    try{
      const result=await scoreIp(user.lastIp);
      if(isHighRisk(result)){
        alerts.push({
          userId:user._id,rule:'high_risk_ip',severity:'high',
          description:`high-risk IP: ${user.lastIp}, score: ${result.score}, proxy: ${result.proxy}, vpn: ${result.vpn}, tor: ${result.tor}`,
        });
      }
    }catch{
      // ipasis down, don't block
    }
  }

  for(const a of alerts)await SuspiciousActivityReport.create(a);

  // fire-and-forget admin alerts for high severity
  if(alerts.some(a=>a.severity==='high')&&config.adminEmails.length){
    const summary=alerts.filter(a=>a.severity==='high').map(a=>`${a.rule}: ${a.description}`).join('\n');
    sendEmailNotification(config.adminEmails[0],`SAR Alert: ${alerts.length} flagged`,`<p>${summary.replace(/\n/g,'<br>')}</p>`,user._id,'sar').catch(()=>{});
  }

  return alerts;
}



export default checkSuspicious;
