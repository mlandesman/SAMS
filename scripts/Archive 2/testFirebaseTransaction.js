// Standalone test script to create a transaction directly using Firebase
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

async function createTransaction(clientId, data) {
  try {
    console.log(`Creating transaction for client ID: "${clientId}"`);
    
    if (!clientId) {
      throw new Error('Client ID is required but was not provided');
    }
    
    // Get the current user
    const user = auth.currentUser;
    console.log('Current user:', user ? user.uid : 'Not authenticated');
    
    const transactionData = {
      ...data,
      createdAt: new Date(),
      createdBy: user?.uid || 'anonymous',
    };
    
    // Log the path we're using
    const collectionPath = `clients/${clientId}/transactions`;
    console.log(`Using Firestore collection path: ${collectionPath}`);
    
    const transactionsRef = collection(db, collectionPath);
    console.log('About to add document to collection...');
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log(`Transaction created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error creating transaction:', error);
    return null;
  }
}

async function runTest() {
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
      notes: 'Test transaction created from standalone script',
      unit: 'Test'
    };
    
    console.log('Creating test transaction for client:', clientId);
    console.log('Transaction data:', transactionData);
    
    // Create the transaction
    const txnId = await createTransaction(clientId, transactionData);
    
    if (txnId) {
      console.log('\n✅ SUCCESS! Transaction created with ID:', txnId);
      return true;
    } else {
      console.log('\n❌ FAILED! Could not create transaction');
      return false;
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    return false;
  }
}

// Run the test
runTest()
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
