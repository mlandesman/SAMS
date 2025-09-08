// scripts/fetchDOF.js
// A simplified script to just fetch DOF exchange rates and output them to console
// without worrying about database storage

import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';

/**
 * Format a date as DD/MM/YYYY for the DOF URL (DOF site uses / in URLs)
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted date string
 */
function formatDateForDOF(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert a date from European format (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 * @param {string} dateEU - Date in DD-MM-YYYY format
 * @returns {string} Date in YYYY-MM-DD format
 */
function convertDateEUtoISO(dateEU) {
  const [day, month, year] = dateEU.split('-');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch DOF exchange rates from the Mexican government website
 * @param {string} dateStart - Start date in DD/MM/YYYY format
 * @param {string} dateEnd - End date in DD/MM/YYYY format
 * @returns {Promise<Array>} Array of [date (YYYY-MM-DD), rate] pairs
 */
async function fetchDOFRates(dateStart, dateEnd) {
  try {
    console.log(`🔍 Fetching exchange rates from ${dateStart} to ${dateEnd}`);
    const dofStart = `https://dof.gob.mx/indicadores_detalle.php?cod_tipo_indicador=158&dfecha=${dateStart}`;
    const dofEnd = `&hfecha=${dateEnd}#gsc.tab=0`;
    const url = dofStart + dofEnd;

    console.log(`📡 URL: ${url}`);
    // Ignore SSL certificate validation for the Mexican government website
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const results = [];
    
    // Based on the HTML you shared, the table rows with class "Celda 1" contain the data
    $('tr[class="Celda 1"]').each((index, element) => {
      // First td contains the date, second td contains the rate
      const dateCell = $(element).find('td').eq(0);
      const rateCell = $(element).find('td').eq(1);
      
      if (dateCell.text() && rateCell.text()) {
        // Extract date in DD-MM-YYYY format
        const dateText = dateCell.text().trim();
        const datePattern = /(\d{2})-(\d{2})-(\d{4})/;
        const dateMatch = dateText.match(datePattern);
        
        if (dateMatch) {
          const euDate = dateMatch[0];
          const isoDate = convertDateEUtoISO(euDate);
          
          // Extract rate value
          const rateText = rateCell.text().trim();
          const ratePattern = /(\d+\.\d+)/;
          const rateMatch = rateText.match(ratePattern);
          
          if (rateMatch) {
            const rate = parseFloat(rateMatch[1]);
            results.push([isoDate, rate]);
            console.log(`✓ ${isoDate}: ${rate}`);
          }
        }
      }
    });
    
    if (results.length > 0) {
      console.log(`📊 Found ${results.length} exchange rates`);
    } else {
      console.log('⚠️ No exchange rates found in the HTML. Check the URL or date range.');
    }
    
    return results;
  } catch (error) {
    console.error('❌ Error fetching DOF rates:', error.message);
    return [];
  }
}

/**
 * Fetch and display rates for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format (optional, defaults to today)
 */
async function fetchAndDisplayRatesForRange(startDate, endDate = null) {
  // Convert ISO dates to DOF format
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  const dofStartDate = formatDateForDOF(start);
  const dofEndDate = formatDateForDOF(end);
  
  console.log(`🗓️ Fetching rates from ${dofStartDate} to ${dofEndDate}`);
  
  const rates = await fetchDOFRates(dofStartDate, dofEndDate);
  
  if (rates.length > 0) {
    console.log('\n📈 Exchange Rates Summary:');
    console.log('-------------------------');
    console.log('Date (ISO)    | MXN Rate | USD Rate (1/MXN)');
    console.log('-------------------------');
    
    rates.forEach(([date, mxnRate]) => {
      const usdRate = 1 / mxnRate;
      const roundedUsdRate = usdRate.toFixed(5);
      console.log(`${date} | ${mxnRate.toFixed(6)} | ${roundedUsdRate}`);
    });
    
    console.log('-------------------------');
    console.log(`🏁 Successfully processed ${rates.length} rates`);
  } else {
    console.log('⚠️ No rates found for the specified period');
  }
}

// Command-line processing
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('⚠️ No date range specified. Using default (last 7 days)');
  // Get date from 7 days ago to now
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  
  fetchAndDisplayRatesForRange(startDate)
    .then(() => console.log('🏁 Finished fetching recent rates'))
    .catch(err => console.error('❌ Error:', err));
} else if (args.length >= 1) {
  const startDate = args[0];
  const endDate = args[1] || null;
  
  fetchAndDisplayRatesForRange(startDate, endDate)
    .then(() => console.log('🏁 Finished fetching rates for specified range'))
    .catch(err => console.error('❌ Error:', err));
} else {
  console.log('Usage: node fetchDOF.js [startDate] [endDate]');
  console.log('Dates should be in YYYY-MM-DD format');
  console.log('If no dates are provided, rates for the last 7 days will be fetched');
}
