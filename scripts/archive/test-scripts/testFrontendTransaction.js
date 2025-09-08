// Test script for frontend transaction creation
import fetch from 'node-fetch';
global.fetch = fetch;
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDoc, doc, Timestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBe8JszXqPcmz0THpI6W1J7DKrbPcw1L8o',
  authDomain: 'sandyland-management-system.firebaseapp.com',
  projectId: 'sandyland-management-system',
  storageBucket: 'sandyland-management-system.appspot.com',
  messagingSenderId: '197520789326',
  appId: '1:197520789326:web:8455807e70d312a29218e2',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// This is a workaround to avoid API key validation in development
auth.tenantId = 'demo-tenant-id';  // Setting any tenant ID helps bypass some validations

async function createTestTransaction() {
  try {
    // First, authenticate anonymously
    console.log('Signing in anonymously...');
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    console.log('Authenticated with user ID:', user.uid);

    // Transaction data
    const transactionData = {
      date: Timestamp.fromDate(new Date()),
      vendor: 'Test Vendor',
      category: 'Test Category',
      amount: -100.0,
      accountType: 'Bank',
      notes: 'Test transaction from frontend API test',
      createdAt: new Date(),
      createdBy: user.uid
    };

    const clientId = 'MTC';
    console.log(`Creating transaction for client ${clientId} with data:`, transactionData);

    // Create the transaction
    const transactionsRef = collection(db, `clients/${clientId}/transactions`);
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log(`Transaction created with ID: ${docRef.id}`);
    
    // Verify we can read it back
    const docSnap = await getDoc(doc(db, `clients/${clientId}/transactions/${docRef.id}`));
    if (docSnap.exists()) {
      console.log('Transaction data retrieved:', docSnap.data());
    } else {
      console.error('Could not find created transaction!');
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

// Run the test
createTestTransaction()
  .then(txnId => {
    console.log('Test completed successfully with transaction ID:', txnId);
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
