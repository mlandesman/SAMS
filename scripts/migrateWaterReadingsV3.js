#!/usr/bin/env node
/**
 * Water Readings Migration Script v3
 * 
 * CRITICAL: Process in ASCENDING order (lowest month first)
 * Each document moves into the slot that was JUST VACATED by the previous operation.
 * 
 * DO NOT MODIFY THE PROCESSING ORDER.
 * 
 * Purpose:
 * 1. Renumber documents (subtract 1 from month)
 * 2. Convert flat format to object format
 * 
 * Usage:
 * DRY RUN (default): node scripts/migrateWaterReadingsV3.js
 * EXECUTE DEV: node scripts/migrateWaterReadingsV3.js --execute
 * EXECUTE PROD: node scripts/migrateWaterReadingsV3.js --execute --prod
 * 
 * Environment:
 * Development: Uses service account key from firebase.js
 * Production: Uses Application Default Credentials (ADC)
 *   Run 'gcloud auth application-default login' if not authenticated
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_ID = 'AVII'; // Only AVII has water bills
const productionProjectId = 'sams-sandyland-prod';

// Check for flags
const isExecute = process.argv.includes('--execute');
const useProduction = process.argv.includes('--prod');

async function initializeFirebase() {
  if (useProduction) {
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)`);
    console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
    
    // Clear GOOGLE_APPLICATION_CREDENTIALS if it's set to placeholder/invalid path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    // Use service account key for development (via getDb from firebase.js)
    const { getDb } = await import('../functions/backend/firebase.js');
    return await getDb();
  }
}

async function migrate(dryRun = true) {
  console.log('═'.repeat(60));
  console.log(`🚰 Water Readings Migration v3`);
  console.log(`🔒 Mode: ${dryRun ? 'DRY RUN' : 'EXECUTING'}`);
  console.log(`📦 Target: ${useProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log('═'.repeat(60));
  
  const db = await initializeFirebase();
  
  const readingsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('readings');
  
  const snapshot = await readingsRef.get();
  console.log(`\n📊 Found ${snapshot.size} documents\n`);
  
  if (snapshot.empty) {
    console.log('⚠️ No documents to migrate');
    return;
  }
  
  // CRITICAL: Sort ASCENDING (lowest first)
  const docs = [...snapshot.docs].sort((a, b) => {
    const [yearA, monthA] = a.id.split('-').map(Number);
    const [yearB, monthB] = b.id.split('-').map(Number);
    if (yearA !== yearB) return yearA - yearB;  // ASC
    return monthA - monthB;  // ASC
  });
  
  console.log('Processing order (MUST be ascending):');
  docs.forEach((doc, i) => console.log(`  ${i + 1}. ${doc.id}`));
  console.log('');
  
  // Build migration plan
  const plan = [];
  for (const doc of docs) {
    const data = doc.data();
    const oldId = doc.id;
    const [oldYear, oldMonth] = oldId.split('-').map(Number);
    
    // Calculate new month (subtract 1, wrap at year boundary)
    let newMonth = oldMonth - 1;
    let newYear = oldYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear = oldYear - 1;
    }
    const newId = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    
    // Convert readings to object format
    const newReadings = {};
    for (const [unitId, reading] of Object.entries(data.readings || {})) {
      if (typeof reading === 'number') {
        newReadings[unitId] = { reading: reading, washes: [] };
      } else if (typeof reading === 'object') {
        newReadings[unitId] = {
          reading: reading.reading ?? reading.currentReading ?? 0,
          washes: reading.washes || []
        };
      }
    }
    
    // Build newData object, only including defined fields
    const newData = {
      year: newYear,
      month: newMonth,
      readings: newReadings,
      _migrated: {
        from: oldId,
        at: new Date().toISOString()
      }
    };
    
    // Only include optional fields if they are defined
    if (data.buildingMeter !== undefined) {
      newData.buildingMeter = data.buildingMeter;
    }
    if (data.commonArea !== undefined) {
      newData.commonArea = data.commonArea;
    }
    if (data.timestamp !== undefined) {
      newData.timestamp = data.timestamp;
    }
    
    plan.push({
      oldId,
      newId,
      newData
    });
    
    console.log(`📋 ${oldId} → ${newId} (${Object.keys(newReadings).length} units)`);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - No changes made');
    console.log('Run with --execute to apply changes');
    return;
  }
  
  // EXECUTE: Process one document at a time, in order
  console.log('\n🔄 EXECUTING MIGRATION...\n');
  
  for (let i = 0; i < plan.length; i++) {
    const { oldId, newId, newData } = plan[i];
    console.log(`[${i + 1}/${plan.length}] ${oldId} → ${newId}`);
    
    try {
      // Step 1: Create new document
      await readingsRef.doc(newId).set(newData);
      
      // Step 2: Verify new document exists
      const verifyNew = await readingsRef.doc(newId).get();
      if (!verifyNew.exists) {
        console.error(`❌ FATAL: Failed to create ${newId}. STOPPING.`);
        console.error(`⚠️ Manual cleanup may be needed.`);
        process.exit(1);
      }
      console.log(`  ✅ Created: ${newId}`);
      
      // Step 3: Delete old document (MUST happen before next iteration)
      await readingsRef.doc(oldId).delete();
      
      // Step 4: Verify old document is deleted
      const verifyOld = await readingsRef.doc(oldId).get();
      if (verifyOld.exists) {
        console.error(`❌ FATAL: Failed to delete ${oldId}. STOPPING.`);
        console.error(`⚠️ Manual cleanup may be needed.`);
        process.exit(1);
      }
      console.log(`  🗑️ Deleted: ${oldId}`);
    } catch (error) {
      console.error(`❌ FATAL: Error processing ${oldId} → ${newId}:`, error.message);
      console.error(`⚠️ Migration stopped. Manual cleanup may be needed.`);
      process.exit(1);
    }
  }
  
  console.log(`\n✅ MIGRATION COMPLETE: ${plan.length} documents migrated`);
}

// Parse args and run
const dryRun = !isExecute;

if (!dryRun && useProduction) {
  console.log('\n⚠️  WARNING: You are about to migrate PRODUCTION data!');
  console.log('   This will permanently modify production Firestore documents.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

migrate(dryRun).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
