import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence
} from 'firebase/auth';

// Firebase configuration - dynamically set based on environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Environment detection - set to true for development mode
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Initialize Firebase
console.log(`Initializing Firebase client in ${IS_DEVELOPMENT ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
console.log('Environment variables available:', {
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_MAINTENANCE_MODE: import.meta.env.VITE_MAINTENANCE_MODE,
  NODE_ENV: process.env.NODE_ENV
});
console.log('Using Firebase project:', firebaseConfig.projectId);

// Global variables for Firebase services
let app;
let db;
let auth;

try {
  // Initialize Firebase services
  console.log('Initializing Firebase with config:', firebaseConfig);
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // Set auth persistence to session only - will be cleared when browser is closed
  setPersistence(auth, browserSessionPersistence)
    .then(() => {
      console.log('Firebase auth persistence set to browserSessionPersistence');
    })
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
  
  // Log successful initialization
  console.log('Firebase initialized successfully.');
  
  // If you're using Firebase emulators, uncomment these lines
  // if (window.location.hostname === 'localhost') {
  //   connectFirestoreEmulator(db, 'localhost', 8080);
  //   connectAuthEmulator(auth, 'http://localhost:9099');
  //   console.log('Using Firebase emulators for local development');
  // }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // Create empty objects to prevent null reference errors
  if (!app) app = {};
  if (!db) db = {};
  if (!auth) auth = {};
}

// Authentication state
let authInitialized = false;
let authUser = null;

// Set up authentication state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    console.log(`User authenticated: ${user.uid} (${user.email || 'unknown email'})`);
    authUser = user;
  } else {
    // User is signed out
    console.log('User is signed out');
    authUser = null;
  }
  authInitialized = true;
});

// Get the current authentication state
function getAuthState() {
  return {
    initialized: authInitialized,
    user: authUser
  };
}
/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<UserCredential>} Firebase user credential
 */
export async function loginWithEmailPassword(email, password) {
  try {
    console.log(`Attempting to sign in with email: ${email}`);
    
    if (!auth) {
      throw new Error('Firebase authentication is not initialized');
    }
    
    // Always set auth persistence to session only before login
    await setPersistence(auth, browserSessionPersistence);
    console.log('Auth persistence set to session only for this login attempt');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Sign in successful:', userCredential.user.uid);
    authUser = userCredential.user;
    return userCredential;
  } catch (error) {
    console.error('Login failed:', error.code, error.message);
    
    // Provide better error messages
    let errorMessage;
    switch (error.code) {
      case 'auth/configuration-not-found':
        console.error('IMPORTANT: Your Firebase project needs to have the localhost domain authorized.');
        console.error('Go to Firebase Console > Authentication > Settings > Authorized Domains');
        console.error('and add localhost to the list.');
        errorMessage = 'Firebase configuration issue. Check console for details.';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid email or password.';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many unsuccessful login attempts. Please try again later.';
        break;
      default:
        errorMessage = `Login failed: ${error.message}`;
    }
    
    error.userMessage = errorMessage;
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function logout() {
  try {
    if (!auth) {
      console.warn('Firebase auth not initialized, skipping logout');
      authUser = null;
      return true;
    }
    
    await signOut(auth);
    console.log('User signed out');
    authUser = null;
    return true;
  } catch (error) {
    console.error('Sign out failed:', error);
    return false;
  }
}

try {
  // Enable offline persistence for better developer experience
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('Firestore persistence has been enabled.');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence.');
      } else {
        console.error('Error enabling persistence:', err);
      }
    });
} catch (err) {
  console.warn('Unable to enable persistence:', err);
}

// Track authentication state for the application
let isAuthReady = false;
onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed:', user ? `User ${user.uid} authenticated` : 'Not authenticated');
  isAuthReady = true;
});

export function getDb() {
  return db;
}

export function getAuthInstance() {
  return auth;
}

export function getCurrentUser() {
  // Return actual Firebase user if available
  const user = auth.currentUser;
  if (user) {
    return {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email,
      isAuthenticated: true
    };
  }
  
  // No user is logged in
  console.log('No authenticated user found');
  return null;
}

export async function ensureAuthenticated() {
  // Check if user is already authenticated
  const user = auth.currentUser;
  if (user) {
    console.log('🔐 Already authenticated as:', user.uid);
    return true;
  }
  
  // Not authenticated
  return false;
}

export function isAuthenticated() {
  // Check if we have an authenticated user
  const user = auth.currentUser;
  if (user) {
    console.log('🔐 Authenticated as:', user.uid);
    return true;
  }
  
  // Not authenticated
  return false;
}

export { firebaseConfig, app, db, auth };
