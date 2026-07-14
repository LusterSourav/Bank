// ponytail: IP fraud scoring via IPASIS (free tier: 3,000 req/month).
// Uses validate-email endpoint with dummy email to get IP risk score.
const IPASIS_URL = 'https://api.ipasis.com/v1/validate-email';

export async function scoreIp(ip) {
  const key = process.env.IPASIS_API_KEY;
  if (!key) {
    // ponytail: no API key = skip scoring, return neutral
    return { score: 0, proxy: false, vpn: false, tor: false, country: '', city: '', asn: '', mobile: false };
  }

  try {
    const resp = await fetch(`${IPASIS_URL}?email=check@bank.app&ip=${ip}`, {
      headers: { 'X-API-Key': key },
    });
    const data = await resp.json();
    const r = data.risk || {};
    const ip = data.ip || {};
    const p = ip.privacy || {};
    const a = ip.asn || {};
    return {
      score: r.score ?? 0,
      proxy: p.Proxy ?? false,
      vpn: p.VPN ?? false,
      tor: p.Tor ?? false,
      country: ip.country ?? '',
      city: ip.city ?? '',
      asn: a.ASN ?? '',
      mobile: false,
      risk: r.level ?? 'unknown',
    };
  } catch {
    return { score: 0, proxy: false, vpn: false, tor: false, country: '', city: '', asn: '', mobile: false };
  }
}

export function isHighRisk(result) {
  return result.score > 80 || result.proxy || result.vpn || result.tor;
}


