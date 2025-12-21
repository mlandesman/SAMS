/**
 * Fix Project Collection Transaction IDs
 * 
 * Problem: Project collections have incorrect transactionIds from import/cleanup
 * Solution: Match transactions by unitId, date, and amount to find correct transactionId
 * 
 * Usage: 
 *   DEV:  node scripts/fixProjectTransactionIds.js [clientId] [--dry-run]
 *   PROD: FIREBASE_ENV=prod node scripts/fixProjectTransactionIds.js [clientId] [--dry-run]
 * 
 * Environment Detection:
 *   - FIREBASE_ENV=prod: Uses serviceAccountKey-prod.json (production database)
 *   - FIREBASE_ENV=staging: Uses serviceAccountKey-staging.json (staging database)
 *   - Default: Uses serviceAccountKey-dev.json (dev database)
 */

import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DRY_RUN = process.argv.includes('--dry-run');
const CLIENT_ID = process.argv[2]?.replace('--dry-run', '').trim() || 'MTC';

// Initialize Firebase independently (don't modify core firebase.js)
async function initializeScriptFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }
  
  const env = process.env.FIREBASE_ENV || 'dev';
  
  console.log(`🌍 Target Environment: ${env.toUpperCase()}`);
  
  // For production, use ADC if available (most secure)
  if ((env === 'prod' || env === 'production') && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('🔑 Using Application Default Credentials (ADC)');
    admin.initializeApp();
    const db = admin.firestore();
    const projectId = process.env.GCLOUD_PROJECT || (await db.collection('_meta').limit(1).get()).query.firestore.projectId;
    console.log(`📁 Firebase Project: ${projectId}\n`);
    return db;
  }
  
  // Otherwise use service account key
  const getServiceAccountPath = () => {
    if (env === 'prod' || env === 'production') {
      return '../serviceAccountKey-prod.json';
    } else if (env === 'staging') {
      return '../serviceAccountKey-staging.json';
    }
    return '../serviceAccountKey-dev.json';
  };
  
  const serviceAccountPath = getServiceAccountPath();
  const serviceAccount = require(serviceAccountPath);
  console.log(`🔑 Service Account: ${serviceAccountPath}`);
  console.log(`📁 Firebase Project: ${serviceAccount.project_id}\n`);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  return admin.firestore();
}

const getDb = initializeScriptFirebase;

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

console.log('🔧 Fix Project Collection Transaction IDs');
console.log('==========================================');
console.log(`Client: ${CLIENT_ID}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update Firestore)'}`);
console.log('');

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
async function findMatchingTransaction(db, clientId, unitId, date, amount) {
  const dateStr = formatDateForComparison(date);
  
  try {
    // Query transactions for this client
    // Note: Can't filter by unitId in query because format varies ("1C" vs "1C (Owner)")
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    
    // Get all transactions - we'll filter by unitId, date, and amount in memory
    // This is necessary because unitId format varies (e.g., "1C" vs "1C (Eifler)")
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
      
      // Normalize both unitIds for comparison (handles "1C" vs "1C (Eifler)" formats)
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
          unitId: txnUnitId
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
  const db = await getDb();
  
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
      const matchingTxn = await findMatchingTransaction(db, CLIENT_ID, unitId, collectionDate, amount);
      
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
    console.log('💡 Run without --dry-run to apply changes');
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

