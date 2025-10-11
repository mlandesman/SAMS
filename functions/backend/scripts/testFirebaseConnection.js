#!/usr/bin/env node

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔥 Testing Firebase Connection...\n');

try {
  // Load service account
  console.log('Loading service account...');
  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
  );
  console.log(`✓ Service account loaded for project: ${serviceAccount.project_id}`);
  
  // Initialize Firebase Admin
  console.log('Initializing Firebase...');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://sandyland-management-system-default-rtdb.firebaseio.com'
    });
  }
  console.log('✓ Firebase initialized');
  
  // Test database connection
  console.log('Testing Firestore connection...');
  const db = admin.firestore();
  
  // Try to read AVII client document
  const clientDoc = await db.collection('clients').doc('AVII').get();
  if (clientDoc.exists) {
    console.log('✓ Successfully connected to Firestore');
    console.log('✓ AVII client document found');
    
    // Check units collection
    const unitsSnapshot = await db.collection('clients').doc('AVII').collection('units').limit(1).get();
    console.log(`✓ Units collection accessible (${unitsSnapshot.size} documents checked)`);
    
    console.log('\n🎉 Firebase connection test successful!');
  } else {
    console.log('❌ AVII client document not found');
  }
  
} catch (error) {
  console.error('❌ Firebase connection test failed:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}

process.exit(0);