#!/usr/bin/env node

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../serviceAccountKey-prod.json'), 'utf8')
);

console.log('🔍 Connecting to Firebase Project:', serviceAccount.project_id);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyConfig() {
  try {
    console.log('\n📊 Checking config collection at: clients/MTC/config\n');
    
    const configSnapshot = await db.collection('clients/MTC/config').get();
    
    if (configSnapshot.empty) {
      console.log('❌ Config collection is EMPTY');
    } else {
      console.log(`✅ Found ${configSnapshot.size} documents in config collection:`);
      configSnapshot.docs.forEach(doc => {
        console.log(`\n  📄 Document ID: ${doc.id}`);
        const data = doc.data();
        console.log(`     Keys: ${Object.keys(data).join(', ')}`);
      });
    }
    
    // Also check if client document exists
    console.log('\n📊 Checking client document at: clients/MTC\n');
    const clientDoc = await db.doc('clients/MTC').get();
    
    if (clientDoc.exists) {
      console.log('✅ Client document EXISTS');
      const clientData = clientDoc.data();
      console.log(`   Keys: ${Object.keys(clientData).join(', ')}`);
    } else {
      console.log('❌ Client document DOES NOT EXIST');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying config:', error);
    process.exit(1);
  }
}

verifyConfig();

