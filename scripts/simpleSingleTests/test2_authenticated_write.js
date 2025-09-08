// Simple test script to try writing to Firestore with authentication
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

// Test authenticated write
async function testAuthenticatedWrite() {
  try {
    // First authenticate
    console.log('Attempting to authenticate...');
    
    // Use the test user credentials
    const email = 'michael@landesman.com';
    const password = 'SamsTest123!';
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Authentication successful. User ID:', userCredential.user.uid);
    
    // Now try to write to Firestore
    console.log('\nAttempting to write to Firestore with authentication...');
    
    const testData = {
      message: 'Test write with authentication',
      timestamp: new Date(),
      userId: userCredential.user.uid
    };
    
    // Write to the test_documents collection
    const docRef = await addDoc(collection(db, 'test_documents'), testData);
    console.log('✅ Document written successfully with ID:', docRef.id);
    console.log('This confirms your security rules allow authenticated writes');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.code, error.message);
    return false;
  }
}

// Run the test
console.log('=== TESTING AUTHENTICATED WRITE ===');
testAuthenticatedWrite()
  .then(success => {
    console.log('\nTest completed with result:', success ? 'SUCCESS' : 'FAILURE');
    setTimeout(() => process.exit(0), 1000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
