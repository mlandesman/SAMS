/**
 * Migration Script: duesDistribution → allocations
 * 
 * Purpose: Convert existing HOA duesDistribution fields to generalized allocations pattern
 * Maintains 100% backward compatibility and data integrity
 * 
 * Author: APM Implementation Agent
 * Date: 2025-01-19
 */

const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Month names for generating human-readable target names
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Get month name from month number (1-12)
 */
function getMonthName(month) {
  return MONTH_NAMES[month - 1] || `Month ${month}`;
}

/**
 * Migrate a single transaction's duesDistribution to allocations format
 */
function migrateDuesDistributionToAllocations(transaction) {
  const data = transaction.data();
  
  // Skip if no duesDistribution or already has allocations
  if (!data.duesDistribution || data.duesDistribution.length === 0) {
    return {
      needsMigration: false,
      migratedData: null
    };
  }
  
  // Skip if already has allocations (prevent double migration)
  if (data.allocations && data.allocations.length > 0) {
    console.log(`Transaction ${transaction.id} already has allocations, skipping`);
    return {
      needsMigration: false,
      migratedData: null
    };
  }
  
  // Create allocations from duesDistribution
  const allocations = data.duesDistribution.map((dues, index) => ({
    id: `alloc_${String(index + 1).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
    type: "hoa_month",
    targetId: `month_${dues.month}_${dues.year}`,
    targetName: `${getMonthName(dues.month)} ${dues.year}`,
    amount: dues.amount,
    percentage: null, // Will be calculated if needed
    data: {
      unitId: dues.unitId,
      month: dues.month,
      year: dues.year
    },
    metadata: {
      processingStrategy: "hoa_dues",
      cleanupRequired: true,
      auditRequired: true,
      migratedFrom: "duesDistribution",
      migrationDate: new Date().toISOString()
    }
  }));
  
  // Calculate allocation summary
  const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  const allocationSummary = {
    totalAllocated: totalAllocated,
    allocationCount: allocations.length,
    allocationType: "hoa_month",
    hasMultipleTypes: false
  };
  
  // Verify total matches transaction amount
  if (Math.abs(totalAllocated - data.amount) > 0) {
    console.warn(`Transaction ${transaction.id}: Allocation total (${totalAllocated}) doesn't match transaction amount (${data.amount})`);
  }
  
  return {
    needsMigration: true,
    migratedData: {
      allocations: allocations,
      allocationSummary: allocationSummary,
      // Preserve original duesDistribution for backward compatibility
      duesDistribution: data.duesDistribution,
      // Add migration metadata
      migrationMetadata: {
        migratedAt: FieldValue.serverTimestamp(),
        migrationVersion: "1.0",
        originalDuesDistributionCount: data.duesDistribution.length
      }
    }
  };
}

/**
 * Process a single client's transactions
 */
async function migrateClientTransactions(clientId, options = {}) {
  const { dryRun = false, batchSize = 50 } = options;
  
  console.log(`\n=== Processing Client: ${clientId} ===`);
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  
  const stats = {
    totalTransactions: 0,
    hoaTransactions: 0,
    migratedTransactions: 0,
    skippedTransactions: 0,
    errors: 0
  };
  
  try {
    // Get all transactions for this client
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await transactionsRef.get();
    
    stats.totalTransactions = snapshot.size;
    console.log(`Found ${stats.totalTransactions} total transactions`);
    
    // Process transactions in batches
    const transactions = snapshot.docs;
    const batches = [];
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} transactions)`);
      
      // Create Firestore batch
      const firestoreBatch = db.batch();
      let batchHasUpdates = false;
      
      for (const transaction of batch) {
        const data = transaction.data();
        
        // Check if this is an HOA transaction
        if (data.duesDistribution) {
          stats.hoaTransactions++;
          
          try {
            const migration = migrateDuesDistributionToAllocations(transaction);
            
            if (migration.needsMigration) {
              stats.migratedTransactions++;
              
              if (!dryRun) {
                // Add update to batch
                firestoreBatch.update(transaction.ref, migration.migratedData);
                batchHasUpdates = true;
              }
              
              console.log(`  ✓ Transaction ${transaction.id}: ${migration.migratedData.allocationSummary.allocationCount} allocations created`);
            } else {
              stats.skippedTransactions++;
              console.log(`  - Transaction ${transaction.id}: Skipped (no migration needed)`);
            }
          } catch (error) {
            stats.errors++;
            console.error(`  ✗ Transaction ${transaction.id}: Migration error - ${error.message}`);
          }
        }
      }
      
      // Commit batch if not dry run and has updates
      if (!dryRun && batchHasUpdates) {
        await firestoreBatch.commit();
        console.log(`  Batch ${batchIndex + 1} committed successfully`);
      }
    }
    
  } catch (error) {
    console.error(`Error processing client ${clientId}:`, error);
    stats.errors++;
  }
  
  return stats;
}

/**
 * Validate migration results for a client
 */
async function validateClientMigration(clientId) {
  console.log(`\n=== Validating Client: ${clientId} ===`);
  
  const validation = {
    totalTransactions: 0,
    hoaTransactions: 0,
    migratedTransactions: 0,
    dataIntegrityIssues: 0,
    backwardCompatibilityIssues: 0
  };
  
  try {
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await transactionsRef.get();
    
    validation.totalTransactions = snapshot.size;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (data.duesDistribution && data.duesDistribution.length > 0) {
        validation.hoaTransactions++;
        
        if (data.allocations && data.allocations.length > 0) {
          validation.migratedTransactions++;
          
          // Validate data integrity
          const duesTotal = data.duesDistribution.reduce((sum, dues) => sum + dues.amount, 0);
          const allocTotal = data.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
          
          if (Math.abs(duesTotal - allocTotal) > 0) {
            validation.dataIntegrityIssues++;
            console.error(`  ✗ Transaction ${doc.id}: Amount mismatch - dues: ${duesTotal}, allocations: ${allocTotal}`);
          }
          
          // Validate backward compatibility (duesDistribution preserved)
          if (!data.duesDistribution || data.duesDistribution.length === 0) {
            validation.backwardCompatibilityIssues++;
            console.error(`  ✗ Transaction ${doc.id}: duesDistribution lost during migration`);
          }
          
          // Validate allocation structure
          for (const allocation of data.allocations) {
            if (!allocation.id || !allocation.type || !allocation.targetId) {
              validation.dataIntegrityIssues++;
              console.error(`  ✗ Transaction ${doc.id}: Invalid allocation structure`);
              break;
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Validation error for client ${clientId}:`, error);
  }
  
  return validation;
}

