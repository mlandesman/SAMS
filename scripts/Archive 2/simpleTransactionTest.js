// Simple test script that directly uses the browser Firebase SDK to create a transaction
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase configuration with the new API key
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

async function runTest() {
  try {
    // Sign in anonymously
    console.log('Signing in anonymously...');
    await signInAnonymously(auth);
    console.log('Signed in successfully!');
    console.log('User ID:', auth.currentUser?.uid);
    
    const clientId = 'MTC';
    const path = `clients/${clientId}/transactions`;
    console.log(`Collection path: ${path}`);
    
    // Create a transaction document
    const transactionData = {
      date: Timestamp.fromDate(new Date()),
      amount: -150.00,
      category: 'Maintenance',
      vendor: 'Test Vendor',
      accountType: 'Bank',
      notes: 'Simple test transaction',
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || 'anonymous'
    };
    
    console.log('Creating transaction...');
    const docRef = await addDoc(collection(db, path), transactionData);
    
    console.log('✅ Transaction created with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    return false;
  }
}

// Run the test
console.log('Starting transaction test...');
runTest()
  .then(success => {
    if (success) {
      console.log('\nTest completed successfully! Transaction was created.');
    } else {
      console.log('\nTest failed! Could not create transaction.');
    }
    // Give time for the operation to complete before exiting
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
