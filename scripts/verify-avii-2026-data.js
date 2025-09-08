#!/usr/bin/env node

/**
 * Quick script to verify AVII 2026 data exists in Firebase
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to find service account key
let serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  const possiblePaths = [
    join(__dirname, '..', 'backend', 'serviceAccountKey.json'),
    join(__dirname, '..', 'backend', 'functions', 'serviceAccountKey.json'),
    join(__dirname, '..', 'serviceAccountKey.json'),
    join(__dirname, 'serviceAccountKey.json')
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      serviceAccountPath = path;
      break;
    }
  }
}

if (!serviceAccountPath || !existsSync(serviceAccountPath)) {
  console.error('❌ Service account key not found!');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function verifyData() {
  console.log('🔍 Verifying AVII HOA Dues data...\n');

  try {
    // Check a few units for both 2025 and 2026
    const testUnits = ['101', '102', '201'];
    
    for (const unitId of testUnits) {
      console.log(`\n📋 Unit ${unitId}:`);
      
      // Check 2025
      const doc2025 = await db.doc(`clients/AVII/units/${unitId}/dues/2025`).get();
      if (doc2025.exists) {
        const data = doc2025.data();
        console.log(`  2025: ✅ Exists - Payments: ${data.payments?.filter(p => p.paid).length || 0}`);
      } else {
        console.log(`  2025: ❌ No data`);
      }
      
      // Check 2026
      const doc2026 = await db.doc(`clients/AVII/units/${unitId}/dues/2026`).get();
      if (doc2026.exists) {
        const data = doc2026.data();
        const paidCount = data.payments?.filter(p => p.paid).length || 0;
        console.log(`  2026: ✅ Exists - Payments: ${paidCount}`);
        
        // Show payment details
        if (paidCount > 0) {
          console.log(`  Payment details:`);
          data.payments.forEach((payment, index) => {
            if (payment.paid) {
              console.log(`    Month ${index + 1}: $${payment.amount}`);
            }
          });
        }
      } else {
        console.log(`  2026: ❌ No data`);
      }
    }
    
    // Also check client configuration
    console.log('\n\n📋 Checking AVII client configuration:');
    const clientDoc = await db.doc('clients/AVII').get();
    if (clientDoc.exists) {
      const clientData = clientDoc.data();
      console.log(`  Fiscal Year Start Month: ${clientData.configuration?.fiscalYearStartMonth || 'Not set'}`);
      console.log(`  Currency: ${clientData.configuration?.currency || 'Not set'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

verifyData();