#!/usr/bin/env node

/**
 * purge-mtc-data-quick.js
 * Quick purge script for MTC client data to prepare for clean import testing
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';

const ENV = process.env.FIRESTORE_ENV || 'dev';
const CLIENT_ID = 'MTC';

async function purgeMTCData() {
  console.log('🧹 Starting MTC Data Purge...\n');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  // Safety check for production
  if (ENV === 'prod') {
    console.error('❌ PRODUCTION PURGE BLOCKED');
    console.error('This script is not allowed to run in production environment');
    console.error('Use manual deletion or dedicated production purge tools');
    process.exit(1);
  }
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(ENV);
    
    const collections = [
      'categories',
      'vendors', 
      'units',
      'transactions',
      'dues', // HOA dues are stored under units/*/dues/*
      'importMetadata'
    ];
    
    console.log(`\n🗑️ Purging MTC client data from collections:`);
    collections.forEach(collection => {
      console.log(`   - ${collection}`);
    });
    
    let totalDeleted = 0;
    
    // Delete main collections
    for (const collection of collections.slice(0, -2)) { // Skip dues and importMetadata
      console.log(`\n🧹 Purging ${collection}...`);
      
      const collectionRef = db.collection('clients').doc(CLIENT_ID).collection(collection);
      const snapshot = await collectionRef.get();
      
      if (snapshot.empty) {
        console.log(`   ✅ ${collection}: Already empty`);
        continue;
      }
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`   ✅ ${collection}: Deleted ${snapshot.size} documents`);
      totalDeleted += snapshot.size;
    }
    
    // Delete HOA dues (nested under units)
    console.log(`\n🧹 Purging HOA dues...`);
    const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    let duesDeleted = 0;
    for (const unitDoc of unitsSnapshot.docs) {
      const duesRef = unitDoc.ref.collection('dues');
      const duesSnapshot = await duesRef.get();
      
      if (!duesSnapshot.empty) {
        const batch = db.batch();
        duesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        duesDeleted += duesSnapshot.size;
      }
    }
    console.log(`   ✅ dues: Deleted ${duesDeleted} documents`);
    totalDeleted += duesDeleted;
    
    // Delete import metadata
    console.log(`\n🧹 Purging import metadata...`);
    const metadataRef = db.collection('clients').doc(CLIENT_ID).collection('importMetadata');
    const metadataSnapshot = await metadataRef.get();
    
    if (!metadataSnapshot.empty) {
      const batch = db.batch();
      metadataSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`   ✅ importMetadata: Deleted ${metadataSnapshot.size} documents`);
      totalDeleted += metadataSnapshot.size;
    } else {
      console.log(`   ✅ importMetadata: Already empty`);
    }
    
    // Delete audit logs for this client
    console.log(`\n🧹 Purging audit logs...`);
    const auditRef = db.collection('auditLogs').where('clientId', '==', CLIENT_ID);
    const auditSnapshot = await auditRef.get();
    
    if (!auditSnapshot.empty) {
      const batch = db.batch();
      auditSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`   ✅ auditLogs: Deleted ${auditSnapshot.size} documents`);
      totalDeleted += auditSnapshot.size;
    } else {
      console.log(`   ✅ auditLogs: Already empty`);
    }
    
    console.log(`\n✅ Purge completed successfully!`);
    console.log(`📊 Total documents deleted: ${totalDeleted}`);
    console.log(`🌍 Environment: ${ENV}`);
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`\n🚀 Ready for clean import testing!`);
    
  } catch (error) {
    console.error('❌ Error during purge:', error);
    process.exit(1);
  }
}

// Execute
purgeMTCData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Purge script failed:', error);
    process.exit(1);
  });