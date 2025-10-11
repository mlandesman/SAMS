import { getDb } from '../firebase.js';
import { getMexicoDateString, getMexicoDate, logMexicoTime } from '../utils/timezone.js';
import { getNow } from '../services/DateService.js';

/**
 * Get all exchange rate records (for List Management display)
 */
export const getAllExchangeRates = async (req, res) => {
  try {
    console.log('📊 Fetching all exchange rate records for display...');
    
    const db = await getDb();
    
    // Query all exchange rates, ordered by document ID (date) descending (newest first)
    const snapshot = await db.collection('exchangeRates')
      .orderBy('__name__', 'desc') // Sort by document ID (YYYY-MM-DD format)
      .get();
    
    const exchangeRates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id; // This is the date in YYYY-MM-DD format
      
      exchangeRates.push({
        id: docId,
        date: docId,
        dateFormatted: formatDateForDisplay(docId),
        rates: data.rates || {},
        lastUpdated: data.lastUpdated,
        source: data.source || 'Unknown',
        ...data // Include any other fields
      });
    });
    
    console.log(`✅ Retrieved ${exchangeRates.length} exchange rate records`);
    
    res.json({
      success: true,
      data: exchangeRates,
      count: exchangeRates.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching all exchange rates:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch exchange rates',
      message: error.message 
    });
  }
};

/**
 * Format date string (YYYY-MM-DD) for human-readable display
 */
function formatDateForDisplay(dateStr) {
  try {
    const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    return dateStr; // Fallback to original string
  }
}

/**
 * Get exchange rates for a specific date or the most recent rate before that date
 * Steps backward chronologically to find the rate that was in effect
 * @param {string} req.params.date - Date in YYYY-MM-DD format
 */
export const getExchangeRatesForDate = async (req, res) => {
  try {
    const requestedDate = req.params.date;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Expected YYYY-MM-DD'
      });
    }
    
    console.log(`📊 Getting exchange rates for ${requestedDate} or most recent before...`);
    
    const db = await getDb();
    
    // Use the __name__ index to efficiently query for dates <= requested date
    // Order by document ID (date) descending and limit to 1 to get the most recent
    const snapshot = await db.collection('exchangeRates')
      .where('__name__', '<=', requestedDate)
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log(`❌ No exchange rates found for ${requestedDate} or any date before it`);
      return res.status(404).json({
        success: false,
        error: 'No exchange rates found for the requested date or any date before it',
        requestedDate: requestedDate
      });
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    const actualDate = doc.id;
    
    console.log(`✅ Found exchange rates for ${actualDate} (requested: ${requestedDate})`);
    
    res.json({
      success: true,
      requestedDate: requestedDate,
      actualDate: actualDate,
      dateFormatted: formatDateForDisplay(actualDate),
      isExactMatch: actualDate === requestedDate,
      data: {
        id: actualDate,
        date: actualDate,
        dateFormatted: formatDateForDisplay(actualDate),
        rates: data.rates || {},
        lastUpdated: data.lastUpdated,
        source: data.source || 'Unknown',
        ...data
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching exchange rates for date:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch exchange rates for date',
      message: error.message 
    });
  }
};

/**
 * Get current exchange rates (today's or most recent available)
 */
export const checkExchangeRates = async (req, res) => {
  try {
    // Use Mexico timezone for consistent date calculations
    // Removed: logMexicoTime() - was causing console spam
    const dateStr = getMexicoDateString();
    
    // Removed console logging to reduce noise
    // console.log(`🔍 Getting exchange rates for ${dateStr} (Mexico timezone)`);
    
    const db = await getDb();
    
    // First try to get today's rate
    const todayDoc = await db.collection('exchangeRates').doc(dateStr).get();
    
    if (todayDoc.exists) {
      // Removed console logging to reduce noise
      // console.log(`📊 Found current exchange rate for ${dateStr}`);
      res.json({ 
        exists: true,
        date: dateStr,
        data: todayDoc.data(),
        current: true
      });
      return;
    }
    
    // If today's rate doesn't exist, get the most recent rate
    // Removed console logging to reduce noise
    // console.log(`📊 No rate for ${dateStr}, finding most recent rate...`);
    
    // Order by document ID (which is the date string YYYY-MM-DD)
    const recentSnapshot = await db.collection('exchangeRates')
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();
    
    if (!recentSnapshot.empty) {
      const recentDoc = recentSnapshot.docs[0];
      const recentData = recentDoc.data();
      const recentDate = recentDoc.id;
      
      // Removed console logging to reduce noise
      // console.log(`✅ Found fallback rate from ${recentDate} for requested ${dateStr}`);
      // console.log(`📊 Fallback rate data available: ${recentData ? 'Yes' : 'No'}`);
      
      res.json({ 
        exists: true,
        date: recentDate,
        data: recentData,
        current: false,
        fallback: true,
        requestedDate: dateStr
      });
    } else {
      // Log only errors or critical issues
      console.error(`❌ No exchange rates found in database at all`);
      res.json({ 
        exists: false,
        date: dateStr,
        data: null,
        message: 'No exchange rate data available'
      });
    }
  } catch (error) {
    console.error('❌ Error getting exchange rates:', error);
    res.status(500).json({ error: 'Failed to get exchange rates' });
  }
};

