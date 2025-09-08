// Simple test for Firebase authentication only
import { initializeApp } from 'firebase/app';
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
const auth = getAuth(app);

// Just test authentication
async function testAuth() {
  try {
    console.log('Attempting anonymous authentication...');
    await signInAnonymously(auth);
    console.log('✅ Authentication successful!');
    console.log('User ID:', auth.currentUser?.uid);
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return false;
  }
}

// Run the test
console.log('Starting authentication test...');
testAuth()
  .then(success => {
    if (success) {
      console.log('\nAuthentication test passed!');
    } else {
      console.log('\nAuthentication test failed!');
    }
    console.log('Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    console.error('Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');
    process.exit(1);
  });

// Print out process info
process.on('exit', () => {
  console.log('Exiting process');
});
