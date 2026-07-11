// ponytail: IP fraud scoring via IPASIS (free tier: 1,000/day).
// Returns score 0-100 where 0 = clean, 100 = definite proxy/VPN.
const IPASIS_URL = 'https://ipasis.com/api/v1';

export async function scoreIp(ip) {
  const key = process.env.IPASIS_API_KEY;
  if (!key) {
    // ponytail: no API key = skip scoring, return neutral
    return { score: 0, proxy: false, vpn: false, tor: false, country: '', city: '', asn: '', mobile: false };
  }

  try {
    const resp = await fetch(`${IPASIS_URL}/${ip}?key=${key}`);
    const data = await resp.json();
    return {
      score: data.trust_score ?? 0,
      proxy: data.is_proxy ?? false,
      vpn: data.is_vpn ?? false,
      tor: data.is_tor ?? false,
      country: data.country ?? '',
      city: data.city ?? '',
      asn: data.asn ?? '',
      mobile: data.is_mobile ?? false,
      risk: data.risk_level ?? 'unknown',
    };
  } catch {
    return { score: 0, proxy: false, vpn: false, tor: false, country: '', city: '', asn: '', mobile: false };
  }
}

export function isHighRisk(result) {
  return result.score > 80 || result.proxy || result.vpn || result.tor;
}

export function isMediumRisk(result) {
  return result.score > 50 || (result.country && !result.mobile);
}
