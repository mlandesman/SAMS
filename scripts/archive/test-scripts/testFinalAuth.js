// Test script to verify the transaction API with updated authentication flow
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

// Set auth to use browser environment for compatibility with anonymous auth
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// Test the authentication flow that mimics our application's behavior
async function testAuthFlow() {
  try {
    console.log('\n--- Testing Authentication Flow ---');
    
    // Try to authenticate
    console.log('Attempting anonymous authentication...');
    const userCred = await signInAnonymously(auth);
    console.log('✅ Authentication successful with user:', userCred.user.uid);
    
    // Create test transaction data
    const transactionData = {
      date: new Date(),
      amount: -200.00,
      category: 'Test Category',
      vendor: 'Test Vendor',
      accountType: 'Bank',
      notes: 'Test transaction with updated authentication flow',
      unit: 'Test',
      createdAt: new Date(),
      createdBy: auth.currentUser.uid
    };
    
    // The client ID to use
    const clientId = 'MTC';
    
    // Wait brief moment to ensure auth is fully initialized
    console.log('Waiting a moment for authentication to settle...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Current authentication state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');
    if (auth.currentUser) {
      console.log('User ID:', auth.currentUser.uid);
    }
    
    // Now try to create a transaction
    console.log(`\nAttempting to create a transaction for client: ${clientId}`);
    const transactionsRef = collection(db, `clients/${clientId}/transactions`);
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log('\n✅ SUCCESS! Transaction created with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run the test
console.log('Starting transaction test with updated authentication...');
testAuthFlow()
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