/**
 * Fetch and store exchange rates from external APIs
 */
export const fetchExchangeRates = async (req, res) => {
  try {
    // Use Mexico timezone for consistent date calculations
    logMexicoTime();
    const dateStr = getMexicoDateString();
    const today = getNow();
    
    // Check if it's a weekday (Monday = 1, Friday = 5)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('📅 Weekend detected - skipping exchange rate fetch');
      return res.json({ 
        skipped: true, 
        reason: 'Weekend - no exchange rates available',
        date: dateStr
      });
    }
    
    console.log(`🔄 Fetching exchange rates for ${dateStr}...`);
    
    // Fetch from Banxico API (USD, CAD, EUR)
    const banxicoData = await fetchBanxicoRates();
    
    // Fetch from Colombian API (COP)
    const copData = await fetchColombianRates();
    
    // Calculate MXN to COP rate
    const mxnToUsd = 1 / banxicoData.SF43718.rate;
    const usdToCop = copData.rate;
    const mxnToCop = mxnToUsd * usdToCop;
    
    // Prepare exchange rates document
    const exchangeRates = {
      date: dateStr,
      lastUpdated: getNow(),
      rates: {
        MXN_USD: {
          rate: mxnToUsd,
          source: 'Banxico',
          seriesId: 'SF43718',
          originalRate: banxicoData.SF43718.rate,
          title: banxicoData.SF43718.title
        },
        MXN_CAD: {
          rate: 1 / banxicoData.SF60632.rate,
          source: 'Banxico',
          seriesId: 'SF60632',
          originalRate: banxicoData.SF60632.rate,
          title: banxicoData.SF60632.title
        },
        MXN_EUR: {
          rate: 1 / banxicoData.SF46410.rate,
          source: 'Banxico',
          seriesId: 'SF46410',
          originalRate: banxicoData.SF46410.rate,
          title: banxicoData.SF46410.title
        },
        MXN_COP: {
          rate: mxnToCop,
          source: 'Colombian Government',
          calculatedFrom: 'USD/COP rate via MXN/USD',
          usdToCopRate: usdToCop
        }
      }
    };
    
    // Store in Firestore
    const db = await getDb();
    await db.collection('exchangeRates').doc(dateStr).set(exchangeRates);
    
    console.log(`✅ Exchange rates saved for ${dateStr}`);
    console.log(`   MXN -> USD: ${mxnToUsd.toFixed(6)}`);
    console.log(`   MXN -> CAD: ${(1 / banxicoData.SF60632.rate).toFixed(6)}`);
    console.log(`   MXN -> EUR: ${(1 / banxicoData.SF46410.rate).toFixed(6)}`);
    console.log(`   MXN -> COP: ${mxnToCop.toFixed(6)}`);
    
    res.json({
      success: true,
      date: dateStr,
      rates: exchangeRates.rates
    });
    
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch exchange rates',
      details: error.message 
    });
  }
};

/**
 * Fetch exchange rates from Banxico API
 */
async function fetchBanxicoRates() {
  const TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';
  const series = ['SF43718', 'SF60632', 'SF46410']; // USD, CAD, EUR
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/oportuno?mediaType=json&token=${TOKEN}`;
  
  console.log('🌐 Calling Banxico API...');
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SAMS-Exchange-Rate-Service/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Banxico API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const output = {};
  
  data.bmx.series.forEach(s => {
    output[s.idSerie] = {
      title: s.titulo,
      rate: parseFloat(s.datos[0].dato),
      date: s.datos[0].fecha
    };
  });
  
  console.log('✅ Banxico rates fetched successfully');
  return output;
}

/**
 * Fetch Colombian peso exchange rate
 */
async function fetchColombianRates() {
  const url = 'https://www.datos.gov.co/resource/ceyp-9c7c.json?$order=vigenciadesde DESC&$limit=1';
  
  console.log('🌐 Calling Colombian government API...');
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SAMS-Exchange-Rate-Service/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Colombian API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const rate = parseFloat(data[0].valor);
  
  console.log('✅ Colombian COP rate fetched successfully');
  return {
    rate,
    date: data[0].vigenciadesde
  };
}

/**
 * Check for missing exchange rates and fill gaps
 * This handles cases where the app wasn't started for several days
 */
export const fillMissingRates = async (req, res) => {
  try {
    console.log('🔍 Checking for missing exchange rate gaps...');
    
    const today = getNow();
    const db = await getDb();
    
    // Find the most recent exchange rate document
    const collection = db.collection('exchangeRates');
    const recentSnapshot = await collection.orderBy('date', 'desc').limit(1).get();
    
    let startDate;
    if (recentSnapshot.empty) {
      // No data exists, start from 30 days ago
      startDate = getNow();
      startDate.setDate(startDate.getDate() - 30);
      console.log('📊 No existing data found, starting from 30 days ago');
    } else {
      // Start from the day after the most recent data
      const mostRecentDate = recentSnapshot.docs[0].data().date;
      startDate = new Date(mostRecentDate);
      startDate.setDate(startDate.getDate() + 1);
      console.log(`📊 Most recent data: ${mostRecentDate}, checking from ${startDate.toISOString().split('T')[0]}`);
    }
    
    // Get all weekdays between start date and today
    const missingDates = [];
    const current = new Date(startDate);
    
    while (current < today) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        const dateStr = current.toISOString().split('T')[0];
        
        // Check if this date already exists
        const doc = await db.collection('exchangeRates').doc(dateStr).get();
        if (!doc.exists) {
          missingDates.push(new Date(current));
        }
      }
      current.setDate(current.getDate() + 1);
    }
    
    if (missingDates.length === 0) {
      console.log('✅ No missing exchange rates found');
      return res.json({
        success: true,
        message: 'No missing rates found',
        missingCount: 0
      });
    }
    
    console.log(`📊 Found ${missingDates.length} missing weekdays, fetching rates...`);
    
    // Fetch rates for missing dates
    let processed = 0;
    let failed = 0;
    
    for (const date of missingDates) {
      try {
        const success = await fetchRatesForDate(date, db);
        if (success) {
          processed++;
        } else {
          failed++;
        }
        
        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error processing ${date.toISOString().split('T')[0]}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Gap filling completed: ${processed} successful, ${failed} failed`);
    
    res.json({
      success: true,
      message: `Filled missing exchange rates`,
      processed,
      failed,
      totalMissing: missingDates.length
    });
    
  } catch (error) {
    console.error('❌ Error filling missing rates:', error);
    res.status(500).json({ 
      error: 'Failed to fill missing exchange rates',
      details: error.message 
    });
  }
};

/**
 * Fetch exchange rates for a specific historical date
 */
