import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Get Firebase credentials from environment variables or file
const getServiceAccount = () => {
  // Check if Firebase credentials are provided as environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log(`🔑 Using Firebase credentials from environment variable`);
      return serviceAccount;
    } catch (error) {
      console.error('❌ Invalid FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
      throw error;
    }
  }

  // Fallback to file-based credentials (for local development)
  const getServiceAccountPath = () => {
    if (process.env.NODE_ENV === 'production') {
      return './sams-prod-credentials.json';
    } else if (process.env.NODE_ENV === 'staging') {
      return './serviceAccountKey-staging.json';
    }
    return './serviceAccountKey.json';
  };

  const serviceAccountPath = getServiceAccountPath();

  try {
    const serviceAccount = require(serviceAccountPath);
    console.log(`🔑 Using Firebase credentials from file: ${serviceAccountPath}`);
    return serviceAccount;
  } catch (error) {
    console.error(`❌ Cannot find Firebase credentials file: ${serviceAccountPath}`);
    console.error(`💡 For production deployment, set FIREBASE_SERVICE_ACCOUNT_KEY environment variable in Vercel`);
    throw error;
  }
};

// Initialize service account (with error handling for missing credentials)
let serviceAccount;
try {
  serviceAccount = getServiceAccount();
  console.log(`🔑 Using Firebase project: ${serviceAccount.project_id}`);
} catch (error) {
  console.error(`❌ Firebase credentials not available: ${error.message}`);
  console.error(`💡 Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable in Vercel dashboard`);
  // Don't throw here - let Firebase initialization handle the error
  serviceAccount = null;
}

// Track initialization status and errors
let isInitialized = false;
let initError = null;
let firebaseApp = null;

async function initializeFirebase() {
  try {
    // Check if we have service account credentials
    if (!serviceAccount) {
      const errorMsg = '❌ Cannot initialize Firebase: No service account credentials available';
      console.error(errorMsg);
      console.error('💡 Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable in Vercel dashboard');
      throw new Error(errorMsg);
    }

    if (!admin.apps.length) {
      console.log('🔥 Initializing Firebase Admin SDK...');
      const getStorageBucket = () => {
        if (process.env.NODE_ENV === 'production') {
          return 'sams-sandyland-prod.firebasestorage.app';
        } else if (process.env.NODE_ENV === 'staging') {
          return 'sams-staging-6cdcd.firebasestorage.app';
        }
        return 'sandyland-management-system.firebasestorage.app';
      };

      const storageBucket = getStorageBucket();

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucket,
      });

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

export { getDb, initializeFirebase, checkFirestoreConnection, getApp };