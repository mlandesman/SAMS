// Test script to verify the UI authentication flow works correctly
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

// Simulate the UI authentication flow
const IS_DEVELOPMENT = true;
let authInitialized = false;
let authUser = null;

// Development fallback user (used when auth fails in development mode)
const devUser = {
  uid: 'dev-fallback-user',
  email: 'dev@example.com',
  displayName: 'Development User',
  isAnonymous: true
};

// Set up authentication state listener (like in firebaseClient.js)
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`User authenticated: ${user.uid} (${user.isAnonymous ? 'anonymous' : 'email user'})`);
    authUser = user;
  } else {
    console.log('User is signed out');
    authUser = null;
  }
  authInitialized = true;
});

// Initialize authentication 
async function initAuth() {
  // If already initialized, do nothing
  if (authInitialized && authUser) {
    console.log('Auth already initialized with user:', authUser.uid);
    return authUser;
  }

  if (IS_DEVELOPMENT) {
    try {
      console.log('Development mode: Attempting anonymous authentication...');
      const userCredential = await signInAnonymously(auth);
      console.log('Anonymous auth successful, user:', userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.error('Anonymous auth failed:', error);
      console.warn('Development mode: Using fallback development user');
      // In development, we'll use a fake user as fallback
      authUser = devUser;
      return devUser;
    }
  } else {
    console.log('Production mode: Authentication required');
    // In production, we don't provide a fallback
    return null;
  }
}

// Function to check if authenticated (simulating the one in firebaseClient.js)
function isAuthenticated() {
  // Check if we have a real authenticated user
  if (auth.currentUser) {
    console.log('🔐 Authenticated as:', auth.currentUser.uid);
    return true;
  }
  
  // Fall back to automatic authentication in development mode
  if (IS_DEVELOPMENT) {
    console.log('🔐 DEVELOPMENT MODE: Authentication check passed automatically');
    return true;
  }
  
  console.log('❌ Not authenticated');
  return false;
}

// Function to get current user (simulating the one in firebaseClient.js)
function getCurrentUser() {
  // Return actual Firebase user if available, fall back to dev user if not
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'Anonymous User',
      email: auth.currentUser.email || 'anonymous@example.com',
      isAdmin: true // Grant admin rights in development mode
    };
  }
  
  // Fall back to development user if no authenticated user
  if (IS_DEVELOPMENT) {
    console.log('No authenticated user found, using development user');
    return devUser;
  }
  
  return null;
}

// Test creating a transaction
async function testCreateTransaction() {
  try {
    console.log('\n--- TESTING TRANSACTION CREATION ---\n');
    
    // First ensure we're authenticated
    const user = await initAuth();
    console.log('Auth initialized, current user:', user ? user.uid : 'Not authenticated');
    
    // Check authentication status
    const isAuth = isAuthenticated();
    console.log('Is authenticated?', isAuth);
    
    // Get current user
    const currentUser = getCurrentUser();
    console.log('Current user:', currentUser);
    
    if (!isAuth) {
      console.error('Not authenticated, cannot create transaction');
      return false;
    }
    
    // Create test transaction data
    const clientId = 'MTC';
    const transactionData = {
      date: new Date(),
      amount: -150.00,
      category: 'Utilities',
      vendor: 'Test UI Flow',
      accountType: 'Bank',
      notes: 'Test transaction simulating UI auth flow',
      unit: 'TestUnit',
      createdAt: new Date(),
      createdBy: currentUser.uid
    };
    
    console.log('Creating test transaction for client:', clientId);
    
    // Create the transaction
    const collectionPath = `clients/${clientId}/transactions`;
    console.log(`Using collection path: ${collectionPath}`);
    
    const transactionsRef = collection(db, collectionPath);
    const docRef = await addDoc(transactionsRef, transactionData);
    
    console.log('\n✅ SUCCESS! Transaction created with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('\n❌ ERROR creating transaction:', error);
    return false;
  }
}

// Run the test
console.log('Starting UI authentication flow test...');
testCreateTransaction()
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
