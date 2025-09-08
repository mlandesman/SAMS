// Test script to create a user in Firebase Authentication
import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

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
console.log('Initializing Firebase for user creation...');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Create a new user
async function createUser(email, password) {
  try {
    console.log(`Attempting to create user: ${email}`);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ User created successfully with UID:', userCredential.user.uid);
    
    return userCredential.user;
  } catch (error) {
    console.error('❌ Error creating user:', error.code, error.message);
    
    // If user already exists, try to sign in instead
    if (error.code === 'auth/email-already-in-use') {
      console.log('User already exists, attempting to sign in...');
      return signIn(email, password);
    }
    
    throw error;
  }
}

// Sign in a user
async function signIn(email, password) {
  try {
    console.log(`Attempting to sign in user: ${email}`);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ User signed in successfully with UID:', userCredential.user.uid);
    
    return userCredential.user;
  } catch (error) {
    console.error('❌ Error signing in:', error.code, error.message);
    throw error;
  }
}

// Run the test with your own email (change this to your email)
const email = 'michael@landesman.com'; // Replace with your actual email
const password = 'SamsTest123!';  // Use a secure password

createUser(email, password)
  .then(user => {
    console.log('\nUser details:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });
    
    // Exit after a short delay to allow Firebase operations to complete
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    console.error('Failed to create or sign in user:', error);
    process.exit(1);
  });
