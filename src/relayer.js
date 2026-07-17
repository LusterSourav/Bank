import{ ethers} from 'ethers';
import config from './config.js';

let provider;
let wallet;

function init() {
  provider=new ethers.JsonRpcProvider(config.polygonRpcUrl);
  wallet=new ethers.Wallet(config.polygonRelayerKey, provider);
}

// direct eth_sendTransaction. gelato relay when we get the api key.
export async function relayTx(to,data,value= 0) {
  if(!wallet)init();
  const nonce=await provider.getTransactionCount(wallet.address,'pending');
  const fee=await provider.getFeeData();
  const gasLimit=await provider.estimateGas({to,data,value,from: wallet.address}).catch(()=>300000n);
  const tx=await wallet.sendTransaction({
    to,data,value,nonce,
    gasLimit,
    ...(fee.gasPrice
      ?{gasPrice: fee.gasPrice }
      :{maxFeePerGas: fee.maxFeePerGas,maxPriorityFeePerGas: fee.maxPriorityFeePerGas }),
  });
  const receipt=await tx.wait();
  if(!receipt || receipt.status === 0)throw new Error('tx reverted');
  return receipt.hash;
}