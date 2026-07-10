// Currency formatting for INR, BTC, USD, EUR, GBP, AED, SGD.
// INR uses en-IN locale for lakh/crore notation. BTC shows 5 decimals.
// formatAmount() returns the raw number without the symbol prefix.
// ponytail: static maps, no Intl.NumberFormat (except toLocaleString). Replace
//           with Intl.NumberFormat if locale-sensitive formatting needs grow.
const SYMBOLS = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
  BTC: '₿',
  USDC: '$',
};

const DECIMALS = {
  BTC: 5,
  USDC: 2,
  USD: 2,
  INR: 0,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SGD: 2,
};

export function formatCurrency(amount, currency) {
  const symbol = SYMBOLS[currency] ?? currency;
  const decimals = DECIMALS[currency] ?? 2;

  if (currency === 'INR') {
    return `${symbol}${Math.round(amount).toLocaleString('en-IN')}`;
  }

  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatAmount(amount, currency) {
  const decimals = DECIMALS[currency] ?? 2;
  if (currency === 'BTC') return amount.toFixed(decimals);
  if (currency === 'INR') return Math.round(amount).toLocaleString('en-IN');
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
