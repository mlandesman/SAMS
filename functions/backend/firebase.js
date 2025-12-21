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
      const getStorageBucket = () => {
        if (process.env.NODE_ENV === 'production') {
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
          // Support FIREBASE_ENV for scripts (e.g., FIREBASE_ENV=prod)
          const env = process.env.FIREBASE_ENV || process.env.NODE_ENV;
          
          if (env === 'prod' || env === 'production') {
            return '../../serviceAccountKey-prod.json';
          } else if (env === 'staging') {
            return '../../serviceAccountKey-staging.json';
          }
          return '../../serviceAccountKey-dev.json'; // Dev environment (default)
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

export { getDb, initializeFirebase, checkFirestoreConnection, getApp };