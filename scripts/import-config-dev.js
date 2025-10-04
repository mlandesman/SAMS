#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to find dev service account key
let serviceAccountPath;
const possiblePaths = [
  '../serviceAccountKey.json',
  '../serviceAccountKey-dev.json',
  '../serviceAccountKey-development.json'
];

for (const p of possiblePaths) {
  const fullPath = path.join(__dirname, p);
  if (fs.existsSync(fullPath)) {
    serviceAccountPath = fullPath;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('❌ No service account key found for development!');
  console.error('📝 Please download it from Firebase Console:');
  console.error('   1. Go to https://console.firebase.google.com/project/sandyland-management-system/settings/serviceaccounts/adminsdk');
  console.error('   2. Click "Generate new private key"');
  console.error('   3. Save as serviceAccountKey.json in the SAMS root directory');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
console.log('🔍 Using Firebase Project:', serviceAccount.project_id);

if (serviceAccount.project_id !== 'sandyland-management-system') {
  console.error(`❌ Wrong project! Expected 'sandyland-management-system', got '${serviceAccount.project_id}'`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importConfig() {
  try {
    const configPath = path.join(__dirname, '../MTCdata/Config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('📥 Importing config collection for MTC to DEV database...');
    console.log('Config data keys:', Object.keys(configData));
    
    // Import each top-level key as a separate document in the config collection
    for (const [docId, docData] of Object.entries(configData)) {
      const configRef = db.doc(`clients/MTC/config/${docId}`);
      
      // Add metadata
      const dataToImport = {
        ...docData,
        updatedAt: new Date().toISOString(),
        updatedBy: 'import-script-dev'
      };
      
      await configRef.set(dataToImport);
      console.log(`✅ Imported config document: ${docId}`);
    }
    
    console.log('✅ Config collection imported successfully to DEV!');
    
    // Verify
    const configSnapshot = await db.collection('clients/MTC/config').get();
    console.log(`📊 Total config documents: ${configSnapshot.size}`);
    configSnapshot.docs.forEach(doc => {
      console.log(`  - ${doc.id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing config:', error);
    process.exit(1);
  }
}

importConfig();

