#!/usr/bin/env node

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 DEBUG: Water Meter Cleanup Process\n');

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

async function checkWaterMeterData() {
  console.log('🔍 Step 1: Checking existing water meter data...\n');
  
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  let totalFound = 0;
  
  for (const unitId of units) {
    try {
      const waterMeterRef = db.collection('clients').doc('AVII')
        .collection('units').doc(unitId)
        .collection('waterMeter');
      
      const docs = await waterMeterRef.get();
      
      if (!docs.empty) {
        console.log(`Unit ${unitId}: Found ${docs.docs.length} water meter documents`);
        totalFound += docs.docs.length;
      } else {
        console.log(`Unit ${unitId}: No water meter documents found`);
      }
      
    } catch (error) {
      console.error(`Unit ${unitId}: Error checking - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Total water meter documents found: ${totalFound}\n`);
  return totalFound;
}

async function checkProjectsStructure() {
  console.log('🔍 Step 2: Checking existing projects structure...\n');
  
  try {
    const projectRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills');
    
    const doc = await projectRef.get();
    
    if (doc.exists) {
      console.log('✓ waterBills project document exists');
      
      // Check for 2026 data
      const fy2026Ref = projectRef.collection('2026').doc('data');
      const fy2026Doc = await fy2026Ref.get();
      
      if (fy2026Doc.exists) {
        console.log('✓ FY2026 data document exists');
        const data = fy2026Doc.data();
        console.log(`  - Fiscal Year: ${data.fiscalYear}`);
        console.log(`  - Months array length: ${data.months?.length || 'undefined'}`);
        console.log(`  - Config rate: $${data.config?.ratePerM3 || 'undefined'}`);
      } else {
        console.log('❌ FY2026 data document does not exist');
      }
    } else {
      console.log('❌ waterBills project document does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error checking projects structure:', error.message);
  }
  
  console.log('');
}

async function main() {
  try {
    console.log('Starting diagnostic checks...\n');
    
    const waterMeterCount = await checkWaterMeterData();
    await checkProjectsStructure();
    
    console.log('🎯 DIAGNOSIS COMPLETE\n');
    
    if (waterMeterCount > 0) {
      console.log(`⚠️  Found ${waterMeterCount} water meter documents that need to be deleted`);
    } else {
      console.log('✓ No water meter documents found (cleanup may already be done)');
    }
    
    console.log('\nNext: Run the full cleanup script if needed');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
  
  process.exit(0);
}

main();