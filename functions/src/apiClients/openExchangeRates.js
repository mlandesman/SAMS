/**
 * Open Exchange Rates API client
 * Free tier allows 1000 requests/month
 * Provides USD to other currency conversion rates
 */

const OPEN_EXCHANGE_RATES_API_KEY = process.env.OPEN_EXCHANGE_RATES_API_KEY || 'a56bdfb36a414518b21f79c60c1f72a5';
const BASE_URL = 'https://openexchangerates.org/api';

/**
 * Fetch current exchange rates from USD to other currencies
 * @returns {Object} Rates object { CAD: 1.35, EUR: 0.92, COP: 4200, ... }
 */
async function fetchCurrentRates() {
  try {
    const url = `${BASE_URL}/latest.json?app_id=${OPEN_EXCHANGE_RATES_API_KEY}&base=USD&symbols=CAD,EUR,COP`;
    
    console.log('Fetching current rates from Open Exchange Rates...');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Open Exchange Rates API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid response from Open Exchange Rates API');
    }
    
    console.log(`Received rates: CAD=${data.rates.CAD}, EUR=${data.rates.EUR}, COP=${data.rates.COP}`);
    
    return data.rates;
  } catch (error) {
    console.error('Failed to fetch Open Exchange Rates:', error);
    throw error;
  }
}

/**
 * Fetch historical exchange rates for a specific date
 * Note: Historical data requires paid plan on Open Exchange Rates
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Rates object { CAD: 1.35, EUR: 0.92, COP: 4200, ... }
 */
async function fetchHistoricalRates(date) {
  try {
    const url = `${BASE_URL}/historical/${date}.json?app_id=${OPEN_EXCHANGE_RATES_API_KEY}&base=USD&symbols=CAD,EUR,COP`;
    
    console.log(`Fetching historical rates for ${date} from Open Exchange Rates...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Open Exchange Rates API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid response from Open Exchange Rates API');
    }
    
    console.log(`Historical rates for ${date}: CAD=${data.rates.CAD}, EUR=${data.rates.EUR}, COP=${data.rates.COP}`);
    
    return data.rates;
  } catch (error) {
    console.error(`Failed to fetch historical rates for ${date}:`, error);
    throw error;
  }
}

/**
 * Fetch rates for a date range (requires multiple API calls)
 * Note: Be careful with API limits - free tier only allows 1000 calls/month
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} Rates by date { 'YYYY-MM-DD': { CAD: 1.35, EUR: 0.92, COP: 4200 } }
 */
async function fetchRatesForRange(startDate, endDate) {
  const ratesByDate = {};
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate number of days
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`Fetching ${days} days of historical rates from Open Exchange Rates...`);
  console.warn(`Warning: This will use ${days} API calls from your monthly quota`);
  
  const current = new Date(start);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    
    try {
      const rates = await fetchHistoricalRates(dateStr);
      ratesByDate[dateStr] = rates;
      
      // Rate limit: delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to fetch rates for ${dateStr}, skipping...`);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`Successfully fetched rates for ${Object.keys(ratesByDate).length} days`);
  
  return ratesByDate;
}

module.exports = {
  fetchCurrentRates,
  fetchHistoricalRates,
  fetchRatesForRange
};