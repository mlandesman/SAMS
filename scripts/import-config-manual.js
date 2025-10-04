#!/usr/bin/env node

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../serviceAccountKey-prod.json'), 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importConfig() {
  try {
    const configPath = path.join(__dirname, '../MTCdata/Config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('📥 Importing config collection for MTC...');
    console.log('Config data keys:', Object.keys(configData));
    
    // Import each top-level key as a separate document in the config collection
    for (const [docId, docData] of Object.entries(configData)) {
      const configRef = db.doc(`clients/MTC/config/${docId}`);
      
      // Add metadata
      const dataToImport = {
        ...docData,
        updatedAt: new Date().toISOString(),
        updatedBy: 'import-script'
      };
      
      await configRef.set(dataToImport);
      console.log(`✅ Imported config document: ${docId}`);
    }
    
    console.log('✅ Config collection imported successfully!');
    
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

