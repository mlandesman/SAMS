const cheerio = require('cheerio');
const https = require('https');
const axios = require('axios');

/**
 * Fetch DOF (Diario Oficial de la Federación) exchange rates
 * This is the official Mexican government exchange rate for legal/customs purposes
 */

/**
 * Format date for DOF URL (DD/MM/YYYY)
 */
function formatDateForDOF(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert DOF date format (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 */
function convertDOFDateToISO(dateStr) {
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch DOF rates for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} Rates by date { 'YYYY-MM-DD': rate }
 */
async function fetchDOFRates(startDate, endDate) {
  try {
    const dofStartDate = formatDateForDOF(startDate);
    const dofEndDate = formatDateForDOF(endDate);
    
    const url = `https://dof.gob.mx/indicadores_detalle.php?cod_tipo_indicador=158&dfecha=${dofStartDate}&hfecha=${dofEndDate}#gsc.tab=0`;
    
    console.log(`Fetching DOF rates from ${dofStartDate} to ${dofEndDate}`);
    
    // Use axios for better SSL handling
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // DOF site has certificate issues
      })
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    const ratesByDate = {};
    
    // Parse the table rows with class "Celda 1"
    $('tr[class="Celda 1"]').each((index, element) => {
      const dateCell = $(element).find('td').eq(0);
      const rateCell = $(element).find('td').eq(1);
      
      if (dateCell.text() && rateCell.text()) {
        // Extract date in DD-MM-YYYY format
        const dateText = dateCell.text().trim();
        const datePattern = /(\d{2})-(\d{2})-(\d{4})/;
        const dateMatch = dateText.match(datePattern);
        
        if (dateMatch) {
          const dofDate = dateMatch[0];
          const isoDate = convertDOFDateToISO(dofDate);
          
          // Extract rate value
          const rateText = rateCell.text().trim();
          const ratePattern = /(\d+\.\d+)/;
          const rateMatch = rateText.match(ratePattern);
          
          if (rateMatch) {
            const rate = parseFloat(rateMatch[1]);
            ratesByDate[isoDate] = rate;
          }
        }
      }
    });
    
    console.log(`Found ${Object.keys(ratesByDate).length} DOF rates`);
    return ratesByDate;
    
  } catch (error) {
    console.error('Failed to fetch DOF rates:', error);
    throw error;
  }
}

/**
 * Fetch DOF rate for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {number|null} Exchange rate or null if not found
 */
async function fetchDOFRate(date) {
  try {
    const rates = await fetchDOFRates(date, date);
    return rates[date] || null;
  } catch (error) {
    console.error(`Failed to fetch DOF rate for ${date}:`, error);
    return null;
  }
}

module.exports = {
  fetchDOFRates,
  fetchDOFRate
};