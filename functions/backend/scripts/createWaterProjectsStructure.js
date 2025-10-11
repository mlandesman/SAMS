#!/usr/bin/env node

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🏗️  CREATING: Water Bills Projects Structure\n');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../serviceAccountKey.json'), 'utf8')
);

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

async function createProjectsStructure() {
  console.log('Creating new projects structure...\n');
  
  try {
    // Create the projects collection and waterBills document
    const projectRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills');
    
    console.log('Setting up FY2026 structure...');
    
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
    
    console.log('Adding test data for July 2025...');
    
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
      // Other units left empty for future data entry
    };
    
    console.log('Saving to Firestore...');
    
    await projectRef.collection('2026').doc('data').set(fy2026Data);
    console.log('✅ Projects structure created successfully!\n');
    
    return fy2026Data;
    
  } catch (error) {
    console.error('❌ Error creating projects structure:', error.message);
    throw error;
  }
}

async function verifyStructure() {
  console.log('🔍 Verifying created structure...\n');
  
  try {
    const newDoc = await db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data').get();
    
    if (!newDoc.exists) {
      throw new Error('Structure verification failed: document not found');
    }
    
    const data = newDoc.data();
    const unit101 = data.months[0].units['101'];
    const unit102 = data.months[0].units['102'];
    
    console.log('📊 STRUCTURE VERIFICATION:\n');
    console.log(`✓ Fiscal Year: ${data.fiscalYear}`);
    console.log(`✓ Rate per m³: $${data.config.ratePerM3} ${data.config.currency}`);
    console.log(`✓ Month array length: ${data.months.length}`);
    console.log(`✓ Reading date: ${data.months[0].readingDate}`);
    console.log(`✓ Unit 101: ${unit101.priorReading} → ${unit101.currentReading} = ${unit101.consumption}m³ = $${unit101.amount}`);
    console.log(`✓ Unit 102: ${unit102.priorReading} → ${unit102.currentReading} = ${unit102.consumption}m³ = $${unit102.amount}`);
    
    // Verify calculations
    if (unit101.consumption !== 18) {
      throw new Error(`Unit 101 consumption error: ${unit101.consumption} !== 18`);
    }
    if (unit101.amount !== 900) {
      throw new Error(`Unit 101 amount error: ${unit101.amount} !== 900`);
    }
    if (unit102.consumption !== 7) {
      throw new Error(`Unit 102 consumption error: ${unit102.consumption} !== 7`);
    }
    if (unit102.amount !== 350) {
      throw new Error(`Unit 102 amount error: ${unit102.amount} !== 350`);
    }
    
    console.log('\n✅ ALL VERIFICATION TESTS PASSED!\n');
    
    return {
      success: true,
      fiscalYear: data.fiscalYear,
      testDataVerified: true
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    console.log('Task: WB-1 - Database Cleanup & Projects Structure Creation\n');
    
    // Create new structure
    const structure = await createProjectsStructure();
    
    // Verify structure
    const verification = await verifyStructure();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('🎉 SUCCESS: Water Bills projects structure created!\n');
    console.log('SUMMARY:');
    console.log(`• Created new projects structure for FY${verification.fiscalYear}`);
    console.log(`• Test data verified for Units 101 and 102`);
    console.log(`• Structure path: /clients/AVII/projects/waterBills/2026/`);
    console.log(`• Total execution time: ${duration} seconds\n`);
    
    console.log('🔄 NEXT STEPS:');
    console.log('• Database is ready for backend API updates');
    console.log('• Implementation Agent 2 can proceed with Task WB-2');
    console.log('• Structure is reusable for other special projects\n');
    
    return {
      success: true,
      structurePath: '/clients/AVII/projects/waterBills/2026/',
      verification: verification
    };
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n💥 FAILURE after ${duration} seconds`);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();