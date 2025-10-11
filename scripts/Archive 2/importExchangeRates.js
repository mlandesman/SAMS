// scripts/importExchangeRates.js
const { getDb } = require('../src/firebase');
const fs = require('fs');
const path = require('path');

async function importExchangeRates() {
  const db = getDb();
  const filePath = path.join(__dirname, '../MTCdata/DOFrates.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const rate of data) {
    const originalDate = new Date(rate.date);
    const formattedDate = originalDate.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!rate.mxp || isNaN(rate.mxp)) {
      console.warn(`⚠️ Skipping invalid rate for ${formattedDate}`);
      continue;
    }

    const usdRate = 1 / rate.mxp;
    const roundedUsdRate = parseFloat(usdRate.toFixed(5)); // ✅ Rounded to 5 decimals

    const docRef = db.collection('exchangeRates').doc(formattedDate);
    await docRef.set({
      USD: roundedUsdRate,
    });

    console.log(`✅ Imported ${formattedDate}: USD = ${roundedUsdRate}`);
  }

  console.log('🏁 Finished importing exchange rates.');
}

importExchangeRates().catch((err) => {
  console.error('❌ Error importing exchange rates:', err);
});