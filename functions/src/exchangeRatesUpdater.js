const admin = require('firebase-admin');
const { fetchDOFRates } = require('./apiClients/dof');
const { fetchCurrentRates } = require('./apiClients/openExchangeRates');
const { getMexicoDateString, getMexicoYesterdayString, logMexicoTime } = require('./utils/timezone');

/**
 * Update exchange rates using DOF (official Mexican government rates) and Open Exchange Rates
 * @param {boolean} dryRun - If true, doesn't save to database
 * @returns {Object} Result with status and updated rates
 */
async function updateExchangeRates(dryRun = false) {
  console.log('🔄 Starting exchange rate update using DOF and Open Exchange Rates...');
  
  // Log current Mexico time for debugging
  logMexicoTime();
  
  const db = admin.firestore();
  
  // Use Mexico timezone for dates
  const todayStr = getMexicoDateString();
  const yesterdayStr = getMexicoYesterdayString();
  
  console.log(`📅 Looking for rates for Mexico dates: ${todayStr} (today), ${yesterdayStr} (yesterday)`);
  
  try {
    // Step 1: Fetch DOF official MXN/USD rate
    console.log('📊 Fetching DOF official exchange rate...');
    const dofRates = await fetchDOFRates(yesterdayStr, todayStr);
    
    // Get the most recent DOF rate (today or yesterday)
    let dofRate = null;
    let dofDate = null;
    
    if (dofRates[todayStr]) {
      dofRate = dofRates[todayStr];
      dofDate = todayStr;
    } else if (dofRates[yesterdayStr]) {
      dofRate = dofRates[yesterdayStr];
      dofDate = yesterdayStr;
    } else {
      throw new Error('No DOF rates available for today or yesterday');
    }
    
    console.log(`✓ DOF rate for ${dofDate}: 1 USD = ${dofRate} MXN`);
    
    // Step 2: Fetch USD to other currencies from Open Exchange Rates
    console.log('💱 Fetching USD to other currency rates...');
    const usdRates = await fetchCurrentRates();
    
    // Step 3: Calculate MXN to other currencies using USD as bridge
    const mxnToUsd = 1 / dofRate; // Convert DOF rate (USD to MXN) to MXN to USD
    
    const exchangeRates = {
      MXN_USD: {
        rate: mxnToUsd,
        source: 'DOF',
        originalRate: dofRate,
        dofDate: dofDate
      },
      MXN_CAD: {
        rate: mxnToUsd * usdRates.CAD,
        source: 'DOF + Open Exchange Rates',
        calculatedFrom: 'MXN→USD→CAD',
        usdRate: usdRates.CAD
      },
      MXN_EUR: {
        rate: mxnToUsd * usdRates.EUR,
        source: 'DOF + Open Exchange Rates',
        calculatedFrom: 'MXN→USD→EUR',
        usdRate: usdRates.EUR
      },
      MXN_COP: {
        rate: mxnToUsd * usdRates.COP,
        source: 'DOF + Open Exchange Rates',
        calculatedFrom: 'MXN→USD→COP',
        usdRate: usdRates.COP
      }
    };
    
    console.log('📈 Calculated exchange rates:');
    console.log(`  MXN to USD: ${exchangeRates.MXN_USD.rate.toFixed(6)} (DOF official)`);
    console.log(`  MXN to CAD: ${exchangeRates.MXN_CAD.rate.toFixed(6)}`);
    console.log(`  MXN to EUR: ${exchangeRates.MXN_EUR.rate.toFixed(6)}`);
    console.log(`  MXN to COP: ${exchangeRates.MXN_COP.rate.toFixed(2)}`);
    
    if (dryRun) {
      console.log('🔍 Dry run mode - not saving to database');
      return {
        success: true,
        dryRun: true,
        date: todayStr,
        rates: exchangeRates
      };
    }
    
    // Step 4: Save to Firestore with friendly name as docId
    const docData = {
      date: todayStr,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      source: 'Automated Daily Update',
      mexicoTimezone: 'America/Cancun',
      rates: exchangeRates
    };
    
    // Use date as friendly document ID
    const docRef = db.collection('exchangeRates').doc(todayStr);
    await docRef.set(docData, { merge: true });
    
    console.log(`✅ Successfully updated exchange rates for ${todayStr}`);
    
    return {
      success: true,
      date: todayStr,
      rates: exchangeRates
    };
    
  } catch (error) {
    console.error('❌ Failed to update exchange rates:', error);
    throw error;
  }
}

