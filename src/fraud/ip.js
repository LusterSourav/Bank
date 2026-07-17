//ip scoring via ipasis (3k/mo free). fakes email param
const IPASIS_URL='https://api.ipasis.com/v1/validate-email';

export async function scoreIp(ip){
  const key= process.env.IPASIS_API_KEY;

  if(!key){
    return {score: 0, proxy: false, vpn: false, tor: false,country: '', city: '', asn: '', mobile: false};
  }

  try{
    const resp= await fetch(`${IPASIS_URL}?email=check@bank.app&ip=${ip}`,{
      headers:{'X-API-Key': key },
    });

    const data = await resp.json();


    const r=data.risk ||{};
    const ipInfo=data.ip ||{};
    const p=ipInfo.privacy ||{};

    const a=ipInfo.asn ||{};
    return {
      score: r.score ?? 0,
      proxy: p.Proxy ?? false,
      vpn: p.VPN ?? false,
      tor: p.Tor ?? false,
      country: ipInfo.country ?? '',
      city: ipInfo.city ?? '',
      asn: a.ASN ?? '',
      mobile: false,
      risk: r.level ?? 'unknown',
    };
  }catch{
    return{score: 0,proxy: false, vpn: false,tor: false,country: '',city: '',asn: '',mobile: false};
  }

}

export function isHighRisk(result){
  return result.score > 80 || result.proxy || result.vpn || result.tor;

}
