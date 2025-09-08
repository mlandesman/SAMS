// Simple test script to try writing to Firestore without authentication
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvZ7_mhNbIQDHGg_CSxOYBmSqvKBW5lJo",
  authDomain: "sandyland-management-system.firebaseapp.com",
  projectId: "sandyland-management-system",
  storageBucket: "sandyland-management-system.firebasestorage.app",
  messagingSenderId: "1086002290145",
  appId: "1:1086002290145:web:a1a1fe980ead7630d186a0"
};

// Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Try to write to Firestore without authentication
async function testUnauthenticatedWrite() {
  try {
    console.log('Attempting to write to Firestore without authentication...');
    
    const testData = {
      message: 'Test write without authentication',
      timestamp: new Date()
    };
    
    // Try to write to the test_documents collection
    const docRef = await addDoc(collection(db, 'test_documents'), testData);
    console.log('✅ Document written successfully with ID:', docRef.id);
    console.log('This means your security rules allow unauthenticated writes');
    return true;
  } catch (error) {
    console.error('❌ Write failed:', error.code, error.message);
    console.log('This is expected if your security rules require authentication for writes');
    return false;
  }
}

// Run the test
console.log('=== TESTING UNAUTHENTICATED WRITE ===');
testUnauthenticatedWrite()
  .then(success => {
    console.log('\nTest completed with result:', success ? 'SUCCESS' : 'FAILURE');
    setTimeout(() => process.exit(0), 1000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
