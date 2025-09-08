const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

// Firebase config for production
const firebaseConfig = {
  apiKey: "AIzaSyBJV3H7DOxxLOKIL35O6pQKdPGNqvO5tPo",
  authDomain: "sams-sandyland-prod.firebaseapp.com",
  projectId: "sams-sandyland-prod",
  storageBucket: "sams-sandyland-prod.appspot.com",
  messagingSenderId: "939117788746",
  appId: "1:939117788746:web:e2cac72b24ca4c00f52e52"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

async function syncRatesToDev() {
  console.log('🔄 Syncing exchange rates from Production to Development...');
  
  try {
    // Create a callable reference to the function
    const syncFunction = httpsCallable(functions, 'syncExchangeRatesFromProdToDev');
    
    // Sync last 90 days by default
    console.log('📊 Requesting sync of last 90 days of data...');
    const result = await syncFunction({
      daysToSync: 90,
      overwrite: true
    });
    
    console.log('✅ Sync completed successfully!');
    if (result.data) {
      console.log('📈 Results:', JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
  
  process.exit();
}

syncRatesToDev();