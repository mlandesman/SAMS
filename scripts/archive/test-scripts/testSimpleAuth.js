// Simple test for Firebase authentication to verify our changes
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase configuration
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
console.log('Initializing Firebase with new config...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Test authentication and transaction creation
async function testAuthAndTransaction() {
  try {
    // Step 1: Sign in anonymously
    console.log('Step 1: Authenticating anonymously...');
    await signInAnonymously(auth);
    console.log('✅ Authentication successful. User ID:', auth.currentUser?.uid);
    
    // Step 2: Create a test transaction
    console.log('\nStep 2: Creating a test transaction...');
    const clientId = 'MTC';
    const transactionData = {
      date: new Date(),
      amount: -200.00,
      category: 'Test Category',
      vendor: 'Test Vendor',
      accountType: 'Bank',
      notes: 'Simple authentication test transaction',
      unit: 'Test Unit',
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || 'unknown'
    };
    
    // Attempt to create the transaction
    const transactionsRef = collection(db, `clients/${clientId}/transactions`);
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log('✅ Transaction created successfully with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
console.log('---------- FIREBASE AUTHENTICATION TEST ----------');
testAuthAndTransaction()
  .then(success => {
    console.log('\n----------------------------------------------');
    console.log(success 
      ? '✅ TEST PASSED: Authentication and transaction creation successful!' 
      : '❌ TEST FAILED: See error details above');
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
