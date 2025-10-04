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

async function restoreConfig() {
  try {
    const configPath = path.join(__dirname, '../MTCdata/Config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('🔄 Restoring config collection for MTC...');
    
    const batch = db.batch();
    
    // Restore activities
    if (configData.activities) {
      const activitiesRef = db.doc('clients/MTC/config/activities');
      batch.set(activitiesRef, configData.activities);
      console.log('✅ Restored activities config');
    }
    
    // Restore emailTemplates
    if (configData.emailTemplates) {
      const emailTemplatesRef = db.doc('clients/MTC/config/emailTemplates');
      batch.set(emailTemplatesRef, configData.emailTemplates);
      console.log('✅ Restored emailTemplates config');
    }
    
    await batch.commit();
    console.log('✅ Config collection restored successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error restoring config:', error);
    process.exit(1);
  }
}

restoreConfig();

