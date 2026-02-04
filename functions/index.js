import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import admin from 'firebase-admin';

// Import existing exchange rate functions
import { updateExchangeRates, populateHistoricalRates } from './src/exchangeRatesUpdater.js';
import { syncExchangeRatesToDev } from './src/syncToDevDatabase.js';
import { loadTwoYearsHistoricalData, loadHistoricalDataForYear } from './src/bulkHistoricalLoader.js';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  // Determine storage bucket based on environment
  // Check GCLOUD_PROJECT first (always set in Cloud Functions), then fall back to NODE_ENV
  const getStorageBucket = () => {
    if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
      return 'sams-sandyland-prod.firebasestorage.app';
    } else if (process.env.NODE_ENV === 'staging') {
      return 'sams-staging-6cdcd.firebasestorage.app';
    }
    return 'sandyland-management-system.firebasestorage.app';
  };
  
  const storageBucket = getStorageBucket();
  console.log('🔥 Initializing Firebase Admin SDK with storage bucket:', storageBucket);
  
  admin.initializeApp({
    storageBucket: storageBucket,
  });
}

// Set global options for all functions
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
  // Use Firebase Admin SDK service account for Storage operations (has Storage Admin + Service Account Token Creator)
  serviceAccount: 'firebase-adminsdk-fbsvc@sams-sandyland-prod.iam.gserviceaccount.com',
});

// ============================================================================
// API BACKEND - Main Express App as Cloud Function
// ============================================================================
// Lazy-load the backend app to avoid top-level await issues during deployment
let appCache = null;
async function getApp() {
  if (!appCache) {
    const module = await import('./backend/index.js');
    appCache = module.default;
  }
  return appCache;
}

export const api = onRequest(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
    // CRITICAL: Do NOT use cors: true here - it may consume the request body stream
    // Express app already handles CORS via cors() middleware
    cors: false, // Let Express handle CORS to preserve request stream for multer
    secrets: ['GMAIL_APP_PASSWORD', 'DEEPL_AUTH_KEY', 'VOTE_TOKEN_SECRET'],
  },
  async (req, res) => {
    const app = await getApp();
    return app(req, res);
  }
);

// ============================================================================
// SCHEDULED FUNCTIONS
// ============================================================================

// Unified Nightly Scheduler (Orchestrates all maintenance tasks)
export { nightlyScheduler } from './scheduled/nightlyScheduler.js';

// Legacy Scheduled daily update at 3 AM Mexico City time 
// (Now integrated into nightlyScheduler)
/*
export const scheduledExchangeRatesUpdate = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    console.log('Starting scheduled exchange rates update...');
    
    try {
      const result = await updateExchangeRates();
      console.log('Exchange rates update completed:', result);
      return result;
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      throw error;
    }
  }
);
*/

// Manual exchange rates update (callable function)
export const manualExchangeRatesUpdate = onCall(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    // Check authentication
    if (!request.auth) {
      throw new Error('User must be authenticated to trigger manual update');
    }
    
    console.log('Manual exchange rates update triggered by:', request.auth.uid);
    
    try {
      // Check if this is a historical data population request
      if (request.data.historical && request.data.startDate && request.data.endDate) {
        const result = await populateHistoricalRates(
          request.data.startDate,
          request.data.endDate,
          request.data.dryRun || false
        );
        console.log('Historical data population completed:', result);
        return result;
      } else {
        // Regular daily update
        const result = await updateExchangeRates(request.data.dryRun || false);
        console.log('Manual update completed:', result);
        return result;
      }
    } catch (error) {
      console.error('Manual update failed:', error);
      throw new Error(error.message);
    }
  }
);

// Sync exchange rates from prod to dev
export const syncExchangeRatesFromProdToDev = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new Error('User must be authenticated to sync databases');
    }
    
    console.log('Database sync triggered by:', request.auth.uid);
    
    try {
      const options = {
        daysToSync: request.data.daysToSync || 30,
        overwrite: request.data.overwrite || false
      };
      
      const result = await syncExchangeRatesToDev(options);
      console.log('Database sync completed:', result);
      return result;
    } catch (error) {
      console.error('Database sync failed:', error);
      throw new Error(error.message);
    }
  }
);

// Health check endpoint
export const checkExchangeRatesHealth = onRequest(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
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
  }
);

// Load historical exchange rates
export const loadHistoricalExchangeRates = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new Error('User must be authenticated to load historical data');
    }
    
    console.log('Historical data load triggered by:', request.auth.uid);
    
    try {
      if (request.data.year) {
        // Load specific year
        const result = await loadHistoricalDataForYear(request.data.year);
        return result;
      } else {
        // Load full 2 years in quarters
        const result = await loadTwoYearsHistoricalData();
        return result;
      }
    } catch (error) {
      console.error('Historical data load failed:', error);
      throw new Error(error.message);
    }
  }
);
