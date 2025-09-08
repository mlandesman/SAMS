// Test script to create a transaction using the frontend API
import { initializeApp } from 'firebase/app';
import { getFirestore, Timestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { createTransaction } from '../frontend/sams-ui/src/api/transaction.js';

// Initialize Firebase with the same config as the app
const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0",
  measurementId: "G-BSPD6YFJ25"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Override global for testing
global.getDb = () => db;
global.getCurrentUser = () => auth.currentUser || { uid: 'test-user' };
global.isAuthenticated = () => !!auth.currentUser;
global.alert = console.log; // Replace alert with console.log for Node.js

async function testCreateTransaction() {
  try {
    console.log('Signing in anonymously...');
    await signInAnonymously(auth);
    console.log('Signed in successfully with UID:', auth.currentUser?.uid);
    
    const clientId = 'MTC';
    
    // Create test transaction data
    const transactionData = {
      date: Timestamp.fromDate(new Date()),
      amount: -100.00,
      category: 'Maintenance',
      vendor: 'Test Vendor',
      accountType: 'Bank',
      notes: 'Test transaction created from script',
      unit: 'Test'
    };
    
    console.log('Creating test transaction for client:', clientId);
    console.log('Transaction data:', transactionData);
    
    // Call the frontend API function
    const transactionId = await createTransaction(clientId, transactionData);
    
    console.log('\n✅ Transaction created successfully!');
    console.log('Transaction ID:', transactionId);
    
    return true;
  } catch (error) {
    console.error('\n❌ Failed to create transaction:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

// Run the test
testCreateTransaction()
  .then(success => {
    if (success) {
      console.log('\nTest completed successfully!');
    } else {
      console.log('\nTest failed!');
    }
    // Give time for the operation to complete before exiting
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
