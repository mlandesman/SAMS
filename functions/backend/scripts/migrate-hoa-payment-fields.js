#!/usr/bin/env node
/**
 * Migration Script: Add basePaid/penaltyPaid fields to HOA payment records
 * 
 * PURPOSE:
 * Legacy HOA payment records only have 'amount' field (total paid).
 * New payment distribution system expects separate 'basePaid' and 'penaltyPaid' fields.
 * This script backfills these fields for existing payment records.
 * 
 * LOGIC:
 * For each payment entry with amount but without basePaid/penaltyPaid:
 * - basePaid = min(amount, scheduledAmount per month)
 * - penaltyPaid = max(0, amount - scheduledAmount per month)
 * 
 * USAGE:
 *   # Dry run (no changes made)
 *   node migrate-hoa-payment-fields.js --client=AVII --dry-run
 * 
 *   # Specific unit
 *   node migrate-hoa-payment-fields.js --client=AVII --unit=106 --dry-run
 * 
 *   # Execute migration
 *   node migrate-hoa-payment-fields.js --client=AVII --execute
 * 
 *   # All clients
 *   node migrate-hoa-payment-fields.js --all --dry-run
 * 
 * SAFETY:
 * - Dry run by default (must pass --execute to make changes)
 * - Creates backup of original payment arrays before modification
 * - Logs all changes for audit trail
 * 
 * Created: 2025-12-19
 * Issue: Enhancement #74 - Partial Payments
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for --prod flag to use production with ADC
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

if (useProduction) {
  // Use Application Default Credentials for production
  console.log(`🌍 Environment: PRODUCTION`);
  console.log(`🔥 Firebase Project: ${productionProjectId}`);
  console.log(`🔑 Using Application Default Credentials (ADC)`);
  console.log(`   Run 'gcloud auth application-default login' if not authenticated`);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: productionProjectId
    });
  }
} else {
  // Use service account key for development
  const possiblePaths = [
    join(__dirname, '../serviceAccountKey.json'),
    join(__dirname, '../../serviceAccountKey.json'),
    join(__dirname, '../../../serviceAccountKey.json'),
  ];

  let serviceAccount = null;
  let foundPath = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      try {
        serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
        foundPath = path;
        break;
      } catch (e) {
        console.warn(`⚠️ Found ${path} but could not parse: ${e.message}`);
        continue;
      }
    }
  }

  if (!serviceAccount) {
    console.error('❌ Could not find serviceAccountKey.json');
    console.error('Tried paths:', possiblePaths);
    process.exit(1);
  }

  console.log(`🌍 Environment: DEVELOPMENT`);
  console.log(`✅ Loaded service account from: ${foundPath}`);
  console.log(`🔥 Firebase Project: ${serviceAccount.project_id}`);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

const db = admin.firestore();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    client: null,
    unit: null,
    all: false,
    dryRun: true,
    execute: false,
    verbose: false
  };
  
  for (const arg of args) {
    if (arg.startsWith('--client=')) {
      options.client = arg.split('=')[1];
    } else if (arg.startsWith('--unit=')) {
      options.unit = arg.split('=')[1];
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--execute') {
      options.execute = true;
      options.dryRun = false;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }
  
  return options;
}

// Get list of clients to process
async function getClients(options) {
  if (options.client) {
    return [options.client];
  }
  
  if (options.all) {
    const snapshot = await db.collection('clients').get();
    return snapshot.docs.map(doc => doc.id);
  }
  
  throw new Error('Must specify --client=<id> or --all');
}

// Process a single HOA dues document
async function processHoaDuesDoc(clientId, unitId, year, doc, options) {
  const data = doc.data();
  const payments = data.payments || [];
  const scheduledAmount = data.scheduledAmount || 0;
  
  if (!scheduledAmount) {
    console.log(`    ⚠️  No scheduledAmount for ${unitId}/${year}, skipping`);
    return { updated: false, changes: 0 };
  }
  
  let changes = 0;
  const updatedPayments = payments.map((payment, index) => {
    if (!payment) return payment;
    
    // Skip if already has basePaid/penaltyPaid set
    if (payment.basePaid !== undefined && payment.penaltyPaid !== undefined) {
      return payment;
    }
    
    // Skip if no amount
    if (!payment.amount || payment.amount === 0) {
      return payment;
    }
    
    // Calculate basePaid/penaltyPaid from amount
    const basePaid = Math.min(payment.amount, scheduledAmount);
    const penaltyPaid = Math.max(0, payment.amount - scheduledAmount);
    
    changes++;
    
    if (options.verbose) {
      console.log(`      Month ${index}: amount=${payment.amount} → basePaid=${basePaid}, penaltyPaid=${penaltyPaid}`);
    }
    
    return {
      ...payment,
      basePaid,
      penaltyPaid,
      _migrated: new Date().toISOString()
    };
  });
  
  if (changes === 0) {
    return { updated: false, changes: 0 };
  }
  
  if (!options.dryRun) {
    // Save backup of original payments
    await doc.ref.update({
      payments: updatedPayments,
      _originalPayments_backup: payments,
      _migration: {
        script: 'migrate-hoa-payment-fields.js',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        changesCount: changes
      }
    });
  }
  
  return { updated: true, changes };
}

// Process all units for a client
async function processClient(clientId, options) {
  console.log(`\n📋 Processing client: ${clientId}`);
  
  let totalDocs = 0;
  let totalUpdated = 0;
  let totalChanges = 0;
  
  // Get units to process
  let unitsQuery;
  if (options.unit) {
    // Specific unit
    const unitDoc = await db.collection('clients').doc(clientId)
      .collection('units').doc(options.unit).get();
    if (!unitDoc.exists) {
      console.log(`  ❌ Unit ${options.unit} not found`);
      return { docs: 0, updated: 0, changes: 0 };
    }
    unitsQuery = [unitDoc];
  } else {
    // All units
    const snapshot = await db.collection('clients').doc(clientId)
      .collection('units').get();
    unitsQuery = snapshot.docs;
  }
  
  console.log(`  📦 Found ${unitsQuery.length} unit(s)`);
  
  for (const unitDoc of unitsQuery) {
    const unitId = unitDoc.id;
    
    // Get all HOA dues years for this unit
    // Collection is 'dues' not 'hoa_dues'
    const hoaDuesSnapshot = await db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').get();
    
    if (hoaDuesSnapshot.empty) continue;
    
    console.log(`  🏠 Unit ${unitId}: ${hoaDuesSnapshot.docs.length} year(s)`);
    
    for (const yearDoc of hoaDuesSnapshot.docs) {
      const year = yearDoc.id;
      totalDocs++;
      
      const result = await processHoaDuesDoc(clientId, unitId, year, yearDoc, options);
      
      if (result.updated) {
        totalUpdated++;
        totalChanges += result.changes;
        console.log(`    ✅ ${year}: ${result.changes} payment(s) updated`);
      } else if (options.verbose) {
        console.log(`    ⏭️  ${year}: no changes needed`);
      }
    }
  }
  
  return { docs: totalDocs, updated: totalUpdated, changes: totalChanges };
}

// Main execution
async function main() {
  const options = parseArgs();
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HOA Payment Fields Migration Script');
  console.log('  Adding basePaid/penaltyPaid to legacy payment records');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Mode: ${options.dryRun ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (will modify data)'}`);
  console.log(`  Client: ${options.client || (options.all ? 'ALL' : 'not specified')}`);
  if (options.unit) console.log(`  Unit: ${options.unit}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (!options.client && !options.all) {
    console.error('\n❌ Error: Must specify --client=<id> or --all');
    console.log('\nUsage:');
    console.log('  node migrate-hoa-payment-fields.js --client=AVII --dry-run');
    console.log('  node migrate-hoa-payment-fields.js --client=AVII --unit=106 --execute');
    console.log('  node migrate-hoa-payment-fields.js --all --dry-run');
    process.exit(1);
  }
  
  try {
    const clients = await getClients(options);
    console.log(`\n📋 Will process ${clients.length} client(s): ${clients.join(', ')}`);
    
    let grandTotalDocs = 0;
    let grandTotalUpdated = 0;
    let grandTotalChanges = 0;
    
    for (const clientId of clients) {
      const result = await processClient(clientId, options);
      grandTotalDocs += result.docs;
      grandTotalUpdated += result.updated;
      grandTotalChanges += result.changes;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Documents scanned: ${grandTotalDocs}`);
    console.log(`  Documents updated: ${grandTotalUpdated}`);
    console.log(`  Payment entries fixed: ${grandTotalChanges}`);
    console.log(`  Mode: ${options.dryRun ? '🔍 DRY RUN (no changes made)' : '⚡ EXECUTED'}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (options.dryRun && grandTotalChanges > 0) {
      console.log('\n💡 To apply these changes, run with --execute instead of --dry-run');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
