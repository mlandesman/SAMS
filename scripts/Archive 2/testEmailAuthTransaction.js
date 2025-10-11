// Test script to create a transaction with proper email/password authentication
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';

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

// Login and create transaction
async function loginAndCreateTransaction() {
  try {
    // Step 1: Login with email and password
    console.log('Attempting to sign in...');
    const email = 'michael@landesman.com'; // Change to the email you created
    const password = 'SamsTest123!'; // Change to the password you set
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Login successful. User ID:', userCredential.user.uid);
    
    // Step 2: Create a test transaction
    const clientId = 'MTC'; // Using MTC client ID
    const transactionData = {
      date: Timestamp.fromDate(new Date()),
      amount: -125.50,
      category: 'Utilities',
      vendor: 'Email Auth Test',
      accountType: 'Bank',
      notes: 'Test transaction created with email auth',
      unit: 'Test',
      createdAt: Timestamp.fromDate(new Date()),
      createdBy: userCredential.user.uid
    };
    
    console.log('Creating transaction for client:', clientId);
    console.log('Transaction data:', transactionData);
    
    const collectionPath = `clients/${clientId}/transactions`;
    console.log('Collection path:', collectionPath);
    
    const docRef = await addDoc(collection(db, collectionPath), transactionData);
    
    console.log('✅ Transaction created successfully with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Error in test:', error.code, error.message);
    return false;
  }
}

// Run the test
console.log('Starting login and transaction test...');
loginAndCreateTransaction()
  .then(success => {
    console.log('Test result:', success ? 'SUCCESS ✅' : 'FAILURE ❌');
    
    // Exit after a short delay
    setTimeout(() => process.exit(success ? 0 : 1), 2000);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
