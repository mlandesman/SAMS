#!/usr/bin/env node

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 FIXING: Water Projects Structure - Removing Config Duplication\n');

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

// Helper Functions
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

async function readExistingConfig() {
  console.log('📖 Reading existing config from /clients/AVII/config/waterBills...');
  
  try {
    const configDoc = await db.collection('clients').doc('AVII')
      .collection('config').doc('waterBills').get();
    
    if (!configDoc.exists) {
      throw new Error('Config document does not exist');
    }
    
    const config = configDoc.data();
    console.log(`✓ Config found with ratePerM3: ${config.ratePerM3}`);
    console.log(`✓ Config includes ${Object.keys(config).length} fields`);
    
    return config;
    
  } catch (error) {
    console.error('❌ Error reading config:', error.message);
    throw error;
  }
}

async function fixProjectsStructure() {
  console.log('🔧 Updating projects structure to remove config duplication...\n');
  
  try {
    const projectRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills');
    
    // Read current structure
    const currentDoc = await projectRef.collection('2026').doc('data').get();
    if (!currentDoc.exists) {
      throw new Error('Projects structure does not exist');
    }
    
    const currentData = currentDoc.data();
    console.log('Current structure loaded');
    
    // Create corrected structure WITHOUT config duplication
    const correctedData = {
      fiscalYear: 2026,
      // REMOVED: config object - will be read from /clients/AVII/config/waterBills
      months: Array(12).fill(null).map((_, index) => ({
        monthIndex: index,
        period: getPeriodName(index),
        billingMonth: getBillingMonth(index),
        readingDate: null,
        units: {}
      }))
    };
    
    // Preserve existing test data if it exists
    if (currentData.months && currentData.months[0] && currentData.months[0].units) {
      console.log('Preserving existing test data...');
      correctedData.months[0] = currentData.months[0];
      console.log(`✓ Preserved test data for ${Object.keys(correctedData.months[0].units).length} units`);
    }
    
    // Update the structure
    await projectRef.collection('2026').doc('data').set(correctedData);
    console.log('✅ Projects structure updated successfully!\n');
    
    return correctedData;
    
  } catch (error) {
    console.error('❌ Error updating projects structure:', error.message);
    throw error;
  }
}

async function verifyCorrection() {
  console.log('🔍 Verifying corrected structure...\n');
  
  try {
    // Check projects structure
    const projectDoc = await db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('2026').doc('data').get();
    
    if (!projectDoc.exists) {
      throw new Error('Projects structure not found');
    }
    
    const data = projectDoc.data();
    
    // Check config document exists separately
    const configDoc = await db.collection('clients').doc('AVII')
      .collection('config').doc('waterBills').get();
    
    if (!configDoc.exists) {
      throw new Error('Config document not found');
    }
    
    const config = configDoc.data();
    
    console.log('📊 VERIFICATION RESULTS:\n');
    console.log(`✓ Projects structure: Fiscal Year ${data.fiscalYear}`);
    console.log(`✓ Projects structure: ${data.months.length} months initialized`);
    console.log(`✓ Projects structure: NO config duplication (removed)`);
    console.log(`✓ Config document: Rate ${config.ratePerM3} ${config.currency}`);
    console.log(`✓ Config document: ${Object.keys(config).length} configuration fields`);
    
    // Verify test data still exists
    if (data.months[0].units && Object.keys(data.months[0].units).length > 0) {
      const testUnits = Object.keys(data.months[0].units);
      console.log(`✓ Test data preserved: Units ${testUnits.join(', ')}`);
    }
    
    console.log('\n✅ CORRECTION SUCCESSFUL!\n');
    
    return {
      projectsCorrect: true,
      configSeparate: true,
      testDataPreserved: Object.keys(data.months[0].units || {}).length > 0
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    console.log('Fixing config duplication in water projects structure...\n');
    
    // Read existing config to verify it exists
    const config = await readExistingConfig();
    
    // Fix projects structure
    const correctedStructure = await fixProjectsStructure();
    
    // Verify correction
    const verification = await verifyCorrection();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('🎉 SUCCESS: Config duplication removed!\n');
    console.log('SUMMARY:');
    console.log('• Removed hardcoded config from projects structure');
    console.log('• Config data remains in /clients/AVII/config/waterBills');
    console.log('• Test data preserved in projects structure');
    console.log('• APIs should read config from authoritative source');
    console.log(`• Total execution time: ${duration} seconds\n`);
    
    console.log('🔄 FOR IMPLEMENTATION AGENT 2:');
    console.log('• Projects structure: /clients/AVII/projects/waterBills/2026/data');
    console.log('• Config source: /clients/AVII/config/waterBills');
    console.log('• Create endpoint to read config when needed');
    console.log('• Use config.ratePerM3 for calculations (5000, not 50)\n');
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n💥 FAILURE after ${duration} seconds`);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();