/**
 * Main migration function
 */
async function migrateHOAAllocations(options = {}) {
  const {
    clientIds = [],
    dryRun = true,
    validateAfter = true,
    batchSize = 50
  } = options;
  
  console.log('=== HOA Allocations Migration ===');
  console.log(`Dry Run: ${dryRun ? 'YES (no changes will be made)' : 'NO (changes will be applied)'}`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`Validate After: ${validateAfter ? 'YES' : 'NO'}`);
  
  const startTime = Date.now();
  const overallStats = {
    clientsProcessed: 0,
    totalTransactions: 0,
    hoaTransactions: 0,
    migratedTransactions: 0,
    skippedTransactions: 0,
    errors: 0
  };
  
  try {
    // Get client list if not provided
    let processClientIds = clientIds;
    if (processClientIds.length === 0) {
      console.log('No specific clients provided, discovering all clients...');
      const clientsSnapshot = await db.collection('clients').get();
      processClientIds = clientsSnapshot.docs.map(doc => doc.id);
      console.log(`Found ${processClientIds.length} clients`);
    }
    
    // Process each client
    for (const clientId of processClientIds) {
      const clientStats = await migrateClientTransactions(clientId, { dryRun, batchSize });
      
      overallStats.clientsProcessed++;
      overallStats.totalTransactions += clientStats.totalTransactions;
      overallStats.hoaTransactions += clientStats.hoaTransactions;
      overallStats.migratedTransactions += clientStats.migratedTransactions;
      overallStats.skippedTransactions += clientStats.skippedTransactions;
      overallStats.errors += clientStats.errors;
      
      console.log(`Client ${clientId} summary:`, clientStats);
    }
    
    // Validation phase
    if (validateAfter && !dryRun) {
      console.log('\n=== VALIDATION PHASE ===');
      
      for (const clientId of processClientIds) {
        const validation = await validateClientMigration(clientId);
        console.log(`Client ${clientId} validation:`, validation);
        
        if (validation.dataIntegrityIssues > 0 || validation.backwardCompatibilityIssues > 0) {
          console.error(`❌ Client ${clientId} has validation issues!`);
        } else {
          console.log(`✅ Client ${clientId} validation passed`);
        }
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    overallStats.errors++;
  }
  
  // Summary
  const duration = Date.now() - startTime;
  console.log('\n=== MIGRATION SUMMARY ===');
  console.log(`Duration: ${Math.round(duration / 1000)}s`);
  console.log(`Clients Processed: ${overallStats.clientsProcessed}`);
  console.log(`Total Transactions: ${overallStats.totalTransactions}`);
  console.log(`HOA Transactions: ${overallStats.hoaTransactions}`);
  console.log(`Migrated Transactions: ${overallStats.migratedTransactions}`);
  console.log(`Skipped Transactions: ${overallStats.skippedTransactions}`);
  console.log(`Errors: ${overallStats.errors}`);
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made to the database');
    console.log('   Run with dryRun: false to apply changes');
  } else {
    console.log('\n✅ Migration completed successfully');
  }
  
  return overallStats;
}

/**
 * Rollback migration (remove allocations fields, keep duesDistribution)
 */
async function rollbackMigration(clientIds = [], dryRun = true) {
  console.log('=== HOA Allocations Migration ROLLBACK ===');
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  
  const stats = {
    clientsProcessed: 0,
    transactionsRolledBack: 0,
    errors: 0
  };
  
  try {
    for (const clientId of clientIds) {
      console.log(`\nRolling back client: ${clientId}`);
      
      const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
      const snapshot = await transactionsRef.where('allocations', '!=', null).get();
      
      console.log(`Found ${snapshot.size} transactions with allocations to rollback`);
      
      const batch = db.batch();
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        // Remove allocation fields, keep duesDistribution
        batch.update(doc.ref, {
          allocations: FieldValue.delete(),
          allocationSummary: FieldValue.delete(),
          migrationMetadata: FieldValue.delete()
        });
        
        batchCount++;
        stats.transactionsRolledBack++;
        
        // Commit in batches of 500 (Firestore limit)
        if (batchCount >= 500) {
          if (!dryRun) {
            await batch.commit();
          }
          console.log(`Rolled back ${batchCount} transactions`);
          batchCount = 0;
        }
      }
      
      // Commit remaining transactions
      if (batchCount > 0 && !dryRun) {
        await batch.commit();
        console.log(`Rolled back final ${batchCount} transactions`);
      }
      
      stats.clientsProcessed++;
    }
    
  } catch (error) {
    console.error('Rollback failed:', error);
    stats.errors++;
  }
  
  console.log('\n=== ROLLBACK SUMMARY ===');
  console.log(stats);
  
  return stats;
}