/**
 * Populate historical exchange rates for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {boolean} dryRun - If true, doesn't save to database
 * @returns {Object} Result with status and number of days processed
 */
async function populateHistoricalRates(startDate, endDate, dryRun = false) {
  console.log(`📊 Populating historical rates from ${startDate} to ${endDate}...`);
  
  const db = admin.firestore();
  
  try {
    // Step 1: Fetch all DOF rates for the period
    console.log('📈 Fetching DOF historical rates...');
    const dofRates = await fetchDOFRates(startDate, endDate);
    const dates = Object.keys(dofRates).sort();
    
    console.log(`✓ Found DOF rates for ${dates.length} days`);
    
    if (dates.length === 0) {
      return {
        success: false,
        message: 'No DOF rates found for the specified period'
      };
    }
    
    // Step 2: For simplicity, use current USD rates for historical calculations
    // Note: For more accuracy, would need historical rates from Open Exchange Rates (paid plan)
    console.log('💱 Fetching current USD to other currency rates...');
    const usdRates = await fetchCurrentRates();
    
    console.log('⚠️  Note: Using current USD exchange rates for historical calculations');
    console.log('    For more accuracy, consider Open Exchange Rates paid plan for historical data');
    
    // Step 3: Process each date
    const batch = db.batch();
    let batchCount = 0;
    let processedCount = 0;
    
    for (const date of dates) {
      const dofRate = dofRates[date];
      const mxnToUsd = 1 / dofRate;
      
      const exchangeRates = {
        MXN_USD: {
          rate: mxnToUsd,
          source: 'DOF',
          originalRate: dofRate,
          historical: true
        },
        MXN_CAD: {
          rate: mxnToUsd * usdRates.CAD,
          source: 'DOF + Open Exchange Rates (current)',
          calculatedFrom: 'MXN→USD→CAD',
          usdRate: usdRates.CAD,
          historical: true,
          note: 'USD rate is current, not historical'
        },
        MXN_EUR: {
          rate: mxnToUsd * usdRates.EUR,
          source: 'DOF + Open Exchange Rates (current)',
          calculatedFrom: 'MXN→USD→EUR',
          usdRate: usdRates.EUR,
          historical: true,
          note: 'USD rate is current, not historical'
        },
        MXN_COP: {
          rate: mxnToUsd * usdRates.COP,
          source: 'DOF + Open Exchange Rates (current)',
          calculatedFrom: 'MXN→USD→COP',
          usdRate: usdRates.COP,
          historical: true,
          note: 'USD rate is current, not historical'
        }
      };
      
      if (!dryRun) {
        const docData = {
          date: date,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          source: 'Historical Data Load',
          rates: exchangeRates
        };
        
        // Use date as friendly document ID
        const docRef = db.collection('exchangeRates').doc(date);
        batch.set(docRef, docData, { merge: true });
        batchCount++;
        processedCount++;
        
        // Commit batch every 400 documents
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      }
      
      if (processedCount % 10 === 0 || processedCount === dates.length) {
        console.log(`📝 Processed ${processedCount}/${dates.length} days`);
      }
    }
    
    // Commit remaining documents
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchCount} documents`);
    }
    
    console.log(`✅ Successfully processed ${processedCount} days of historical data`);
    
    return {
      success: true,
      datesProcessed: processedCount,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      dryRun: dryRun
    };
    
  } catch (error) {
    console.error('❌ Failed to populate historical rates:', error);
    throw error;
  }
}

module.exports = {
  updateExchangeRates,
  populateHistoricalRates
};