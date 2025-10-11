// src/utils/exchangeRates.js
const { getDb } = require('../firebase');
const db = getDb();

/**
 * Get the exchange rate for a specific date.
 * If no exact match, find the nearest prior date.
 *
 * @param {string} dateString - Date in 'YYYY-MM-DD' format.
 * @param {string} currency - Currency field, e.g., 'USD'.
 * @returns {Promise<number|null>} The exchange rate or null if not found.
 */
async function getExchangeRateForDate(dateString, currency = 'USD') {
  try {
    const snapshot = await db
      .collection('exchangeRates')
      .where('__name__', '<=', dateString)
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`❌ No exchange rate found on or before ${dateString} (${currency})`);
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data && data[currency] !== undefined) {
      return data[currency];
    } else {
      console.warn(`❌ No ${currency} rate found for date ${doc.id}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching exchange rate:', error);
    return null;
  }
}

module.exports = { getExchangeRateForDate };