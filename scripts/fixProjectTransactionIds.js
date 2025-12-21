/**
 * Fix Project Collection Transaction IDs
 * 
 * Problem: Project collections have incorrect transactionIds from import/cleanup
 * Solution: Match transactions by unitId, date, and amount to find correct transactionId
 * 
 * Usage (requires ADC setup first):
 *   gcloud auth application-default login
 *   gcloud config set project sams-sandyland-prod  (or sandyland-management-system for dev)
 * 
 *   DEV (dry-run):   node scripts/fixProjectTransactionIds.js MTC
 *   DEV (execute):   node scripts/fixProjectTransactionIds.js MTC --execute
 * 
 *   PROD (dry-run):  node scripts/fixProjectTransactionIds.js MTC --prod
 *   PROD (execute):  node scripts/fixProjectTransactionIds.js MTC --prod --execute
 * 
 * Flags:
 *   --prod: Target production database
 *   --execute: Apply changes (default is dry-run)
 *   [clientId]: Client to process (default: MTC)
 */

import admin from 'firebase-admin';
import { DateTime } from 'luxon';

// Determine environment
const ENV = process.argv.includes('--prod') ? 'prod' : 'dev';
const DRY_RUN = !process.argv.includes('--execute');
// Get client ID (skip node and script paths, find first non-flag argument)
const CLIENT_ID = process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'MTC';

// Initialize Firebase with ADC
function initFirebase() {
  if (ENV === 'prod') {
    admin.initializeApp({
      projectId: 'sams-sandyland-prod',
    });
    console.log('🔥 Connected to PRODUCTION');
  } else {
    admin.initializeApp({
      projectId: 'sandyland-management-system',
    });
    console.log('🔥 Connected to DEV');
  }
  return admin.firestore();
}

const db = initFirebase();

console.log('🔧 Fix Project Collection Transaction IDs');
console.log('==========================================');
console.log(`Client: ${CLIENT_ID}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update Firestore)'}`);
console.log('');

/**
 * Normalize unit ID - extract just the unit number/code
 * "1C (Eifler)" → "1C"
 * "102 (Moguel)" → "102"
 */
function normalizeUnitId(unitLabel) {
  if (!unitLabel) return null;
  const match = String(unitLabel).match(/^([A-Za-z0-9]+)/);
  return match ? match[1] : unitLabel;
}

/**
 * Parse date from Firestore Timestamp or string
 */
function parseDate(dateValue) {
  if (!dateValue) return null;
  
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  } else if (dateValue instanceof Date) {
    return dateValue;
  } else if (dateValue._seconds) {
    return new Date(dateValue._seconds * 1000);
  }
  
  return null;
}

/**
 * Format date for comparison (YYYY-MM-DD)
 */
