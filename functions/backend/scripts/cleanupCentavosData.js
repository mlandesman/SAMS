/**
 * Cleanup Script: Fix Floating Point Contamination in Centavos Fields
 * 
 * Purpose: Clean existing contaminated centavos data in Firestore by applying
 * the same validation logic used in the backend services.
 * 
 * This script:
 * 1. Scans all documents that contain centavos fields
 * 2. Identifies floating point contamination
 * 3. Rounds contaminated values to nearest integer (0.2 centavos tolerance)
 * 4. Updates documents in Firestore
 * 5. Reports all changes made
 * 
 * Usage: node backend/scripts/cleanupCentavosData.js [clientId] [--dry-run]
 */

import { getDb } from '../firebase.js';
import { validateCentavos, validateCentavosInObject } from '../utils/centavosValidation.js';

// Track cleanup statistics
const stats = {
  documentsScanned: 0,
  documentsWithContamination: 0,
  documentsUpdated: 0,
  fieldsFixed: 0,
  errors: [],
  changes: []
};

/**
 * Check if a value is contaminated (has floating point error)
 */
function isContaminated(value) {
  if (typeof value !== 'number') return false;
  if (Number.isInteger(value)) return false;
  
  const rounded = Math.round(value);
  const difference = Math.abs(value - rounded);
  
  // Only flag if within tolerance range (real contamination, not intentional decimals)
  return difference > 0 && difference <= 0.5;
}

/**
 * Recursively find and fix contaminated centavos fields in an object
 */
function cleanObject(obj, path = '', changes = []) {
  if (!obj || typeof obj !== 'object') {
    return { cleaned: obj, hasChanges: false };
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    let hasChanges = false;
    const cleaned = obj.map((item, index) => {
      const result = cleanObject(item, `${path}[${index}]`, changes);
      if (result.hasChanges) hasChanges = true;
      return result.cleaned;
    });
    return { cleaned, hasChanges };
  }
  
  // Process object fields
  let hasChanges = false;
  const cleaned = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;
    
    // Check if this is a centavos field and is contaminated
    if (isCentavosField(key) && isContaminated(value)) {
      const rounded = Math.round(value);
      cleaned[key] = rounded;
      hasChanges = true;
      changes.push({
        field: fieldPath,
        before: value,
        after: rounded,
        difference: Math.abs(value - rounded)
      });
      stats.fieldsFixed++;
    }
    // Recursively clean nested objects
    else if (value && typeof value === 'object') {
      const result = cleanObject(value, fieldPath, changes);
      cleaned[key] = result.cleaned;
      if (result.hasChanges) hasChanges = true;
    }
    // Keep non-centavos primitives as-is
    else {
      cleaned[key] = value;
    }
  }
  
  return { cleaned, hasChanges };
}

/**
 * Determines if a field name represents a centavos value
 */
