// Test Firestore connection
import { getDb } from '../backend/firebase.js';

async function testConnection() {
  try {
    console.log('Testing connection to Firestore...');
    const db = await getDb();
    console.log('Got Firestore instance:', db);
    
    // Try to get a document
    const docRef = db.collection('clients').doc('MTC');
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      console.log('Successfully connected to Firestore and retrieved MTC client:', docSnapshot.data());
    } else {
      console.log('Connected to Firestore but MTC client document does not exist');
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error connecting to Firestore:', error);
  }
}

testConnection().catch(console.error);
