// ponytail: basic SAR rules — checks patterns after each remit. not a full AML suite.
const HIGH_RISK_COUNTRIES = ['kp','ir', 'sy', 'cu', 'ru'];
const REMIT_THRESHOLD= 100000;
const STRUCTURE_WINDOW = 3600000;
const RAPID_TX_WINDOW=300000;
const MAX_TX_PER_WINDOW = 3;

async function checkSuspicious(user,amount) {
  const{ SuspiciousActivityReport, Transaction} =await import('./models.js');
  const alerts=[];

  const recentRemits = await Transaction.find({


    userId: user._id,type: 'send',
    createdAt:{ $gte: new Date(Date.now()- STRUCTURE_WINDOW)},
  });
  const structured = recentRemits.reduce((sum, t) => sum + t.amount, 0) + amount;
  if (structured > REMIT_THRESHOLD && amount < REMIT_THRESHOLD && recentRemits.length >= 2) {
    alerts.push({

      userId: user._id,rule: 'structuring',
      severity: 'high',
      description: `${recentRemits.length + 1} remits totalling ${structured} INR in 1hr`,
    });
  }

  if (recentRemits.filter(t => t.createdAt > new Date(Date.now() - RAPID_TX_WINDOW)).length >= MAX_TX_PER_WINDOW) {
    alerts.push({
      userId: user._id, rule: 'rapid_fire',
      severity: 'medium',
      description: `>${MAX_TX_PER_WINDOW} remits in 5min`,
    });


  }

  // ponytail: basic geo check — replace with proper IP2Location when volume justifies it
  if (user.lastIp) {
    const ipPart = user.lastIp.split('.').slice(-2).join('.');
    if (HIGH_RISK_COUNTRIES.some(c => ipPart.includes(c))) {
      alerts.push({
        userId: user._id, rule: 'high_risk_country',
        severity: 'high',
        description: `remit from IP near high-risk region: ${user.lastIp}`,
      });


    }
  }

  for (const a of alerts) await SuspiciousActivityReport.create(a);
  return alerts;
}

export default checkSuspicious;