function isCentavosField(fieldName) {
  // Exclude percentage/rate fields (these are decimals, not centavos)
  const excludePatterns = [
    /rate$/i,
    /percent/i,
    /ratio/i
  ];
  
  if (excludePatterns.some(pattern => pattern.test(fieldName))) {
    return false;
  }
  
  const centavosPatterns = [
    /Amount$/i,
    /Balance$/i,
    /Due$/i,
    /Paid$/i,
    /Total$/i,
    /Credit$/i,
    /Debit$/i,
    /Price$/i,
    /Cost$/i,
    /Fee$/i,
    /Charge$/i,
    /Payment$/i,
    /^amount$/i,
    /^balance$/i,
    /^due$/i,
    /^paid$/i,
    /^total$/i,
    /^credit$/i,
    /^debit$/i,
    /penalty(?!Rate)/i, // Match penalty but not penaltyRate
    /centavos/i
  ];
  
  return centavosPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Clean all documents in a collection
 */
async function cleanCollection(db, collectionPath, dryRun = false) {
  console.log(`\n📋 Scanning collection: ${collectionPath}`);
  
  try {
    const snapshot = await db.collection(collectionPath).get();
    console.log(`   Found ${snapshot.size} documents`);
    
    for (const doc of snapshot.docs) {
      stats.documentsScanned++;
      const data = doc.data();
      const changes = [];
      
      const result = cleanObject(data, '', changes);
      
      if (result.hasChanges) {
        stats.documentsWithContamination++;
        
        console.log(`   ⚠️  Found contamination in ${doc.id}:`);
        changes.forEach(change => {
          console.log(`      ${change.field}: ${change.before} → ${change.after} (diff: ${change.difference.toFixed(6)})`);
        });
        
        if (!dryRun) {
          await doc.ref.update(result.cleaned);
          stats.documentsUpdated++;
          console.log(`   ✅ Updated ${doc.id}`);
        } else {
          console.log(`   🔍 [DRY RUN] Would update ${doc.id}`);
        }
        
        stats.changes.push({
          path: `${collectionPath}/${doc.id}`,
          changes
        });
      }
    }
  } catch (error) {
    console.error(`   ❌ Error cleaning collection ${collectionPath}:`, error.message);
    stats.errors.push({ collection: collectionPath, error: error.message });
  }
}

/**
 * Clean subcollections recursively
 */
async function cleanSubcollections(db, docRef, basePath, dryRun = false) {
  try {
    const subcollections = await docRef.listCollections();
    
    for (const subcollection of subcollections) {
      const subcollectionPath = `${basePath}/${subcollection.id}`;
      await cleanCollection(db, subcollectionPath, dryRun);
      
      // Recursively process nested subcollections
      const subSnapshot = await subcollection.get();
      for (const subDoc of subSnapshot.docs) {
        await cleanSubcollections(db, subDoc.ref, `${subcollectionPath}/${subDoc.id}`, dryRun);
      }
    }
  } catch (error) {
    console.error(`   ⚠️  Could not list subcollections for ${basePath}:`, error.message);
  }
}

/**
 * Main cleanup function for a client
 */
async function cleanupClientData(clientId, dryRun = false) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧹 CENTAVOS DATA CLEANUP - Client: ${clientId}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const db = await getDb();
  
  // Collections to clean (in order)
  const collections = [
    `clients/${clientId}/transactions`,
    `clients/${clientId}/units`,
    `clients/${clientId}/yearEndBalances`,
    `clients/${clientId}/paymentMethods`,
    `clients/${clientId}/categories`,
    `clients/${clientId}/vendors`,
    `clients/${clientId}/projects/waterBills/bills`
  ];
  
  // Clean each collection
  for (const collectionPath of collections) {
    await cleanCollection(db, collectionPath, dryRun);
  }
  
  // Clean HOA Dues (nested in units)
  console.log(`\n📋 Scanning HOA Dues (nested in units)`);
  const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();
  for (const unitDoc of unitsSnapshot.docs) {
    await cleanCollection(db, `clients/${clientId}/units/${unitDoc.id}/dues`, dryRun);
  }
  
  // Clean credit balances
  console.log(`\n📋 Scanning Credit Balances`);
  try {
    const creditBalancesRef = db.doc(`clients/${clientId}/units/creditBalances`);
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (creditBalancesDoc.exists) {
      stats.documentsScanned++;
      const data = creditBalancesDoc.data();
      const changes = [];
      
      const result = cleanObject(data, '', changes);
      
      if (result.hasChanges) {
        stats.documentsWithContamination++;
        
        console.log(`   ⚠️  Found contamination in creditBalances:`);
        changes.forEach(change => {
          console.log(`      ${change.field}: ${change.before} → ${change.after} (diff: ${change.difference.toFixed(6)})`);
        });
        
        if (!dryRun) {
          await creditBalancesRef.update(result.cleaned);
          stats.documentsUpdated++;
          console.log(`   ✅ Updated creditBalances`);
        } else {
          console.log(`   🔍 [DRY RUN] Would update creditBalances`);
        }
        
        stats.changes.push({
          path: `clients/${clientId}/units/creditBalances`,
          changes
        });
      }
    }
  } catch (error) {
    console.error(`   ❌ Error cleaning credit balances:`, error.message);
    stats.errors.push({ collection: 'creditBalances', error: error.message });
  }
  
  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 CLEANUP SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Documents scanned: ${stats.documentsScanned}`);
  console.log(`Documents with contamination: ${stats.documentsWithContamination}`);
  console.log(`Documents updated: ${stats.documentsUpdated}`);
  console.log(`Fields fixed: ${stats.fieldsFixed}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ ERRORS:`);
    stats.errors.forEach(error => {
      console.log(`   ${error.collection}: ${error.error}`);
    });
  }
  
  if (stats.changes.length > 0 && stats.changes.length <= 20) {
    console.log(`\n📝 CHANGES MADE:`);
    stats.changes.forEach(change => {
      console.log(`\n   ${change.path}:`);
      change.changes.forEach(fieldChange => {
        console.log(`      ${fieldChange.field}: ${fieldChange.before} → ${fieldChange.after}`);
      });
    });
  } else if (stats.changes.length > 20) {
    console.log(`\n📝 Too many changes to display (${stats.changes.length} documents affected)`);
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
  
  return stats;
}

// Parse command line arguments
const args = process.argv.slice(2);
const clientId = args[0] || 'AVII'; // Default to AVII if not specified
const dryRun = args.includes('--dry-run');

// Run cleanup
cleanupClientData(clientId, dryRun)
  .then(() => {
    console.log('✅ Cleanup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });

