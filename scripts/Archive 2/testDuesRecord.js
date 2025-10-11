// Test script to directly create/update a dues record
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testDuesRecord() {
  try {
    // Test parameters
    const clientId = 'ar3gMGFrAwqKHrcQ3EwP'; // Replace with your actual client ID
    const unitId = '1B';  // Replace with your actual unit ID
    const year = 2025;
    
    console.log(`Creating test dues record for client ${clientId}, unit ${unitId}, year ${year}`);
    
    // Create a test document
    const duesRef = db.collection('clients').doc(clientId)
                      .collection('units').doc(unitId)
                      .collection('dues').doc(year.toString());
    
    // Create a simple test record
    const testData = {
      creditBalance: 0,
      scheduledAmount: 4400,
      payments: [
        {
          month: 1,
          paid: 4400,
          date: new Date().toISOString(),
          notes: 'Test payment created directly'
        }
      ]
    };
    
    // Write the document
    await duesRef.set(testData);
    
    console.log('✅ Test dues record created successfully');
    
    // Verify it was created by reading it back
    const docSnapshot = await duesRef.get();
    if (docSnapshot.exists) {
      console.log('Record exists with data:', docSnapshot.data());
    } else {
      console.error('Failed to verify record creation');
    }
    
  } catch (error) {
    console.error('Error creating test dues record:', error);
  }
}

// Run the test
testDuesRecord().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
