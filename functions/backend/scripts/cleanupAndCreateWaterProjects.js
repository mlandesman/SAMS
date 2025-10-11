#!/usr/bin/env node

/**
 * Water Bills Database Cleanup & Projects Structure Creation
 * 
 * This script completely removes the old water meter structure and creates
 * the new projects-based structure following the proven HOA Dues pattern.
 * 
 * Task: WB-1 - Database Cleanup & Projects Structure Creation
 * Priority: IMMEDIATE - Blocking all other work
 * 
 * Critical Operations:
 * 1. Delete ALL old water meter data from /clients/AVII/units/waterMeter/
 * 2. Create new structure at /clients/AVII/projects/waterBills/2026/
 * 3. Initialize FY2026 with proper month-based array structure
 * 4. Add test data with consumption calculations
 * 5. Verify structure through automated tests
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://sandyland-management-system-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();

// Helper Functions for Date/Period Management
const getPeriodName = (monthIndex) => {
  const periods = [
    'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025',
    'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026'
  ];
  return periods[monthIndex];
};

const getBillingMonth = (monthIndex) => {
  const billing = [
    'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026',
    'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026'
  ];
  return billing[monthIndex];
};

// Step 1: Delete ALL Old Water Meter Data
const deleteOldStructure = async () => {
  console.log('🗑️  Step 1: Deleting ALL old water meter data...\n');
  
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  let totalDeleted = 0;
  
  for (const unitId of units) {
    console.log(`Cleaning unit ${unitId}...`);
    
    try {
      const waterMeterRef = db.collection('clients').doc('AVII')
        .collection('units').doc(unitId)
        .collection('waterMeter');
      
      const docs = await waterMeterRef.get();
      
      if (docs.empty) {
        console.log(`  ✓ Unit ${unitId}: No water meter data found`);
        continue;
      }
      
      const batch = db.batch();
      docs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      totalDeleted += docs.docs.length;
      console.log(`  ✓ Unit ${unitId}: Deleted ${docs.docs.length} documents`);
      
    } catch (error) {
      console.error(`  ❌ Unit ${unitId}: Error deleting water meter data:`, error.message);
      throw error;
    }
  }
  
  console.log(`\n✅ Step 1 Complete: Deleted ${totalDeleted} old water meter documents\n`);
  return totalDeleted;
};

// Step 2: Create New Projects Structure
const createProjectsStructure = async () => {
  console.log('🏗️  Step 2: Creating new projects structure...\n');
  
  try {
    // Create the projects collection and waterBills document
    const projectRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills');
    
    // Initialize FY2026 (July 2025 - June 2026)
    const fy2026Data = {
      fiscalYear: 2026,
      config: {
        ratePerM3: 50,
        penaltyRate: 0.05,
        penaltyDays: 10,
        currency: 'MXN',
        meterOrder: ['101', '201', '102', '202', '103', '203', '104', '204', '105', '106', 'common', 'building']
      },
      months: Array(12).fill(null).map((_, index) => ({
        monthIndex: index,
        period: getPeriodName(index),           // Jul 2025, Aug 2025, etc.
        billingMonth: getBillingMonth(index),   // Aug 2025, Sep 2025, etc.
        readingDate: null,
        units: {}
      }))
    };
    
    // Add test data for July (month 0) - Units 101 and 102
    fy2026Data.months[0].readingDate = '2025-07-28';
    fy2026Data.months[0].units = {
      '101': {
        priorReading: 1749,
        currentReading: 1767,
        consumption: 18,
        amount: 900,  // 18 × 50
        unpaidBalance: 0,
        monthsBehind: 0,
        paid: false,
        paidDate: null,
        paymentRecord: null
      },
      '102': {
        priorReading: 2340,
        currentReading: 2347,
        consumption: 7,
        amount: 350,  // 7 × 50
        unpaidBalance: 0,
        monthsBehind: 0,
        paid: false,
        paidDate: null,
        paymentRecord: null
      }
      // Leave other units empty for now - will be populated as readings come in
    };
    
    await projectRef.collection('2026').doc('data').set(fy2026Data);
    console.log('✅ Step 2 Complete: Projects structure created with test data\n');
    
    return fy2026Data;
    
  } catch (error) {
    console.error('❌ Step 2 Failed: Error creating projects structure:', error.message);
    throw error;
  }
};

// Step 3: Verification Tests
const verifyStructure = async () => {
  console.log('🔍 Step 3: Running verification tests...\n');
  
  try {
    // Test 1: Verify old structure is gone
    console.log('Test 1: Verifying old structure removal...');
    const oldDoc = await db.collection('clients').doc('AVII')
      .collection('units').doc('101')
      .collection('waterMeter').get();
    
    if (!oldDoc.empty) {
      throw new Error('❌ CRITICAL: Old water meter structure still exists!');
    }
    console.log('✅ Test 1 PASSED: Old structure completely removed\n');
    
    // Test 2: Verify new structure exists
    console.log('Test 2: Verifying new structure creation...');
    const newDoc = await db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data').get();
    
    if (!newDoc.exists) {
      throw new Error('❌ CRITICAL: New projects structure not created!');
    }
    console.log('✅ Test 2 PASSED: New structure exists\n');
    
    // Test 3: Verify test data is correct
    console.log('Test 3: Verifying test data integrity...');
    const data = newDoc.data();
    const unit101 = data.months[0].units['101'];
    const unit102 = data.months[0].units['102'];
    
    // Test Unit 101 data
    if (unit101.consumption !== 18) {
      throw new Error(`❌ CRITICAL: Unit 101 wrong consumption: ${unit101.consumption} (expected 18)`);
    }
    
    if (unit101.amount !== 900) {
      throw new Error(`❌ CRITICAL: Unit 101 wrong amount: ${unit101.amount} (expected 900)`);
    }
    
    // Test Unit 102 data
    if (unit102.consumption !== 7) {
      throw new Error(`❌ CRITICAL: Unit 102 wrong consumption: ${unit102.consumption} (expected 7)`);
    }
    
    if (unit102.amount !== 350) {
      throw new Error(`❌ CRITICAL: Unit 102 wrong amount: ${unit102.amount} (expected 350)`);
    }
    
    // Test structure integrity
    if (data.fiscalYear !== 2026) {
      throw new Error(`❌ CRITICAL: Wrong fiscal year: ${data.fiscalYear} (expected 2026)`);
    }
    
    if (data.months.length !== 12) {
      throw new Error(`❌ CRITICAL: Wrong month count: ${data.months.length} (expected 12)`);
    }
    
    if (data.config.ratePerM3 !== 50) {
      throw new Error(`❌ CRITICAL: Wrong rate: ${data.config.ratePerM3} (expected 50)`);
    }
    
    console.log('✅ Test 3 PASSED: Test data integrity verified\n');
    
    // Display the created structure for confirmation
    console.log('📊 VERIFICATION SUMMARY:\n');
    console.log(`Fiscal Year: ${data.fiscalYear}`);
    console.log(`Rate per m³: $${data.config.ratePerM3} ${data.config.currency}`);
    console.log(`Month 0 (${data.months[0].period}) - Reading Date: ${data.months[0].readingDate}:`);
    console.log(`  Unit 101: ${unit101.priorReading} → ${unit101.currentReading} = ${unit101.consumption}m³ = $${unit101.amount}`);
    console.log(`  Unit 102: ${unit102.priorReading} → ${unit102.currentReading} = ${unit102.consumption}m³ = $${unit102.amount}`);
    console.log(`  Other Units: Empty (ready for data entry)`);
    
    console.log('\n✅ ALL VERIFICATION TESTS PASSED!\n');
    
    return {
      structureValid: true,
      fiscalYear: data.fiscalYear,
      testDataCorrect: true,
      unit101Data: unit101,
      unit102Data: unit102
    };
    
  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error.message);
    throw error;
  }
};

// Main execution function
const main = async () => {
  const startTime = Date.now();
  console.log('🚀 STARTING: Water Bills Database Cleanup & Projects Structure Creation\n');
  console.log('⚠️  WARNING: This will PERMANENTLY DELETE all existing water meter data!\n');
  console.log('Task: WB-1 - Database Cleanup & Projects Structure Creation\n');
  
  try {
    // Step 1: Delete old structure
    const deletedCount = await deleteOldStructure();
    
    // Step 2: Create new structure
    const newStructure = await createProjectsStructure();
    
    // Step 3: Verify everything
    const verification = await verifyStructure();
    
    // Success summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('🎉 SUCCESS: Database cleanup and structure creation completed!\n');
    console.log('SUMMARY:');
    console.log(`• Deleted ${deletedCount} old water meter documents`);
    console.log(`• Created new projects structure for FY${verification.fiscalYear}`);
    console.log(`• Verified test data for Units 101 and 102`);
    console.log(`• All verification tests passed`);
    console.log(`• Total execution time: ${duration} seconds\n`);
    
    console.log('🔄 NEXT STEPS:');
    console.log('• Notify Implementation Agent 2 that database is ready');
    console.log('• Provide new structure path: /clients/AVII/projects/waterBills/2026/');
    console.log('• Confirm test data exists and is accessible');
    console.log('• Proceed with backend API updates (Task WB-2)\n');
    
    return {
      success: true,
      deletedDocuments: deletedCount,
      newStructurePath: '/clients/AVII/projects/waterBills/2026/',
      verification: verification
    };
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error('\n💥 CRITICAL FAILURE after', duration, 'seconds');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    
    console.error('\n🚨 EMERGENCY ACTIONS REQUIRED:');
    console.error('• Do NOT proceed with Task WB-2');
    console.error('• Review error details above');
    console.error('• Check Firebase permissions and connectivity');
    console.error('• Contact Manager Agent for guidance\n');
    
    process.exit(1);
  }
};

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  deleteOldStructure,
  createProjectsStructure,
  verifyStructure,
  getPeriodName,
  getBillingMonth,
  main as cleanupAndCreateWaterProjects
};