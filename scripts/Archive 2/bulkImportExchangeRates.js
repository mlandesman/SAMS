/**
 * One-time bulk import script for historical exchange rates
 * 
 * This script will:
 * 1. Delete all existing exchange rate documents
 * 2. Fetch and store exchange rates from January 1, 2024 to today
 * 3. Only process weekdays (skip weekends)
 * 4. Handle API rate limits with delays
 * 
 * Run this script once to populate historical data with all currencies
 */

// Firebase functions - will be imported dynamically when needed
let firebaseModule = null;

// Dynamic import for Firebase (only when needed)
async function importFirebase() {
  if (!firebaseModule) {
    firebaseModule = await import('../backend/firebase.js');
  }
  return firebaseModule;
}

const BANXICO_TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';

// Banxico series IDs
const BANXICO_SERIES = {
  USD: 'SF43718', // USD to MXN
  CAD: 'SF60632', // CAD to MXN  
  EUR: 'SF46410'  // EUR to MXN
};

/**
 * Generate array of weekday dates between start and end
 */
function getWeekdaysBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Format date for Firestore document ID (YYYY-MM-DD)
 */
function formatDateForStorage(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Format date for Banxico API (dd/MM/yyyy)
 */
function formatDateForBanxico(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert Banxico date format (dd/MM/yyyy) to storage format (yyyy-MM-dd)
 */
function convertBanxicoDateToStorage(banxicoDate) {
  const [day, month, year] = banxicoDate.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Check if a date is within our desired range (2020-01-01 onwards)
 */
function isDateInRange(dateStr, minDate = '2020-01-01') {
  return dateStr >= minDate;
}

/**
 * Fetch bulk historical rates from Banxico (all available data)
 * This works better than individual date requests
 */
async function fetchBanxicoBulkHistoricalRates() {
  const series = Object.values(BANXICO_SERIES);
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos?mediaType=json&token=${BANXICO_TOKEN}`;
  
  console.log('🌐 Fetching bulk historical rates from Banxico...');
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SAMS-Historical-Import/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Banxico API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.bmx || !data.bmx.series) {
      throw new Error('No series data available from Banxico');
    }
    
    // Organize data by date and series
    const ratesByDate = {};
    
    data.bmx.series.forEach(series => {
      const seriesId = series.idSerie;
      const seriesTitle = series.titulo;
      
      if (series.datos) {
        series.datos.forEach(dataPoint => {
          if (dataPoint.dato !== 'N/E' && dataPoint.fecha) {
            const date = dataPoint.fecha; // Format: dd/MM/yyyy
            const rate = parseFloat(dataPoint.dato);
            
            if (!ratesByDate[date]) {
              ratesByDate[date] = {};
            }
            
            ratesByDate[date][seriesId] = {
              title: seriesTitle,
              rate: rate,
              date: date
            };
          }
        });
      }
    });
    
    console.log(`✅ Fetched bulk data for ${Object.keys(ratesByDate).length} dates`);
    return ratesByDate;
    
  } catch (error) {
    console.error('❌ Error fetching bulk Banxico rates:', error.message);
    throw error;
  }
}

/**
 * Fetch historical rates from Banxico for a specific date
 */
async function fetchBanxicoHistoricalRates(date) {
  const series = Object.values(BANXICO_SERIES);
  const dateStr = formatDateForBanxico(date);
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/${dateStr}/${dateStr}?mediaType=json&token=${BANXICO_TOKEN}`;
  
  console.log(`🌐 Fetching Banxico rates for ${dateStr}...`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SAMS-Historical-Import/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Banxico API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.bmx || !data.bmx.series) {
      console.log(`⚠️ No data available for ${dateStr}`);
      return null;
    }
    
    const rates = {};
    data.bmx.series.forEach(s => {
      if (s.datos && s.datos.length > 0 && s.datos[0].dato !== 'N/E') {
        rates[s.idSerie] = {
          title: s.titulo,
          rate: parseFloat(s.datos[0].dato),
          date: s.datos[0].fecha
        };
      }
    });
    
    return rates;
  } catch (error) {
    console.error(`❌ Error fetching Banxico rates for ${dateStr}:`, error.message);
    return null;
  }
}

/**
 * Fetch Colombian peso rate for a specific date
 * Note: Colombian API may not have historical data, so we'll use a fallback approach
 */
async function fetchColombianHistoricalRate() {
  try {
    const url = 'https://www.datos.gov.co/resource/ceyp-9c7c.json?$order=vigenciadesde DESC&$limit=1';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SAMS-Historical-Import/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Colombian API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return parseFloat(data[0].valor);
  } catch (error) {
    console.error('❌ Error fetching Colombian rate:', error.message);
    // Fallback to approximate rate if API fails
    return 4000; // Approximate USD to COP rate
  }
}

/**
 * Process bulk historical rates and store them in Firestore
 * Only stores dates from 2020-01-01 onwards
 */
async function processBulkHistoricalRates(db, bulkRates, copRate, options = {}) {
  const { dryRun = false, minDate = '2020-01-01' } = options;
  
  console.log(`🔄 Processing bulk historical rates (filtering dates from ${minDate} onwards)...`);
  
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  
  // Convert and filter dates
  const validDates = [];
  for (const banxicoDate of Object.keys(bulkRates)) {
    const storageDate = convertBanxicoDateToStorage(banxicoDate);
    if (isDateInRange(storageDate, minDate)) {
      validDates.push({ banxicoDate, storageDate });
    } else {
      skipped++;
    }
  }
  
  console.log(`📊 Found ${validDates.length} dates in range (${skipped} dates before ${minDate} filtered out)`);
  
  if (dryRun) {
    console.log(`📋 DRY RUN: Would process ${validDates.length} dates from ${minDate} onwards`);
    return { processed: validDates.length, failed: 0, skipped };
  }
  
  // Sort dates chronologically for better logging
  validDates.sort((a, b) => a.storageDate.localeCompare(b.storageDate));
  
  for (let i = 0; i < validDates.length; i++) {
    const { banxicoDate, storageDate } = validDates[i];
    const ratesData = bulkRates[banxicoDate];
    
    try {
      // Check if we have USD rate (required)
      if (!ratesData[BANXICO_SERIES.USD]) {
        console.log(`⚠️ Skipping ${storageDate} - no USD rate available`);
        skipped++;
        continue;
      }
      
      // Calculate MXN to other currencies
      const mxnToUsd = 1 / ratesData[BANXICO_SERIES.USD].rate;
      const mxnToCad = ratesData[BANXICO_SERIES.CAD] ? 1 / ratesData[BANXICO_SERIES.CAD].rate : null;
      const mxnToEur = ratesData[BANXICO_SERIES.EUR] ? 1 / ratesData[BANXICO_SERIES.EUR].rate : null;
      const mxnToCop = mxnToUsd * copRate;
      
      // Prepare exchange rates document
      const exchangeRates = {
        date: storageDate,
        lastUpdated: new Date(),
        source: 'Historical Import (Bulk)',
        rates: {
          MXN_USD: {
            rate: mxnToUsd,
            source: 'Banxico',
            seriesId: 'SF43718',
            originalRate: ratesData[BANXICO_SERIES.USD].rate,
            title: ratesData[BANXICO_SERIES.USD].title
          },
          MXN_COP: {
            rate: mxnToCop,
            source: 'Colombian Government (current rate applied)',
            calculatedFrom: 'USD/COP rate via MXN/USD',
            usdToCopRate: copRate
          }
        }
      };
      
      // Add CAD if available
      if (mxnToCad && ratesData[BANXICO_SERIES.CAD]) {
        exchangeRates.rates.MXN_CAD = {
          rate: mxnToCad,
          source: 'Banxico',
          seriesId: 'SF60632',
          originalRate: ratesData[BANXICO_SERIES.CAD].rate,
          title: ratesData[BANXICO_SERIES.CAD].title
        };
      }
      
      // Add EUR if available
      if (mxnToEur && ratesData[BANXICO_SERIES.EUR]) {
        exchangeRates.rates.MXN_EUR = {
          rate: mxnToEur,
          source: 'Banxico',
          seriesId: 'SF46410',
          originalRate: ratesData[BANXICO_SERIES.EUR].rate,
          title: ratesData[BANXICO_SERIES.EUR].title
        };
      }
      
      // Store in Firestore
      await db.collection('exchangeRates').doc(storageDate).set(exchangeRates);
      
      processed++;
      
      // Progress update every 50 dates
      if (processed % 50 === 0) {
        console.log(`📊 Progress: ${processed} dates processed...`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${storageDate}:`, error.message);
      failed++;
    }
  }
  
  return { processed, failed, skipped };
}

/**
 * Process exchange rates for a single date
 */
async function processDateRates(date, db, copRate) {
  const dateStr = formatDateForStorage(date);
  
  try {
    // Fetch Banxico rates for this date
    const banxicoRates = await fetchBanxicoHistoricalRates(date);
    
    if (!banxicoRates || !banxicoRates[BANXICO_SERIES.USD]) {
      console.log(`⚠️ Skipping ${dateStr} - no USD rate available`);
      return false;
    }
    
    // Calculate MXN to other currencies
    const mxnToUsd = 1 / banxicoRates[BANXICO_SERIES.USD].rate;
    const mxnToCad = banxicoRates[BANXICO_SERIES.CAD] ? 1 / banxicoRates[BANXICO_SERIES.CAD].rate : null;
    const mxnToEur = banxicoRates[BANXICO_SERIES.EUR] ? 1 / banxicoRates[BANXICO_SERIES.EUR].rate : null;
    const mxnToCop = mxnToUsd * copRate;
    
    // Prepare exchange rates document
    const exchangeRates = {
      date: dateStr,
      lastUpdated: new Date(),
      source: 'Historical Import',
      rates: {
        MXN_USD: {
          rate: mxnToUsd,
          source: 'Banxico',
          seriesId: 'SF43718',
          originalRate: banxicoRates[BANXICO_SERIES.USD].rate,
          title: banxicoRates[BANXICO_SERIES.USD].title
        },
        MXN_COP: {
          rate: mxnToCop,
          source: 'Colombian Government (current rate applied)',
          calculatedFrom: 'USD/COP rate via MXN/USD',
          usdToCopRate: copRate
        }
      }
    };
    
    // Add CAD if available
    if (mxnToCad) {
      exchangeRates.rates.MXN_CAD = {
        rate: mxnToCad,
        source: 'Banxico',
        seriesId: 'SF60632',
        originalRate: banxicoRates[BANXICO_SERIES.CAD].rate,
        title: banxicoRates[BANXICO_SERIES.CAD].title
      };
    }
    
    // Add EUR if available
    if (mxnToEur) {
      exchangeRates.rates.MXN_EUR = {
        rate: mxnToEur,
        source: 'Banxico',
        seriesId: 'SF46410',
        originalRate: banxicoRates[BANXICO_SERIES.EUR].rate,
        title: banxicoRates[BANXICO_SERIES.EUR].title
      };
    }
    
    // Store in Firestore
    await db.collection('exchangeRates').doc(dateStr).set(exchangeRates);
    
    console.log(`✅ Stored rates for ${dateStr}: USD=${mxnToUsd.toFixed(6)}, CAD=${mxnToCad?.toFixed(6) || 'N/A'}, EUR=${mxnToEur?.toFixed(6) || 'N/A'}, COP=${mxnToCop.toFixed(2)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${dateStr}:`, error.message);
    return false;
  }
}

/**
 * Delete all existing exchange rate documents
 */
async function deleteExistingRates(db) {
  console.log('🗑️ Deleting existing exchange rate documents...');
  
  try {
    const collection = db.collection('exchangeRates');
    const snapshot = await collection.get();
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.docs.length} existing exchange rate documents`);
  } catch (error) {
    console.error('❌ Error deleting existing rates:', error);
    throw error;
  }
}

/**
 * Get existing exchange rate dates from Firestore
 */
async function getExistingRateDates(db) {
  try {
    const collection = db.collection('exchangeRates');
    const snapshot = await collection.get();
    
    const existingDates = new Set();
    snapshot.docs.forEach((doc) => {
      existingDates.add(doc.id); // Document ID is the date string
    });
    
    console.log(`📊 Found ${existingDates.size} existing exchange rate documents`);
    return existingDates;
  } catch (error) {
    console.error('❌ Error fetching existing rates:', error);
    throw error;
  }
}

/**
 * Get missing weekdays that need exchange rates
 */
function getMissingWeekdays(allWeekdays, existingDates) {
  const missing = allWeekdays.filter(date => {
    const dateStr = formatDateForStorage(date);
    return !existingDates.has(dateStr);
  });
  
  console.log(`📊 Found ${missing.length} missing weekdays out of ${allWeekdays.length} total weekdays`);
  return missing;
}

/**
 * Get the latest exchange rate date from Firestore
 */
async function getLatestRateDate(db) {
  try {
    const collection = db.collection('exchangeRates');
    const snapshot = await collection.orderBy('date', 'desc').limit(1).get();
    
    if (snapshot.empty) {
      console.log('📊 No existing exchange rates found');
      return null;
    }
    
    const latestDate = snapshot.docs[0].data().date;
    console.log(`📊 Latest exchange rate date: ${latestDate}`);
    return new Date(latestDate);
  } catch (error) {
    console.error('❌ Error fetching latest rate date:', error);
    throw error;
  }
}

/**
 * Main bulk import function
 * @param {Object} options - Import options
 * @param {boolean} options.fullReplacement - If true, delete all existing data first
 * @param {boolean} options.fillGaps - If true, only import missing dates
 * @param {Date} options.startDate - Custom start date (optional)
 * @param {Date} options.endDate - Custom end date (optional)
 */
async function bulkImportHistoricalRates(options = {}) {
  try {
    let {
      fullReplacement = false,
      fillGaps = false,
      startDate = new Date('2024-01-01'),
      endDate = new Date(),
      dryRun = false
    } = options;
    
    // Ensure dates are Date objects
    if (!(startDate instanceof Date)) {
      startDate = new Date(startDate || '2024-01-01');
    }
    if (!(endDate instanceof Date)) {
      endDate = new Date(endDate || Date.now());
    }
    
    console.log('🚀 Starting historical exchange rates import...');
    console.log(`⚙️ Mode: ${fullReplacement ? 'Full Replacement' : fillGaps ? 'Fill Gaps Only' : 'Standard Import'}${dryRun ? ' (DRY RUN)' : ''}`);
    
    console.log(`📅 Import range: ${formatDateForStorage(startDate)} to ${formatDateForStorage(endDate)}`);
    
    // Get all weekdays in the range
    const allWeekdays = getWeekdaysBetween(startDate, endDate);
    console.log(`📊 Total weekdays in range: ${allWeekdays.length}`);
    
    let weekdaysToProcess;
    
    if (dryRun) {
      // In dry-run mode, simulate the logic without connecting to Firebase
      console.log('🧪 DRY RUN MODE - No data will be modified');
      
      if (fullReplacement) {
        console.log(`📋 Would delete all existing exchange rate documents`);
        console.log(`📋 Would use bulk historical data approach for full replacement`);
        console.log(`📋 Would fetch all historical data from Banxico`);
        console.log(`📋 Would filter to dates from 2020-01-01 onwards`);
        console.log(`📋 Would process all filtered dates at once`);
      } else if (fillGaps) {
        // For dry run, we'll assume some gaps exist
        weekdaysToProcess = allWeekdays.slice(-10); // Simulate last 10 days as missing
        console.log(`📋 Would check for existing dates and fill gaps`);
        console.log(`📋 Simulating ${weekdaysToProcess.length} missing weekdays to import`);
      } else {
        weekdaysToProcess = allWeekdays;
        console.log(`📋 Would import ${weekdaysToProcess.length} weekdays (without deleting existing)`);
      }
      
      if (weekdaysToProcess && weekdaysToProcess.length > 0) {
        console.log(`📋 Would process dates from ${formatDateForStorage(weekdaysToProcess[0])} to ${formatDateForStorage(weekdaysToProcess[weekdaysToProcess.length - 1])}`);
      }
      console.log(`📋 Would fetch Colombian peso rate`);
      console.log(`📋 Would process each date with 1-second delays`);
      if (weekdaysToProcess) {
        console.log(`📋 Estimated time: ${weekdaysToProcess.length} seconds`);
      }
      console.log(`✅ DRY RUN completed - no actual changes made`);
      return;
    }
    
    // Initialize Firebase (only if not dry run)
    const firebase = await importFirebase();
    await firebase.initializeFirebase();
    const db = await firebase.getDb();
    
    if (fullReplacement) {
      // Delete existing data first
      await deleteExistingRates(db);
      
      // Use bulk historical data approach for full replacement
      console.log('🔄 Using bulk historical data approach for full replacement...');
      
      // Get current Colombian peso rate
      console.log('🔄 Fetching current Colombian peso rate...');
      const copRate = await fetchColombianHistoricalRate();
      console.log(`💱 Using COP rate: ${copRate}`);
      
      // Fetch all historical data from Banxico
      const bulkRates = await fetchBanxicoBulkHistoricalRates();
      
      // Process all historical data (filtered to 2020+ onwards)
      const results = await processBulkHistoricalRates(db, bulkRates, copRate, { dryRun, minDate: '2020-01-01' });
      
      console.log('🎉 Full replacement completed!');
      console.log(`📊 Final stats: ${results.processed} processed, ${results.failed} failed, ${results.skipped} filtered out (before 2020)`);
      return;
    } else if (fillGaps) {
      // Only process missing dates
      const existingDates = await getExistingRateDates(db);
      weekdaysToProcess = getMissingWeekdays(allWeekdays, existingDates);
      
      if (weekdaysToProcess.length === 0) {
        console.log('✅ No gaps found - all exchange rates are up to date!');
        return;
      }
    } else {
      // Standard import - process all dates but don't delete existing
      weekdaysToProcess = allWeekdays;
    }
    
    console.log(`📊 Weekdays to process: ${weekdaysToProcess.length}`);
    
    // Get current Colombian peso rate (we'll use this for all historical data)
    console.log('🔄 Fetching current Colombian peso rate...');
    const copRate = await fetchColombianHistoricalRate();
    console.log(`💱 Using COP rate: ${copRate}`);
    
    // Process each date with delays to respect API limits
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (let i = 0; i < weekdaysToProcess.length; i++) {
      const date = weekdaysToProcess[i];
      const dateStr = formatDateForStorage(date);
      
      // Check if date already exists (unless doing full replacement)
      if (!fullReplacement) {
        try {
          const existingDoc = await db.collection('exchangeRates').doc(dateStr).get();
          if (existingDoc.exists) {
            console.log(`⏭️ Skipping ${dateStr} - already exists`);
            skipped++;
            continue;
          }
        } catch (error) {
          console.error(`⚠️ Error checking existing data for ${dateStr}:`, error.message);
        }
      }
      
      const success = await processDateRates(date, db, copRate);
      
      if (success) {
        processed++;
      } else {
        failed++;
      }
      
      // Add delay to respect API rate limits (1 second between requests)
      if (i < weekdaysToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Progress update every 10 dates
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${weekdaysToProcess.length} dates processed (${processed} successful, ${failed} failed, ${skipped} skipped)`);
      }
    }
    
    console.log('🎉 Historical import completed!');
    console.log(`📊 Final stats: ${processed} successful, ${failed} failed, ${skipped} skipped out of ${weekdaysToProcess.length} total dates`);
    
  } catch (error) {
    console.error('❌ Bulk import failed:', error);
    process.exit(1);
  }
}

/**
 * Quick update function - fills gaps from last known date to today
 */
async function quickUpdateRates(options = {}) {
  try {
    const { dryRun = false } = options;
    
    console.log('⚡ Starting quick exchange rates update...');
    
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No data will be modified');
      console.log('📋 Would check latest exchange rate date in database');
      console.log('📋 Would calculate missing dates from latest to today');
      console.log('📋 Would import only missing weekdays');
      console.log('✅ DRY RUN completed - no actual changes made');
      return;
    }
    
    // Initialize Firebase
    const firebase = await importFirebase();
    await firebase.initializeFirebase();
    const db = await firebase.getDb();
    
    // Get the latest date we have
    const latestDate = await getLatestRateDate(db);
    
    if (!latestDate) {
      console.log('📊 No existing data found - running full import from 2024-01-01');
      return await bulkImportHistoricalRates({ startDate: new Date('2024-01-01') });
    }
    
    // Calculate start date (day after latest)
    const startDate = new Date(latestDate);
    startDate.setDate(startDate.getDate() + 1);
    
    const endDate = new Date();
    
    if (startDate > endDate) {
      console.log('✅ Exchange rates are already up to date!');
      return;
    }
    
    console.log(`📅 Updating from ${formatDateForStorage(startDate)} to ${formatDateForStorage(endDate)}`);
    
    return await bulkImportHistoricalRates({
      fillGaps: true,
      startDate,
      endDate
    });
    
  } catch (error) {
    console.error('❌ Quick update failed:', error);
    process.exit(1);
  }
}

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fullReplacement: false,
    fillGaps: false,
    quickUpdate: false,
    startDate: null,
    endDate: null,
    showHelp: false,
    dryRun: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--full-replacement':
      case '--replace':
        options.fullReplacement = true;
        break;
      case '--fill-gaps':
      case '--gaps':
        options.fillGaps = true;
        break;
      case '--quick-update':
      case '--update':
        options.quickUpdate = true;
        break;
      case '--dry-run':
      case '--test':
        options.dryRun = true;
        break;
      case '--start-date':
        if (i + 1 < args.length) {
          options.startDate = new Date(args[++i]);
        }
        break;
      case '--end-date':
        if (i + 1 < args.length) {
          options.endDate = new Date(args[++i]);
        }
        break;
      case '--help':
      case '-h':
        options.showHelp = true;
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
📈 SAMS Exchange Rates Bulk Import Tool

Usage: node bulkImportExchangeRates.js [options]

Options:
  --full-replacement, --replace    Delete all existing data and import from scratch
  --fill-gaps, --gaps             Only import missing dates (preserves existing data)
  --quick-update, --update        Update from last known date to today
  --start-date YYYY-MM-DD         Custom start date (default: 2024-01-01)
  --end-date YYYY-MM-DD           Custom end date (default: today)
  --dry-run, --test               Show what would be imported without doing it
  --help, -h                      Show this help message

Examples:
  node bulkImportExchangeRates.js --full-replacement
  node bulkImportExchangeRates.js --fill-gaps
  node bulkImportExchangeRates.js --quick-update
  node bulkImportExchangeRates.js --dry-run --fill-gaps
  node bulkImportExchangeRates.js --start-date 2024-06-01 --end-date 2024-06-30

Notes:
  - Full replacement uses bulk historical data from 2020+ onwards
  - Individual date requests may fail due to API limitations
  - Bulk approach is more reliable for large date ranges
  `);
}

// Run the import
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                    import.meta.url === new URL(process.argv[1], 'file://').href;

if (isMainModule) {
  const options = parseArgs();
  
  // Show help and exit if requested
  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }
  
  let importPromise;
  
  if (options.quickUpdate) {
    importPromise = quickUpdateRates(options);
  } else {
    importPromise = bulkImportHistoricalRates(options);
  }
  
  importPromise
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { bulkImportHistoricalRates, quickUpdateRates };
