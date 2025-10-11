// Updated test script to verify the UI authentication flow works correctly
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration - same as the one used in the app
const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
  measurementId: "G-BSPD6YFJ25"
};

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Create a proper ensureAuthenticated function like what we've added to firebaseClient.js
async function ensureAuthenticated() {
  // Check if user is already authenticated
  if (auth.currentUser) {
    console.log('🔐 Already authenticated as:', auth.currentUser.uid);
    return true;
  }
  
  // Try to authenticate
  try {
    console.log('Attempting anonymous authentication...');
    const userCredential = await signInAnonymously(auth);
    console.log('🔐 Successfully authenticated as:', userCredential.user.uid);
    return true;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

// Test creating a transaction
async function testCreateTransaction() {
  try {
    console.log('\n--- TESTING TRANSACTION CREATION WITH PROPER AUTH ---\n');
    
    // First ensure we're authenticated
    const isAuth = await ensureAuthenticated();
    if (!isAuth) {
      console.error('Failed to authenticate');
      return false;
    }
    
    console.log('Current user after authentication:', auth.currentUser?.uid);
    
    // Create test transaction data
    const clientId = 'MTC';
    const transactionData = {
      date: new Date(),
      amount: -175.00,
      category: 'Utilities',
      vendor: 'Test Auth Flow',
      accountType: 'Bank',
      notes: 'Test transaction with proper authentication',
      unit: 'TestUnit',
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || 'unknown'
    };
    
    console.log('Creating test transaction for client:', clientId);
    
    // Create the transaction
    const collectionPath = `clients/${clientId}/transactions`;
    console.log(`Using collection path: ${collectionPath}`);
    
    const transactionsRef = collection(db, collectionPath);
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log('\n✅ SUCCESS! Transaction created with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('\n❌ ERROR creating transaction:', error);
    return false;
  }
}

// Run the test
console.log('Starting updated authentication flow test...');
testCreateTransaction()
  .then(success => {
    console.log('\nTest result:', success ? 'SUCCESS ✅' : 'FAILURE ❌');
    
    // Give time for async operations to complete
    setTimeout(() => {
      console.log('Exiting process...');
      process.exit(success ? 0 : 1);
    }, 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
