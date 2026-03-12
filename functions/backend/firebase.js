import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Track initialization status and errors
let isInitialized = false;
let initError = null;
let firebaseApp = null;

async function initializeFirebase() {
  try {
    if (!admin.apps.length) {
      console.log('🔥 Initializing Firebase Admin SDK...');
      
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
      
      // Check if running in Firebase Cloud Functions (production)
      if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_CONFIG) {
        // Running in Firebase environment - use default credentials
        console.log('🔥 Using Firebase default application credentials');
        firebaseApp = admin.initializeApp({
          storageBucket: storageBucket,
        });
      } else {
        // Running locally - use service account file
        const getServiceAccountPath = () => {
          if (process.env.NODE_ENV === 'staging') {
            return './serviceAccountKey-staging.json';
          }
          return './serviceAccountKey.json'; // Dev environment
        };
        
        const serviceAccountPath = getServiceAccountPath();
        const serviceAccount = require(serviceAccountPath);
        console.log(`🔑 Using Firebase project: ${serviceAccount.project_id}`);
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: storageBucket,
        });
      }
      
      console.log('✅ Firebase Admin SDK initialized successfully');
      isInitialized = true;
    } else {
      console.log('ℹ️ Firebase Admin SDK already initialized');
      firebaseApp = admin.app();
      isInitialized = true;
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    initError = error;
    throw error;
  }
}

async function getDb() {
  if (initError) {
    console.error('❌ Cannot get Firestore instance due to previous initialization error:', initError);
    throw initError;
  }
  
  if (!isInitialized) {
    await initializeFirebase();
  }
  
  try {
    const db = admin.firestore();
    
    // Test the connection by trying to access a collection (using a valid collection name)
    const testRef = db.collection('connection_test').doc('connection');
    await testRef.set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
    
    // Reduced Firestore connection logging
    // console.log('✅ Firestore connection verified');
    return db;
  } catch (error) {
    console.error('❌ Error connecting to Firestore:', error);
    throw error;
  }
}

// Add a function to explicitly check the connection
async function checkFirestoreConnection() {
  try {
    const db = await getDb();
    const testDoc = await db.collection('connection_test').doc('connection').get();
    return {
      connected: true,
      timestamp: testDoc.exists ? testDoc.data()?.timestamp : null
    };
  } catch (error) {
    console.error('❌ Firestore connection check failed:', error);
    return {
      connected: false,
      error: error.message
    };
  }
}

// Add a function to get the initialized Firebase app
async function getApp() {
  if (initError) {
    console.error('❌ Cannot get Firebase app due to previous initialization error:', initError);
    throw initError;
  }
  
  if (!isInitialized) {
    await initializeFirebase();
  }
  
  return firebaseApp;
}

/**
 * Convert date value to Firestore Timestamp using backend's admin instance.
 * Use this instead of databaseFieldMappings.convertToTimestamp to avoid
 * "Timestamp doesn't match expected instance" errors from shared module resolution.
 *
 * CRITICAL: Applies same Cancun timezone conversion as shared convertToTimestamp
 * so stored values match historical data (e.g. "2025-07-15" → Cancun-adjusted, not midnight UTC).
 */
function toFirestoreTimestamp(dateValue) {
  if (!dateValue) return null;

  // Already a Firestore Timestamp
  if (dateValue._seconds !== undefined) {
    return dateValue;
  }

  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
    date = dateValue.toDate();
  } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    return null;
  }
  if (isNaN(date.getTime())) return null;

  // Apply Cancun timezone conversion (matches shared convertToTimestamp)
  // Ensures "2025-07-15" stores as Cancun-adjusted, not midnight UTC
  const cancunDateStr = date.toLocaleDateString('en-CA', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const cancunTimeStr = date.toLocaleTimeString('en-CA', {
    timeZone: 'America/Cancun',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const localDateTime = new Date(`${cancunDateStr}T${cancunTimeStr}`);

  return admin.firestore.Timestamp.fromDate(localDateTime);
}

/**
 * Get end of day in Cancun timezone as Firestore Timestamp (using backend's admin instance).
 * Uses same encoding as toFirestoreTimestamp: toLocaleDateString + time string, no offset (parsed as local).
 * Must match toFirestoreTimestamp reference frame so range query bounds are consistent.
 */
function getEndOfDayCancunTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const cancunDateStr = d.toLocaleDateString('en-CA', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const localDateTime = new Date(`${cancunDateStr}T23:59:59`);
  return admin.firestore.Timestamp.fromDate(localDateTime);
}

export { admin, getDb, initializeFirebase, checkFirestoreConnection, getApp, toFirestoreTimestamp, getEndOfDayCancunTimestamp };