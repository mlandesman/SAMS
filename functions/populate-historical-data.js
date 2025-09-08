const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');
const { fetchBanxicoRatesRange, SERIES_IDS } = require('./src/apiClients/banxico');
const { fetchColombianRates } = require('./src/apiClients/colombian');
const { calculateMxnToCop } = require('./src/utils/rateCalculations');

// Initialize admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'sams-sandyland-prod'
});

const db = admin.firestore();

async function fetchBulkBanxicoRates() {
  const BANXICO_API_URL = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series';
  const BANXICO_TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';
  
  const seriesString = Object.values(SERIES_IDS).join(',');
  const url = `${BANXICO_API_URL}/${seriesString}/datos?mediaType=json&token=${BANXICO_TOKEN}`;
  
  console.log('🌐 Fetching bulk historical rates from Banxico...');
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Banxico API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Organize data by date
  const ratesByDate = {};
  
  for (const serie of data.bmx.series) {
    const seriesId = serie.idSerie;
    const currency = Object.keys(SERIES_IDS).find(key => SERIES_IDS[key] === seriesId);
    
    if (currency && serie.datos) {
      // Get last 30 days of data
      const recentData = serie.datos.slice(-30);
      
      for (const rateData of recentData) {
        if (rateData.dato !== 'N/E') {
          // Convert date format
          const [day, month, year] = rateData.fecha.split('/');
          const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          
          if (!ratesByDate[date]) {
            ratesByDate[date] = {};
          }
          
          const originalRate = parseFloat(rateData.dato);
          ratesByDate[date][`MXN_${currency}`] = {
            rate: 1 / originalRate,
            source: 'Banxico',
            seriesId: seriesId,
            originalRate: originalRate,
            title: serie.titulo || `Tipo de cambio MXN/${currency}`
          };
        }
      }
    }
  }
  
  return ratesByDate;
}

async function populateHistoricalData() {
  try {
    console.log(`\n📊 Populating historical exchange rates (last 30 days)\n`);
    
    // Fetch all rates using bulk endpoint
    console.log('🌐 Fetching Banxico rates...');
    const banxicoRates = await fetchBulkBanxicoRates();
    
    console.log(`✅ Received data for ${Object.keys(banxicoRates).length} dates from Banxico`);
    
    // Get current Colombian rate (as fallback)
    console.log('🌐 Fetching current Colombian rate...');
    const today = new Date().toISOString().split('T')[0];
    const currentCopRate = await fetchColombianRates(today) || 4000;
    console.log(`💱 Current USD to COP rate: ${currentCopRate}`);
    
    // Process and store each date
    const batch = db.batch();
    let batchCount = 0;
    let processedCount = 0;
    
    for (const [date, rates] of Object.entries(banxicoRates)) {
      if (rates.MXN_USD) {
        // Calculate COP rate
        if (!rates.MXN_COP && currentCopRate) {
          rates.MXN_COP = calculateMxnToCop(rates.MXN_USD, currentCopRate);
        }
        
        const docData = {
          date: date,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          source: 'Historical Data Load',
          rates: rates
        };
        
        const docRef = db.collection('exchangeRates').doc(date);
        batch.set(docRef, docData, { merge: true });
        batchCount++;
        processedCount++;
        
        console.log(`📝 Queued ${date}: USD=${rates.MXN_USD.originalRate}, CAD=${rates.MXN_CAD?.originalRate || 'N/A'}, EUR=${rates.MXN_EUR?.originalRate || 'N/A'}`);
        
        // Commit batch every 400 documents
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchCount} documents`);
    }
    
    console.log(`\n✅ Successfully populated ${processedCount} days of historical exchange rate data!`);
    
    // Check the results
    const recentRates = await db.collection('exchangeRates')
      .orderBy('date', 'desc')
      .limit(5)
      .get();
    
    console.log('\n📊 Most recent rates in database:');
    recentRates.forEach(doc => {
      const data = doc.data();
      console.log(`${doc.id}: USD=${data.rates.MXN_USD?.originalRate}, Updated: ${data.lastUpdated?.toDate()}`);
    });
    
  } catch (error) {
    console.error('❌ Error populating historical data:', error);
  } finally {
    process.exit();
  }
}

// Run the population
populateHistoricalData();