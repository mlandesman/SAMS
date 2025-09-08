const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBp0Jz6iLaGP1pElMJU2jUV1lGcHCHiBe0",
  authDomain: "sams-sandyland-prod.firebaseapp.com",
  projectId: "sams-sandyland-prod",
  storageBucket: "sams-sandyland-prod.firebasestorage.app",
  messagingSenderId: "939117788746",
  appId: "1:939117788746:web:6e4a63c8b8c62e8c8c9e20"
};

async function testManualUpdate() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const functions = getFunctions(app, 'us-central1');
    
    // You'll need to sign in first
    console.log('Please sign in first using Firebase Auth...');
    // For testing, you would need to implement sign-in here
    
    // Call the function
    const manualUpdate = httpsCallable(functions, 'manualExchangeRatesUpdate');
    
    console.log('Triggering manual exchange rate update...');
    const result = await manualUpdate({
      mode: 'quick',
      fillGaps: true
    });
    
    console.log('Update result:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// For server-side testing, we'll use a different approach
console.log('To test the manual update function, you can:');
console.log('1. Use the Firebase Console to manually execute the function');
console.log('2. Or run the scheduled function once using gcloud');
console.log('');
console.log('Run this command to trigger the scheduled function manually:');
console.log('gcloud scheduler jobs run scheduledExchangeRatesUpdate-us-central1 --project=sams-sandyland-prod');