#!/usr/bin/env node

/**
 * Cleanup Test Water Meter Data
 * Removes test data created during Task 1.3 implementation
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';

async function cleanupTestWaterData() {
  console.log('🧹 Cleaning up test water meter data...\n');
  
  try {
    const db = await getDb();
    const clientId = 'AVII';
    const testUnitIds = ['A01', 'A02', 'A03']; // Units used in testing
    
    let totalDeleted = 0;
    
    for (const unitId of testUnitIds) {
      console.log(`\n📦 Processing unit ${unitId}...`);
      
      // Clean up FY2025 data
      console.log('  Checking FY2025...');
      const path2025 = `clients/${clientId}/units/${unitId}/waterMeter/2025`;
      
      // Delete readings from 2025
      const readings2025 = await db.collection(`${path2025}/readings`).get();
      if (!readings2025.empty) {
        const batch2025 = db.batch();
        readings2025.forEach(doc => {
          batch2025.delete(doc.ref);
          console.log(`    - Deleting reading: ${doc.id}`);
        });
        await batch2025.commit();
        totalDeleted += readings2025.size;
        console.log(`    ✅ Deleted ${readings2025.size} readings from FY2025`);
      } else {
        console.log('    No readings found in FY2025');
      }
      
      // Delete bills from 2025
      const bills2025 = await db.collection(`${path2025}/bills`).get();
      if (!bills2025.empty) {
        const billBatch2025 = db.batch();
        bills2025.forEach(doc => {
          billBatch2025.delete(doc.ref);
          console.log(`    - Deleting bill: ${doc.id}`);
        });
        await billBatch2025.commit();
        totalDeleted += bills2025.size;
        console.log(`    ✅ Deleted ${bills2025.size} bills from FY2025`);
      } else {
        console.log('    No bills found in FY2025');
      }
      
      // Clean up FY2026 data
      console.log('  Checking FY2026...');
      const path2026 = `clients/${clientId}/units/${unitId}/waterMeter/2026`;
      
      // Delete readings from 2026
      const readings2026 = await db.collection(`${path2026}/readings`).get();
      if (!readings2026.empty) {
        const batch2026 = db.batch();
        readings2026.forEach(doc => {
          batch2026.delete(doc.ref);
          console.log(`    - Deleting reading: ${doc.id}`);
        });
        await batch2026.commit();
        totalDeleted += readings2026.size;
        console.log(`    ✅ Deleted ${readings2026.size} readings from FY2026`);
      } else {
        console.log('    No readings found in FY2026');
      }
      
      // Delete bills from 2026
      const bills2026 = await db.collection(`${path2026}/bills`).get();
      if (!bills2026.empty) {
        const billBatch2026 = db.batch();
        bills2026.forEach(doc => {
          billBatch2026.delete(doc.ref);
          console.log(`    - Deleting bill: ${doc.id}`);
        });
        await billBatch2026.commit();
        totalDeleted += bills2026.size;
        console.log(`    ✅ Deleted ${bills2026.size} bills from FY2026`);
      } else {
        console.log('    No bills found in FY2026');
      }
      
      // Delete the year documents if empty
      try {
        const year2025Doc = await db.doc(path2025).get();
        if (year2025Doc.exists) {
          await db.doc(path2025).delete();
          console.log(`    🗑️  Deleted empty FY2025 document`);
        }
        
        const year2026Doc = await db.doc(path2026).get();
        if (year2026Doc.exists) {
          await db.doc(path2026).delete();
          console.log(`    🗑️  Deleted empty FY2026 document`);
        }
      } catch (e) {
        // Year documents might not exist, that's ok
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Cleanup complete! Deleted ${totalDeleted} total documents`);
    console.log('='.repeat(50));
    
    // Show what remains (should be empty)
    console.log('\n📊 Verification - Checking for remaining test data...');
    for (const unitId of testUnitIds) {
      const remaining2025 = await db.collection(`clients/${clientId}/units/${unitId}/waterMeter/2025/readings`).get();
      const remaining2026 = await db.collection(`clients/${clientId}/units/${unitId}/waterMeter/2026/readings`).get();
      
      if (remaining2025.empty && remaining2026.empty) {
        console.log(`  ✅ Unit ${unitId}: Clean`);
      } else {
        console.log(`  ⚠️  Unit ${unitId}: Found ${remaining2025.size + remaining2026.size} remaining documents`);
      }
    }
    
    console.log('\n🎉 Test data cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the cleanup
cleanupTestWaterData();