async function fetchRatesForDate(date, db) {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    console.log(`🔄 Fetching rates for ${dateStr}...`);
    
    // Fetch from Banxico API (historical data)
    const banxicoData = await fetchBanxicoHistoricalRates(date);
    
    // Fetch current Colombian rate (fallback for historical)
    const copData = await fetchColombianRates();
    
    if (!banxicoData || !banxicoData.SF43718) {
      console.log(`⚠️ No USD rate available for ${dateStr}`);
      return false;
    }
    
    // Calculate MXN rates
    const mxnToUsd = 1 / banxicoData.SF43718.rate;
    const usdToCop = copData.rate;
    const mxnToCop = mxnToUsd * usdToCop;
    
    // Prepare exchange rates document
    const exchangeRates = {
      date: dateStr,
      lastUpdated: getNow(),
      source: 'Gap Fill',
      rates: {
        MXN_USD: {
          rate: mxnToUsd,
          source: 'Banxico',
          seriesId: 'SF43718',
          originalRate: banxicoData.SF43718.rate,
          title: banxicoData.SF43718.title
        },
        MXN_COP: {
          rate: mxnToCop,
          source: 'Colombian Government (current rate)',
          calculatedFrom: 'USD/COP rate via MXN/USD',
          usdToCopRate: usdToCop
        }
      }
    };
    
    // Add CAD if available
    if (banxicoData.SF60632) {
      exchangeRates.rates.MXN_CAD = {
        rate: 1 / banxicoData.SF60632.rate,
        source: 'Banxico',
        seriesId: 'SF60632',
        originalRate: banxicoData.SF60632.rate,
        title: banxicoData.SF60632.title
      };
    }
    
    // Add EUR if available
    if (banxicoData.SF46410) {
      exchangeRates.rates.MXN_EUR = {
        rate: 1 / banxicoData.SF46410.rate,
        source: 'Banxico',
        seriesId: 'SF46410',
        originalRate: banxicoData.SF46410.rate,
        title: banxicoData.SF46410.title
      };
    }
    
    // Store in Firestore
    await db.collection('exchangeRates').doc(dateStr).set(exchangeRates);
    
    console.log(`✅ Stored rates for ${dateStr}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error fetching rates for ${dateStr}:`, error);
    return false;
  }
}

/**
 * Fetch historical rates from Banxico for a specific date
 */
async function fetchBanxicoHistoricalRates(date) {
  const TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';
  const series = ['SF43718', 'SF60632', 'SF46410']; // USD, CAD, EUR
  
  // Format date for Banxico API (dd/MM/yyyy)
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/${dateStr}/${dateStr}?mediaType=json&token=${TOKEN}`;
  
  console.log(`🌐 Calling Banxico historical API for ${dateStr}...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SAMS-Exchange-Rate-Service/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Banxico API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.bmx || !data.bmx.series) {
    return null;
  }
  
  const output = {};
  data.bmx.series.forEach(s => {
    if (s.datos && s.datos.length > 0 && s.datos[0].dato !== 'N/E') {
      output[s.idSerie] = {
        title: s.titulo,
        rate: parseFloat(s.datos[0].dato),
        date: s.datos[0].fecha
      };
    }
  });
  
  return output;
}

/**
 * Daily exchange rates update - runs on user login
 * Checks for gaps and fills them automatically
 */
export const dailyExchangeRatesUpdate = async (req, res) => {
  try {
    console.log('🌅 Starting daily exchange rates update...');
    
    // Import the quickUpdateRates function
    const { quickUpdateRates } = await import('../../scripts/bulkImportExchangeRates.js');
    
    // Run the quick update (fills gaps automatically)
    await quickUpdateRates();
    
    console.log('✅ Daily exchange rates update completed');
    
    res.json({ 
      success: true,
      message: 'Daily exchange rates update completed',
      timestamp: getNow().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Daily exchange rates update failed:', error);
    
    // Don't fail the login if exchange rates update fails
    res.json({ 
      success: false,
      error: error.message,
      message: 'Exchange rates update failed, but login can continue',
      timestamp: getNow().toISOString()
    });
  }
};

/**
 * Manual trigger for exchange rates update (for testing or manual runs)
 */
export const manualExchangeRatesUpdate = async (req, res) => {
  try {
    console.log('🔧 Starting manual exchange rates update...');
    
    const { mode = 'quick', startDate, endDate, dryRun = false } = req.body || {};
    
    // Import the functions
    const { quickUpdateRates, bulkImportHistoricalRates } = await import('../../scripts/bulkImportExchangeRates.js');
    
    let result;
    
    if (mode === 'quick') {
      result = await quickUpdateRates({ dryRun });
    } else if (mode === 'bulk') {
      result = await bulkImportHistoricalRates({ 
        fullReplacement: true,
        dryRun 
      });
    } else if (mode === 'fill-gaps') {
      result = await bulkImportHistoricalRates({ 
        fillGaps: true,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        dryRun 
      });
    } else {
      throw new Error(`Unknown mode: ${mode}. Use 'quick', 'bulk', or 'fill-gaps'`);
    }
    
    console.log('✅ Manual exchange rates update completed');
    
    res.json({ 
      success: true,
      mode,
      dryRun,
      message: 'Manual exchange rates update completed',
      timestamp: getNow().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual exchange rates update failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: getNow().toISOString()
    });
  }
};
