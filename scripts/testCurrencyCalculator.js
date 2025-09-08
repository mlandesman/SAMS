/**
 * Test script to verify currency calculator conversion logic
 */

// Simulate the conversion logic from our component
function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!amount || !rates?.rates) return null;
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) return null;
  
  if (fromCurrency === toCurrency) {
    return numAmount;
  }
  
  // All rates are stored as [Currency] to MXN
  // For any conversion, convert through MXN as base
  let mxnAmount;
  
  // Convert from source currency to MXN
  if (fromCurrency === 'MXN') {
    mxnAmount = numAmount;
  } else {
    const fromRate = rates.rates[fromCurrency];
    if (!fromRate || fromRate === 0) return null;
    mxnAmount = numAmount * fromRate;
  }
  
  // Convert from MXN to target currency
  if (toCurrency === 'MXN') {
    return mxnAmount;
  } else {
    const toRate = rates.rates[toCurrency];
    if (!toRate || toRate === 0) return null;
    return mxnAmount / toRate;
  }
}

// Mock exchange rate data based on backend test results
const mockRates = {
  rates: {
    USD: 19.0898,      // USD to MXN
    CAD: 13.8985,      // CAD to MXN  
    EUR: 21.8931,      // EUR to MXN
    COP: 1/213.5339,   // COP to MXN (inverted from MXN to COP)
    MXN: 1             // Base currency
  }
};

console.log('🧮 Testing Currency Calculator Logic\n');

// Test cases
const testCases = [
  { amount: '100', from: 'USD', to: 'MXN', expected: 1908.98 },
  { amount: '100', from: 'MXN', to: 'USD', expected: 5.24 },
  { amount: '1000', from: 'USD', to: 'EUR', expected: 872.39 },
  { amount: '50', from: 'CAD', to: 'COP', expected: 148611.82 },
  { amount: '100', from: 'EUR', to: 'USD', expected: 114.68 },
  { amount: '0', from: 'USD', to: 'MXN', expected: null },
  { amount: 'invalid', from: 'USD', to: 'MXN', expected: null },
  { amount: '100', from: 'USD', to: 'USD', expected: 100 }
];

testCases.forEach((test, index) => {
  const result = convertCurrency(test.amount, test.from, test.to, mockRates);
  const passed = result === test.expected || (result !== null && test.expected !== null && Math.abs(result - test.expected) < 0.01);
  
  console.log(`Test ${index + 1}: ${test.amount} ${test.from} → ${test.to}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got: ${result}`);
  console.log(`  ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);
});

// Test currency formatting
const formatCurrency = (amount, currency) => {
  if (!amount) return '';
  
  const formatters = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    CAD: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }),
    EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
    MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
  };
  
  return formatters[currency]?.format(amount) || `${amount.toFixed(2)} ${currency}`;
};

console.log('💰 Testing Currency Formatting\n');

const formatTests = [
  { amount: 1234.56, currency: 'USD' },
  { amount: 1234.56, currency: 'EUR' },
  { amount: 1234567, currency: 'COP' },
  { amount: 1234.56, currency: 'MXN' },
  { amount: 1234.56, currency: 'CAD' }
];

formatTests.forEach(test => {
  const formatted = formatCurrency(test.amount, test.currency);
  console.log(`${test.amount} ${test.currency} → ${formatted}`);
});

console.log('\n🎯 Calculator Logic Test Complete!');