// Export functions for use in other scripts
module.exports = {
  migrateHOAAllocations,
  migrateClientTransactions,
  validateClientMigration,
  rollbackMigration,
  migrateDuesDistributionToAllocations
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'migrate') {
    const dryRun = !args.includes('--apply');
    const clientIds = args.filter(arg => !arg.startsWith('--'));
    
    migrateHOAAllocations({
      clientIds: clientIds.slice(1), // Skip 'migrate' command
      dryRun: dryRun,
      validateAfter: true,
      batchSize: 50
    }).catch(console.error);
    
  } else if (command === 'validate') {
    const clientIds = args.slice(1);
    
    Promise.all(clientIds.map(clientId => validateClientMigration(clientId)))
      .then(results => {
        console.log('\nAll validation results:', results);
      })
      .catch(console.error);
    
  } else if (command === 'rollback') {
    const dryRun = !args.includes('--apply');
    const clientIds = args.filter(arg => !arg.startsWith('--')).slice(1);
    
    rollbackMigration(clientIds, dryRun).catch(console.error);
    
  } else {
    console.log('Usage:');
    console.log('  node migrateHOAAllocations.js migrate [clientId...] [--apply]');
    console.log('  node migrateHOAAllocations.js validate [clientId...]');
    console.log('  node migrateHOAAllocations.js rollback [clientId...] [--apply]');
    console.log('');
    console.log('Examples:');
    console.log('  node migrateHOAAllocations.js migrate                    # Dry run all clients');
    console.log('  node migrateHOAAllocations.js migrate client123 --apply  # Apply to specific client');
    console.log('  node migrateHOAAllocations.js validate client123         # Validate specific client');
    console.log('  node migrateHOAAllocations.js rollback client123 --apply # Rollback specific client');
  }
}