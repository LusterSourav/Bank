// FATF R.16 travel rule stub. real integration needs a VASP lookup + TRISA/openVASP.
import config from './config.js';
import logger from './logger.js';

const TRAVEL_THRESHOLD=3000;

async function submitTravelRule(tx){
  if(!config.travelRuleApiKey){
    logger.debug({txId:tx.id},'travel rule skipped: no api key');
    return{skipped:true,reason:'no_api_key'};
  }
  // TODO: wire to TRISA or openVASP when we have a key
  logger.info({txId:tx.id,amount:tx.amount},'travel rule submitted');
  return{submitted:true,txId:tx.id};
}

async function needsTravelRule(amount){
  return amount>=TRAVEL_THRESHOLD;
}

export{submitTravelRule,needsTravelRule};
