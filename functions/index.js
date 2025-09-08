const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { updateExchangeRates, populateHistoricalRates } = require('./src/exchangeRatesUpdater');
const { syncExchangeRatesToDev } = require('./src/syncToDevDatabase');

admin.initializeApp();

exports.scheduledExchangeRatesUpdate = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB'
  })
  .pubsub
  .schedule('0 3 * * *')
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    console.log('Starting scheduled exchange rates update...');
    
    try {
      const result = await updateExchangeRates();
      console.log('Exchange rates update completed:', result);
      return result;
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      throw error;
    }
  });

exports.manualExchangeRatesUpdate = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '512MB'
  })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to trigger manual update'
      );
    }
    
    console.log('Manual exchange rates update triggered by:', context.auth.uid);
    
    try {
      // Check if this is a historical data population request
      if (data.historical && data.startDate && data.endDate) {
        const result = await populateHistoricalRates(
          data.startDate,
          data.endDate,
          data.dryRun || false
        );
        console.log('Historical data population completed:', result);
        return result;
      } else {
        // Regular daily update
        const result = await updateExchangeRates(data.dryRun || false);
        console.log('Manual update completed:', result);
        return result;
      }
    } catch (error) {
      console.error('Manual update failed:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

exports.syncExchangeRatesFromProdToDev = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to sync databases'
      );
    }
    
    console.log('Database sync triggered by:', context.auth.uid);
    
    try {
      const options = {
        daysToSync: data.daysToSync || 30,
        overwrite: data.overwrite || false
      };
      
      const result = await syncExchangeRatesToDev(options);
      console.log('Database sync completed:', result);
      return result;
    } catch (error) {
      console.error('Database sync failed:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

exports.checkExchangeRatesHealth = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https
  .onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      const [todayDoc, yesterdayDoc] = await Promise.all([
        db.collection('exchangeRates').doc(today).get(),
        db.collection('exchangeRates').doc(yesterday).get()
      ]);
      
      const recentRates = await db.collection('exchangeRates')
        .orderBy('date', 'desc')
        .limit(5)
        .get();
      
      const health = {
        status: 'healthy',
        lastUpdate: null,
        todayRatesExist: todayDoc.exists,
        yesterdayRatesExist: yesterdayDoc.exists,
        recentDates: recentRates.docs.map(doc => ({
          date: doc.id,
          lastUpdated: doc.data().lastUpdated?.toDate()
        }))
      };
      
      if (!todayDoc.exists && !yesterdayDoc.exists) {
        health.status = 'unhealthy';
        health.message = 'No recent exchange rates found';
      }
      
      if (recentRates.docs.length > 0) {
        health.lastUpdate = recentRates.docs[0].data().lastUpdated?.toDate();
      }
      
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

exports.loadHistoricalExchangeRates = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https
  .onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to load historical data'
      );
    }
    
    console.log('Historical data load triggered by:', context.auth.uid);
    
    try {
      const { loadTwoYearsHistoricalData, loadHistoricalDataForYear } = require('./src/bulkHistoricalLoader');
      
      if (data.year) {
        // Load specific year
        const result = await loadHistoricalDataForYear(data.year);
        return result;
      } else {
        // Load full 2 years in quarters
        const result = await loadTwoYearsHistoricalData();
        return result;
      }
    } catch (error) {
      console.error('Historical data load failed:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });