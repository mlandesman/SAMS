/**
 * Fix Credit History Entries Script
 * 
 * Fixes malformed credit history entries that:
 * 1. Are missing the `type` field (infer from amount: positive = credit_added, negative = credit_used)
 * 2. Have `balance` field instead of `balanceBefore`/`balanceAfter` (remove stale field)
 * 3. Have `note` instead of `notes` (fix field name)
 * 
 * Usage:
 *   # Dev (default)
 *   node scripts/fix-credit-history-entries.js
 *   
 *   # Production (requires ADC)
 *   FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-credit-history-entries.js
 *   
 *   # Dry run (show what would change without writing)
 *   node scripts/fix-credit-history-entries.js --dry-run
 * 
 * Created: 2025-12-23
 * Purpose: Fix UPS credit history bug (GitHub Issue #99)
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const ENV = process.env.FIRESTORE_ENV || 'dev';
const USE_ADC = process.env.USE_ADC === 'true';

// Project IDs
const PROJECT_IDS = {
  dev: 'sams-sandyland-dev',
  prod: 'sams-sandyland-prod'
};

console.log('='.repeat(60));
console.log('Credit History Entry Fix Script');
console.log('='.repeat(60));
console.log(`Environment: ${ENV.toUpperCase()}`);
console.log(`Project: ${PROJECT_IDS[ENV]}`);
console.log(`Dry Run: ${DRY_RUN ? 'YES (no changes will be made)' : 'NO (will write changes)'}`);
console.log('='.repeat(60));

// Initialize Firebase
let app;
if (USE_ADC) {
  console.log('Using Application Default Credentials...');
  app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_IDS[ENV]
  });
} else {
  const keyPath = join(__dirname, '..', 'functions', 'backend', 'config', 
    ENV === 'prod' ? 'sams-sandyland-prod-firebase-adminsdk.json' : 'sams-sandyland-dev-firebase-adminsdk.json');
  
  if (!existsSync(keyPath)) {
    console.error(`Service account key not found: ${keyPath}`);
    console.error('For production, use: FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-credit-history-entries.js');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: PROJECT_IDS[ENV]
  });
}

const db = getFirestore(app);

/**
 * Calculate balance from history up to a given index
 */
function calculateBalanceAtIndex(history, targetIndex) {
  let balance = 0;
  for (let i = 0; i <= targetIndex; i++) {
    if (i < history.length) {
      balance += history[i].amount || 0;
    }
  }
  return balance;
}

/**
 * Check if an entry needs fixing
 */
function entryNeedsFix(entry, index) {
  // Skip index 0 (starting_balance entries from import)
  if (index === 0) return false;
  
  const issues = [];
  
  // Check for missing type
  if (!entry.type) {
    issues.push('missing type');
  }
  
  // Check for stale 'balance' field (should not exist)
  if (entry.hasOwnProperty('balance')) {
    issues.push('has stale balance field');
  }
  
  // Check for 'note' instead of 'notes'
  if (entry.hasOwnProperty('note') && !entry.hasOwnProperty('notes')) {
    issues.push('has note instead of notes');
  }
  
  return issues.length > 0 ? issues : null;
}

/**
 * Fix an entry
 */
function fixEntry(entry, index, history) {
  const fixed = { ...entry };
  const changes = [];
  
  // 1. Add type if missing (infer from amount)
  if (!fixed.type) {
    fixed.type = fixed.amount >= 0 ? 'credit_added' : 'credit_used';
    changes.push(`Added type: ${fixed.type}`);
  }
  
  // 2. Remove stale 'balance' field
  if (fixed.hasOwnProperty('balance')) {
    delete fixed.balance;
    changes.push('Removed stale balance field');
  }
  
  // 3. Fix 'note' → 'notes'
  if (fixed.hasOwnProperty('note') && !fixed.hasOwnProperty('notes')) {
    fixed.notes = fixed.note;
    delete fixed.note;
    changes.push('Renamed note → notes');
  }
  
  // 4. Add balanceBefore/balanceAfter if missing (calculate from history)
  if (!fixed.hasOwnProperty('balanceBefore')) {
    fixed.balanceBefore = calculateBalanceAtIndex(history, index - 1);
    changes.push(`Added balanceBefore: ${fixed.balanceBefore}`);
  }
  
  if (!fixed.hasOwnProperty('balanceAfter')) {
    fixed.balanceAfter = calculateBalanceAtIndex(history, index);
    changes.push(`Added balanceAfter: ${fixed.balanceAfter}`);
  }
  
  // 5. Add description if missing
  if (!fixed.hasOwnProperty('description')) {
    if (fixed.type === 'credit_added') {
      fixed.description = 'from Overpayment';
    } else if (fixed.type === 'credit_used') {
      fixed.description = 'from Credit Balance Usage';
    }
    changes.push(`Added description: ${fixed.description}`);
  }
  
  return { fixed, changes };
}

/**
 * Process all credit balances for a client
 */
async function processClient(clientId) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Processing client: ${clientId}`);
  console.log('─'.repeat(50));
  
  const creditBalancesRef = db.collection('clients').doc(clientId)
    .collection('units').doc('creditBalances');
  
  const doc = await creditBalancesRef.get();
  
  if (!doc.exists) {
    console.log(`  No creditBalances document found for ${clientId}`);
    return { fixed: 0, units: [] };
  }
  
  const data = doc.data();
  const unitIds = Object.keys(data).filter(k => k !== '_id');
  
  console.log(`  Found ${unitIds.length} units with credit data`);
  
  let totalFixed = 0;
  const fixedUnits = [];
  const updatedData = { ...data };
  
  for (const unitId of unitIds) {
    const unitData = data[unitId];
    const history = unitData.history || [];
    
    if (history.length === 0) continue;
    
    let unitFixedCount = 0;
    const fixedHistory = [...history];
    
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const issues = entryNeedsFix(entry, i);
      
      if (issues) {
        console.log(`\n  Unit ${unitId}, Entry ${i}:`);
        console.log(`    Issues: ${issues.join(', ')}`);
        console.log(`    Original: ${JSON.stringify(entry, null, 2).split('\n').join('\n    ')}`);
        
        const { fixed, changes } = fixEntry(entry, i, history);
        
        console.log(`    Changes:`);
        changes.forEach(c => console.log(`      - ${c}`));
        console.log(`    Fixed: ${JSON.stringify(fixed, null, 2).split('\n').join('\n    ')}`);
        
        fixedHistory[i] = fixed;
        unitFixedCount++;
        totalFixed++;
      }
    }
    
    if (unitFixedCount > 0) {
      fixedUnits.push({ unitId, count: unitFixedCount });
      updatedData[unitId] = {
        ...unitData,
        history: fixedHistory
      };
    }
  }
  
  // Write changes if not dry run
  if (totalFixed > 0 && !DRY_RUN) {
    console.log(`\n  Writing ${totalFixed} fixes to Firestore...`);
    await creditBalancesRef.set(updatedData);
    console.log('  ✅ Changes saved');
  } else if (totalFixed > 0) {
    console.log(`\n  [DRY RUN] Would fix ${totalFixed} entries`);
  } else {
    console.log('  ✅ No fixes needed');
  }
  
  return { fixed: totalFixed, units: fixedUnits };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Process both clients
    const clients = ['MTC', 'AVII'];
    let grandTotal = 0;
    const summary = [];
    
    for (const clientId of clients) {
      const result = await processClient(clientId);
      grandTotal += result.fixed;
      if (result.fixed > 0) {
        summary.push({ clientId, ...result });
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    if (grandTotal === 0) {
      console.log('✅ No fixes needed - all entries are correctly formatted');
    } else {
      console.log(`Total entries fixed: ${grandTotal}`);
      summary.forEach(s => {
        console.log(`\n  ${s.clientId}:`);
        s.units.forEach(u => {
          console.log(`    - Unit ${u.unitId}: ${u.count} entries`);
        });
      });
      
      if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN - No changes were made');
        console.log('   Run without --dry-run to apply fixes');
      } else {
        console.log('\n✅ All fixes applied successfully');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

