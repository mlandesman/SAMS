#!/usr/bin/env node

/**
 * Production Data Clear Script
 * 
 * Purpose: Clears all production Firestore data to prepare for fresh import
 * Only contains test data, so safe to clear everything
 * 
 * Usage: node scripts/clear-production-data.js
 */

import admin from 'firebase-admin';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production Firebase configuration
const PROD_PROJECT_ID = 'sams-sandyland-prod';

// Try to initialize with available credentials
async function initializeFirebase() {
  try {
    if (!admin.apps.length) {
      console.log('🔥 Initializing Firebase Admin SDK for production...');
      console.log(`📊 Target Project: ${PROD_PROJECT_ID}`);
      
      // Initialize with default credentials (Firebase CLI)
      admin.initializeApp({
        projectId: PROD_PROJECT_ID
      });
      
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

// Recursive function to clear a collection and all its subcollections
async function clearCollection(db, collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  
  try {
    // Get all documents in batches
    let snapshot = await collectionRef.limit(batchSize).get();
    let deletedCount = 0;
    
    while (!snapshot.empty) {
      // Create batch
      const batch = db.batch();
      
      // Add each document to deletion batch
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Clear subcollections for each document
      for (const doc of snapshot.docs) {
        const subcollections = await doc.ref.listCollections();
        for (const subcollection of subcollections) {
          const subPath = `${collectionPath}/${doc.id}/${subcollection.id}`;
          console.log(`  📁 Clearing subcollection: ${subPath}`);
          await clearCollection(db, subPath, batchSize);
        }
      }
      
      // Commit the batch
      await batch.commit();
      deletedCount += snapshot.docs.length;
      
      console.log(`    Deleted ${snapshot.docs.length} documents (total: ${deletedCount})`);
      
      // Get next batch
      snapshot = await collectionRef.limit(batchSize).get();
    }
    
    return deletedCount;
  } catch (error) {
    console.error(`❌ Error clearing ${collectionPath}:`, error);
    throw error;
  }
}

// Main clear function
async function clearProductionData() {
  console.log('🧹 Starting production data clearing...');
  console.log(`📊 Target Project: ${PROD_PROJECT_ID}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('⚠️  WARNING: This will delete ALL data in production!\\n');
  
  try {
    await initializeFirebase();
    const db = admin.firestore();
    
    // Get all root collections
    console.log('🔍 Discovering all collections...');
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id);
    
    console.log(`✅ Found ${collectionNames.length} root collections: ${collectionNames.join(', ')}`);
    
    // Optional: Check if exchangeRates exist and preserve them
    let preserveExchangeRates = false;
    if (collectionNames.includes('exchangeRates')) {
      try {
        const exchangeSnapshot = await db.collection('exchangeRates').limit(1).get();
        if (!exchangeSnapshot.empty) {
          console.log('💰 Found exchangeRates data - preserving it');
          preserveExchangeRates = true;
        }
      } catch (error) {
        console.log('⚠️  Could not check exchangeRates, will clear if exists');
      }
    }
    
    let totalDeleted = 0;
    const clearedCollections = [];
    
    // Clear each collection
    for (const collectionName of collectionNames) {
      if (preserveExchangeRates && collectionName === 'exchangeRates') {
        console.log(`⏭️  Skipping exchangeRates (preserving)`);
        continue;
      }
      
      console.log(`\\n📥 Clearing collection: ${collectionName}...`);
      try {
        const deleted = await clearCollection(db, collectionName);
        totalDeleted += deleted;
        clearedCollections.push(`${collectionName} (${deleted} docs)`);
        console.log(`✅ Cleared ${collectionName}: ${deleted} documents`);
      } catch (error) {
        console.log(`❌ Failed to clear ${collectionName}: ${error.message}`);
      }
    }
    
    // Create summary
    console.log('\\n📋 CLEARING SUMMARY');
    console.log('==================');
    console.log(`Total collections processed: ${collectionNames.length}`);
    console.log(`Collections cleared: ${clearedCollections.length}`);
    console.log(`Total documents deleted: ${totalDeleted}`);
    console.log(`Exchange rates preserved: ${preserveExchangeRates ? 'YES' : 'NO'}`);
    
    if (clearedCollections.length > 0) {
      console.log('\\nCleared collections:');
      clearedCollections.forEach(collection => {
        console.log(`  - ${collection}`);
      });
    }
    
    console.log('\\n✅ Production clearing completed successfully!');
    console.log('📋 Ready for Task 3: Authentication Migration');
    
    return {
      totalDeleted,
      clearedCollections,
      exchangeRatesPreserved: preserveExchangeRates
    };
    
  } catch (error) {
    console.error('\\n❌ Production clearing failed:', error);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    console.log('🚀 Production Data Clear Tool');
    console.log('============================\\n');
    
    // Safety check
    console.log('⚠️  SAFETY CONFIRMATION');
    console.log('This script will clear ALL data in production Firebase.');
    console.log('Per deployment plan, production only contains test data.');
    console.log('Proceeding in 3 seconds...\\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await clearProductionData();
    
    console.log('\\n📋 Next steps:');
    console.log('1. Verify clearing completed successfully');
    console.log('2. Proceed to Task 3: Authentication Migration');
    console.log('3. Then Task 4: Data Import');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();