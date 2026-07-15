// currency formatting. inr uses en-IN for lakh/crore notation.
// ponytail: static maps, swap to Intl.NumberFormat if locale needs grow
const SYMBOLS ={

  USD: '$',INR: '₹', EUR: '€',GBP: '£',
  AED: 'د.إ', SGD: 'S$',BTC: '₿',USDC: '$',
};

const DECIMALS = {

  BTC: 5, USDC: 6, USD: 2, INR: 0,
  EUR: 2,GBP: 2, AED: 2, SGD: 2,
};

export function formatCurrency(amount, currency){
  const symbol = SYMBOLS[currency] ?? currency;
  const decimals = DECIMALS[currency] ?? 2;



  if(currency === 'INR'){
    return `${symbol}${Math.round(amount).toLocaleString('en-IN')}`;
  }

  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

}
