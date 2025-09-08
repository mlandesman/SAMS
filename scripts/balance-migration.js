/**
 * balance-migration.js
 * Command line tool to migrate from monthly balances to the new account-based balance system
 * 
 * This tool handles:
 * 1. Creating standard "Cash" and "CiBanco" accounts for a client
 * 2. Rebuilding account balances from transaction history
 * 3. Creating a year-end snapshot for historical reference
 * 4. Removing old monthly balance documents
 * 
 * Usage: 
 *   node balance-migration.js <clientId> --full
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';
import { createYearEndSnapshot, rebuildBalances } from '../backend/controllers/accountsController.js';

// Initialize Firebase
await initializeFirebase();
const db = await getDb();

/**
 * Create accounts array for a client with standard "Cash" and "CiBanco" accounts
 */
async function createDummyAccounts(clientId) {
  try {
    // Get the client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return false;
    }
    
    // Get current balances if available
    const balanceRef = db.doc(`clients/${clientId}/balances/current`);
    const balanceDoc = await balanceRef.get();
    
    let balances = [];
    if (balanceDoc.exists) {
      balances = balanceDoc.data().values || [];
    }
    
    // Create accounts array with standard Cash and CiBanco accounts
    const accounts = [
      {
        name: "Cash",
        type: "cash",
        currency: "MXN",
        balance: balances.length > 0 ? balances[0] : 0,
        updated: new Date()
      },
      {
        name: "CiBanco",
        type: "bank",
        currency: "MXN",
        balance: balances.length > 1 ? balances[1] : 0,
        updated: new Date()
      }
    ];
    
    // Update client document with accounts
    await clientRef.update({ accounts });
    
    console.log(`✅ Created standard accounts for client ${clientId}:`);
    console.log(accounts);
    
    return true;
  } catch (error) {
    console.error(`❌ Error creating dummy accounts for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Rebuild account balances from transactions
 */
async function rebuildAccountBalances(clientId) {
  try {
    console.log(`🔄 Rebuilding account balances for client ${clientId}...`);
    
    // Call the rebuildBalances function from accountsController
    const updatedAccounts = await rebuildBalances(clientId);
    
    console.log(`✅ Successfully rebuilt account balances for client ${clientId}:`);
    console.log(updatedAccounts);
    
    return true;
  } catch (error) {
    console.error(`❌ Error rebuilding account balances for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Delete all monthend balance documents
 */
async function deleteMonthendBalances(clientId) {
  try {
    const balancesRef = db.collection(`clients/${clientId}/balances`);
    const snapshot = await balancesRef.get();
    
    if (snapshot.empty) {
      console.log(`No monthly balance records found for client ${clientId}`);
      return true;
    }
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      // Skip 'current' document - it might be used elsewhere
      if (doc.id !== 'current') {
        batch.delete(doc.ref);
        count++;
      }
    });
    
    await batch.commit();
    
    console.log(`✅ Deleted ${count} monthly balance records for client ${clientId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting monthend balances for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Create a dummy year-end snapshot for 2024
 */
async function createDummyYearEndSnapshot(clientId) {
  try {
    // Create year-end snapshot based on current accounts
    const snapshot = await createYearEndSnapshot(clientId, '2024');
    
    console.log(`✅ Created dummy 2024 year-end snapshot for client ${clientId}`);
    console.log(snapshot);
    
    return true;
  } catch (error) {
    console.error(`❌ Error creating dummy year-end snapshot for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Balance Migration Tool

Usage:
  node balance-migration.js <clientId> [options]

Options:
  --accounts      Create dummy accounts array
  --year-end      Create a dummy 2024 year-end snapshot
  --delete-month  Delete all monthly balance records
  --rebuild       Rebuild account balances from transactions
  --all           Perform all operations (--accounts --year-end --delete-month)
  --full          Perform complete migration including rebuild (--all --rebuild)
  --help          Show this help message

Example:
  node balance-migration.js MTC --full
`);
    process.exit(0);
  }
  
  const clientId = args[0];
  
  const createAccounts = args.includes('--accounts') || args.includes('--all') || args.includes('--full');
  const createYearEnd = args.includes('--year-end') || args.includes('--all') || args.includes('--full');
  const deleteMonth = args.includes('--delete-month') || args.includes('--all') || args.includes('--full');
  const rebuildBalance = args.includes('--rebuild') || args.includes('--full');
  
  // Execute requested operations
  if (createAccounts) {
    await createDummyAccounts(clientId);
  }
  
  if (rebuildBalance) {
    await rebuildAccountBalances(clientId);
  }
  
  if (createYearEnd) {
    await createDummyYearEndSnapshot(clientId);
  }
  
  if (deleteMonth) {
    await deleteMonthendBalances(clientId);
  }
  
  console.log('✅ Migration completed');
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
