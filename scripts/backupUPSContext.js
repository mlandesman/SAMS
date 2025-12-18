#!/usr/bin/env node

/**
 * backupUPSContext.js
 * 
 * Backs up all data affected by the Unified Payment System for a specific unit.
 * This allows safe testing of payments with rollback capability.
 * 
 * Usage:
 *   FIRESTORE_ENV=prod node scripts/backupUPSContext.js AVII 106
 *   USE_ADC=true FIRESTORE_ENV=prod node scripts/backupUPSContext.js AVII 106
 * 
 * For production, you may need to use Application Default Credentials:
 *   gcloud auth application-default login
 *   gcloud config set project sams-sandyland-prod
 *   USE_ADC=true FIRESTORE_ENV=prod node scripts/backupUPSContext.js AVII 106
 * 
 * Creates: /test-results/ups-backup-{clientId}-{unitId}-{timestamp}.json
 */

import { initializeFirebase, getCurrentEnvironment } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get project version from shared/version.json
 */
async function getProjectVersion() {
  try {
    const versionPath = path.join(process.cwd(), 'shared/version.json');
    const content = await fs.readFile(versionPath, 'utf-8');
    const versionData = JSON.parse(content);
    return versionData.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// For production, default to ADC. For dev, use service account key.
const env = getCurrentEnvironment();
const useADC = process.env.USE_ADC === 'true' || (env === 'prod' && process.env.USE_ADC !== 'false');

// Initialize Firebase
const { db } = await initializeFirebase(null, { useADC });

/**
 * Convert Firestore Timestamps to serializable format
 */
function serializeData(data) {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data._seconds !== undefined && data._nanoseconds !== undefined) {
    // Firestore Timestamp
    return {
      __type: 'Timestamp',
      _seconds: data._seconds,
      _nanoseconds: data._nanoseconds
    };
  }
  
  if (data.toDate && typeof data.toDate === 'function') {
    // Firestore Timestamp object
    const date = data.toDate();
    return {
      __type: 'Timestamp',
      _seconds: Math.floor(date.getTime() / 1000),
      _nanoseconds: (date.getTime() % 1000) * 1000000
    };
  }
  
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }
  
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value);
    }
    return result;
  }
  
  return data;
}

/**
 * Backup all UPS-related data for a unit
 */
async function backupUPSContext(clientId, unitId) {
  console.log(`\n📦 UPS Context Backup`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Unit: ${unitId}`);
  console.log(`   Environment: ${process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'unknown'}`);
  console.log('─'.repeat(50));
  
  const backup = {
    meta: {
      clientId,
      unitId,
      timestamp: new Date().toISOString(),
      environment: process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'unknown',
      scriptVersion: '1.1',  // Version of this backup script format
      projectVersion: await getProjectVersion()
    },
    data: {
      unit: null,
      creditBalances: null,  // Separate document at units/creditBalances
      dues: {},
      transactions: [],
      waterBills: []
    }
  };
  
  try {
    // 1. Backup unit document (includes creditBalance)
    console.log('\n1️⃣ Backing up unit document...');
    const unitRef = db.collection('clients').doc(clientId).collection('units').doc(unitId);
    const unitDoc = await unitRef.get();
    
    if (unitDoc.exists) {
      backup.data.unit = {
        _id: unitDoc.id,
        _path: unitRef.path,
        ...serializeData(unitDoc.data())
      };
      console.log(`   ✅ Unit document backed up`);
    } else {
      console.log(`   ⚠️ Unit document not found`);
    }
    
    // 2. Backup creditBalances document (separate from unit doc)
    console.log('\n2️⃣ Backing up creditBalances document...');
    const creditBalancesRef = db.collection('clients').doc(clientId).collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (creditBalancesDoc.exists) {
      backup.data.creditBalances = {
        _id: creditBalancesDoc.id,
        _path: creditBalancesRef.path,
        ...serializeData(creditBalancesDoc.data())
      };
      
      // Extract this unit's credit balance for display
      const cbData = creditBalancesDoc.data();
      const unitCB = cbData[unitId]?.creditBalance || 0;
      console.log(`   ✅ creditBalances document backed up`);
      console.log(`   💰 Unit ${unitId} Credit Balance: ${(unitCB / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} pesos`);
    } else {
      console.log(`   ⚠️ creditBalances document not found`);
    }
    
    // 3. Backup all dues subcollection documents
    console.log('\n3️⃣ Backing up dues subcollection...');
    const duesRef = unitRef.collection('dues');
    const duesSnapshot = await duesRef.get();
    
    duesSnapshot.forEach(doc => {
      backup.data.dues[doc.id] = {
        _id: doc.id,
        _path: doc.ref.path,
        ...serializeData(doc.data())
      };
    });
    console.log(`   ✅ ${duesSnapshot.size} dues documents backed up`);
    
    // 4. Backup transactions for this unit
    console.log('\n4️⃣ Backing up transactions...');
    const txnRef = db.collection('clients').doc(clientId).collection('transactions');
    const txnSnapshot = await txnRef.where('unitId', '==', unitId).get();
    
    txnSnapshot.forEach(doc => {
      backup.data.transactions.push({
        _id: doc.id,
        _path: doc.ref.path,
        ...serializeData(doc.data())
      });
    });
    console.log(`   ✅ ${txnSnapshot.size} transactions backed up`);
    
    // 5. Backup water bills for this unit (if any)
    console.log('\n5️⃣ Backing up water bills...');
    try {
      const waterBillsRef = db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills').collection('bills');
      const waterSnapshot = await waterBillsRef.where('unitId', '==', unitId).get();
      
      waterSnapshot.forEach(doc => {
        backup.data.waterBills.push({
          _id: doc.id,
          _path: doc.ref.path,
          ...serializeData(doc.data())
        });
      });
      console.log(`   ✅ ${waterSnapshot.size} water bills backed up`);
    } catch (e) {
      console.log(`   ⚠️ No water bills collection or error: ${e.message}`);
    }
    
    // 5. Save backup to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ups-backup-${clientId}-${unitId}-${timestamp}.json`;
    const outputPath = path.join('/Users/michael/Projects/SAMS/test-results', filename);
    
    await fs.writeFile(outputPath, JSON.stringify(backup, null, 2));
    
    console.log('\n' + '─'.repeat(50));
    console.log('✅ BACKUP COMPLETE');
    console.log(`📁 File: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(`   Unit: ${backup.data.unit ? '1' : '0'} document`);
    console.log(`   CreditBalances: ${backup.data.creditBalances ? '1' : '0'} document`);
    console.log(`   Dues: ${Object.keys(backup.data.dues).length} documents`);
    console.log(`   Transactions: ${backup.data.transactions.length} documents`);
    console.log(`   Water Bills: ${backup.data.waterBills.length} documents`);
    console.log('\n💡 To restore, run:');
    console.log(`   node scripts/restoreUPSContext.js "${filename}"`);
    
    return outputPath;
    
  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const clientId = process.argv[2];
const unitId = process.argv[3];

if (!clientId || !unitId) {
  console.error('❌ Usage: node scripts/backupUPSContext.js <clientId> <unitId>');
  console.error('   Example: node scripts/backupUPSContext.js AVII 106');
  process.exit(1);
}

await backupUPSContext(clientId, unitId);
process.exit(0);
