#!/usr/bin/env node

/**
 * Cleanup Old Water Bills Structure
 * Removes the old /clients/AVII/projects/waterBills/{year} structure
 * These used to have a 'data' document with months array
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function cleanupOldWaterStructure() {
  console.log('🧹 Cleaning up old water bills structure');
  console.log('==========================================\n');

  try {
    const db = await getDb();
    
    // Target path: /clients/AVII/projects/waterBills
    const waterBillsRef = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills');
    
    console.log('📍 Target: /clients/AVII/projects/waterBills\n');
    
    // Years to clean up
    const yearsToClean = ['2025', '2026', '2024', '2027'];
    
    for (const year of yearsToClean) {
      console.log(`🔍 Checking year: ${year}`);
      
      try {
        // Check if the year collection exists
        const yearCollection = waterBillsRef.collection(year);
        const yearDocs = await yearCollection.listDocuments();
        
        if (yearDocs.length > 0) {
          console.log(`  📁 Found ${yearDocs.length} document(s) in ${year}`);
          
          // Delete each document
          for (const doc of yearDocs) {
            const docSnapshot = await doc.get();
            if (docSnapshot.exists) {
              const data = docSnapshot.data();
              
              // Check if it's the old structure (has 'months' array and 'data' document)
              if (doc.id === 'data' && data.months) {
                console.log(`  🗑️  Deleting old structure: ${year}/data (contained ${data.months.length} months)`);
                await doc.delete();
              } else {
                console.log(`  ⏭️  Skipping: ${year}/${doc.id} (not old structure)`);
              }
            }
          }
          
          // Check if collection is empty now
          const remainingDocs = await yearCollection.listDocuments();
          if (remainingDocs.length === 0) {
            console.log(`  ✅ Year ${year} cleaned\n`);
          } else {
            console.log(`  ⚠️  Year ${year} still has ${remainingDocs.length} documents\n`);
          }
        } else {
          console.log(`  ✓ No documents in ${year}\n`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not access ${year}: ${error.message}\n`);
      }
    }
    
    // Also check for any other year collections
    console.log('🔍 Checking for other year collections...');
    const allCollections = await waterBillsRef.listCollections();
    
    for (const collection of allCollections) {
      const collectionId = collection.id;
      
      // Skip 'readings' collection (that's our new structure)
      if (collectionId === 'readings' || collectionId === 'meters' || collectionId === 'bills' || collectionId === 'payments') {
        console.log(`  ✓ Keeping new structure: ${collectionId}`);
        continue;
      }
      
      // If it looks like a year, check it
      if (/^\d{4}$/.test(collectionId) && !yearsToClean.includes(collectionId)) {
        console.log(`  🔍 Found additional year: ${collectionId}`);
        
        const yearDocs = await collection.listDocuments();
        for (const doc of yearDocs) {
          if (doc.id === 'data') {
            console.log(`    🗑️  Deleting: ${collectionId}/data`);
            await doc.delete();
          }
        }
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('===================');
    console.log('Old structure removed:');
    console.log('  ❌ /projects/waterBills/{year}/data (with months array)');
    console.log('\nNew structure preserved:');
    console.log('  ✅ /projects/waterBills/readings/{year}-{month}');
    console.log('  ✅ /projects/waterBills/meters/{unitId}');
    console.log('  ✅ /projects/waterBills/bills/{year}-{month}');
    console.log('  ✅ /projects/waterBills/payments/{paymentId}\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOldWaterStructure();