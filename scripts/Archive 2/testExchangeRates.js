// scripts/testExchangeRates.js
const { getExchangeRateForDate } = require('../src/utils/exchangeRates');

async function runTest() {
  const dateToCheck = '2025-05-04'; // Change this if you want
  const currency = 'USD'; // Or 'EURO', 'CAD', etc. later

  console.log(`🔎 Looking up exchange rate for ${currency} on ${dateToCheck}...`);

  const rate = await getExchangeRateForDate(dateToCheck, currency);

  if (rate !== null) {
    console.log(`✅ Exchange rate on ${dateToCheck}: 1 MXP = ${rate} ${currency}`);
  } else {
    console.error(`❌ No exchange rate found for ${dateToCheck} (${currency})`);
  }
}

runTest();