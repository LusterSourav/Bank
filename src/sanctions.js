// static OFAC SDN crypto addresses, check before remit
// ponytail: hardcoded list, swap for chainalysis API when volume justifies it
const SANCTIONED_ADDRESSES=new Set([
  '0x8589427373d6d84e98730d7795d8f6f8731fda16',
  '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
  '0xae36713e740156d411d8e52036a48a6ba8d7d08b',
]);

export function isSanctioned(address){
  if(!address)return false;
  return SANCTIONED_ADDRESSES.has(address.toLowerCase());
}

export default isSanctioned;
