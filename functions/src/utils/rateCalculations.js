function calculateMxnToCop(mxnToUsdRate, usdToCopRate) {
  if (!mxnToUsdRate || !mxnToUsdRate.rate || !usdToCopRate) {
    return null;
  }
  
  const mxnToCopRate = mxnToUsdRate.rate * usdToCopRate;
  
  return {
    rate: mxnToCopRate,
    source: 'Colombian Government',
    calculatedFrom: 'USD/COP rate via MXN/USD',
    usdToCopRate: usdToCopRate
  };
}

function validateRate(rate) {
  return rate && 
         typeof rate === 'number' && 
         !isNaN(rate) && 
         rate > 0 && 
         rate < 1000000;
}

function formatRate(rate, decimals = 6) {
  return parseFloat(rate.toFixed(decimals));
}

export {
  calculateMxnToCop,
  validateRate,
  formatRate
};