function formatDateForComparison(date) {
  if (!date) return '';
  const dt = DateTime.fromJSDate(date).setZone('America/Cancun');
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Find transaction matching unitId, date, and amount
 */
async function findMatchingTransaction(clientId, unitId, date, amount) {
  const dateStr = formatDateForComparison(date);
  
  try {
    // Query special assessment transactions for this client
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    
    const snapshot = await transactionsRef
      .where('categoryId', '==', 'special-assessments')
      .get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  No special assessment transactions found`);
      return null;
    }
    
    // Find matching transaction by unitId (normalized), date (with tolerance), and amount
    for (const doc of snapshot.docs) {
      const txn = doc.data();
      const txnUnitId = normalizeUnitId(txn.unitId || '');
      const txnDate = parseDate(txn.date);
      const txnDateStr = formatDateForComparison(txnDate);
      const txnAmount = txn.amount || 0;
      
      // Normalize both unitIds for comparison
      const normalizedCollectionUnitId = normalizeUnitId(unitId);
      const unitIdMatch = txnUnitId === normalizedCollectionUnitId;
      
      // Date matching with +/- 1 day tolerance (handles timezone issues)
      const collectionTime = date.getTime();
      const txnTime = txnDate.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const dateMatch = Math.abs(collectionTime - txnTime) <= oneDayMs;
      
      // Match by normalized unitId, date (with tolerance), and amount (exact)
      if (unitIdMatch && dateMatch && txnAmount === amount) {
        return {
          id: doc.id,
          date: txn.date,
          amount: txn.amount,
          notes: txn.notes || '',
          categoryId: txn.categoryId,
          unitId: txn.unitId
        };
      }
    }
    
    console.log(`   ⚠️  No matching transaction found for ${unitId} on ${dateStr} amount ${amount}`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error searching transactions:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function fixProjectTransactionIds() {
  console.log(`📊 Processing projects for ${CLIENT_ID}...\n`);
  
  const projectsRef = db.collection('clients').doc(CLIENT_ID).collection('projects');
  const projectsSnapshot = await projectsRef.get();
  
  if (projectsSnapshot.empty) {
    console.log('❌ No projects found');
    return;
  }
  
  let totalProjects = 0;
  let totalCollections = 0;
  let fixedCollections = 0;
  let missingTransactions = 0;
  
  for (const projectDoc of projectsSnapshot.docs) {
    const project = projectDoc.data();
    const projectId = projectDoc.id;
    const collections = project.collections || [];
    
    if (collections.length === 0) continue;
    
    totalProjects++;
    console.log(`\n📁 Project: ${project.name || projectId}`);
    console.log(`   Collections: ${collections.length}`);
    
    let projectUpdated = false;
    const updatedCollections = [];
    
    for (const collection of collections) {
      totalCollections++;
      const oldTxnId = collection.transactionId;
      const unitId = collection.unitId;
      const collectionDate = parseDate(collection.date);
      const amount = collection.amount || 0;
      
      console.log(`\n   📄 Collection: ${unitId} - ${formatDateForComparison(collectionDate)} - $${(amount/100).toFixed(2)}`);
      console.log(`      Old TxnId: ${oldTxnId}`);
      
      // Try to find matching transaction
      const matchingTxn = await findMatchingTransaction(CLIENT_ID, unitId, collectionDate, amount);
      
      if (matchingTxn) {
        if (matchingTxn.id !== oldTxnId) {
          console.log(`      ✅ Found match: ${matchingTxn.id}`);
          console.log(`      Notes: "${matchingTxn.notes}"`);
          
          updatedCollections.push({
            ...collection,
            transactionId: matchingTxn.id
          });
          
          projectUpdated = true;
          fixedCollections++;
        } else {
          console.log(`      ✓ Already correct`);
          updatedCollections.push(collection);
        }
      } else {
        console.log(`      ❌ No matching transaction found`);
        updatedCollections.push(collection); // Keep as-is
        missingTransactions++;
      }
    }
    
    // Update project document if changes were made
    if (projectUpdated) {
      if (DRY_RUN) {
        console.log(`\n   🔍 DRY RUN: Would update project ${projectId}`);
      } else {
        console.log(`\n   💾 Updating project ${projectId}...`);
        await projectsRef.doc(projectId).update({
          collections: updatedCollections
        });
        console.log(`   ✅ Project updated`);
      }
    }
  }
  
  console.log('\n==========================================');
  console.log('📊 Summary');
  console.log('==========================================');
  console.log(`Projects processed: ${totalProjects}`);
  console.log(`Collections processed: ${totalCollections}`);
  console.log(`Collections fixed: ${fixedCollections}`);
  console.log(`Missing transactions: ${missingTransactions}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes made)' : 'LIVE (changes committed)'}`);
  console.log('==========================================\n');
  
  if (DRY_RUN && fixedCollections > 0) {
    console.log('💡 Run with --execute flag to apply changes');
  }
}

// Run
try {
  await fixProjectTransactionIds();
  process.exit(0);
} catch (error) {
  console.error('❌ Script failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
