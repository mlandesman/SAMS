// Test script that bypasses authentication and tries to write directly to Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

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
console.log('Initializing Firebase with new config...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Create a dummy test document in a test collection (not a transaction)
async function testDirectWrite() {
  try {
    console.log('Attempting a direct Firestore write to a test collection...');
    const testData = {
      message: 'Test write bypassing auth',
      timestamp: Timestamp.fromDate(new Date())
    };

    // Writing to a test collection instead of the clients/MTC/transactions
    const docRef = await addDoc(collection(db, 'test_documents'), testData);
    console.log('✅ Test document created with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Test write failed:', error);
    return false;
  }
}

// Run the test
console.log('Starting direct write test...');
testDirectWrite()
  .then(success => {
    if (success) {
      console.log('\nDirect write test passed!');
    } else {
      console.log('\nDirect write test failed!');
      console.log('This suggests there may be Firestore security rules preventing unauthorized writes');
    }
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
