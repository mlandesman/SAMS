/**
 * Simple Firebase Connection Test
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function testConnection() {
  try {
    console.log('🔥 Testing Firebase connection...');
    
    await initializeFirebase();
    console.log('✅ Firebase initialized');
    
    const db = await getDb();
    console.log('✅ Database connection established');
    
    // Test reading MTC client
    const clientRef = db.collection('clients').doc('MTC');
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      const data = clientDoc.data();
      console.log('✅ MTC client found');
      console.log(`   Accounts: ${data.accounts?.length || 0}`);
      console.log(`   Name: ${data.name || 'N/A'}`);
    } else {
      console.log('❌ MTC client not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

testConnection();