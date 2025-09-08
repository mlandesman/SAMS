/**
 * account-id-migration.js
 * Migrates the account system to use stable IDs and updates transactions
 * 
 * This script:
 * 1. Adds stable IDs to existing accounts
 * 2. Updates all transactions to use accountId instead of account name or accountType
 * 3. Ensures HOA dues payments link to the correct transactions
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';
import { rebuildBalances } from '../backend/controllers/accountsController.js';

// Initialize Firebase
await initializeFirebase();
const db = await getDb();

// Standard account mapping
const ACCOUNT_MAPPING = {
  // Old value (accountType) -> new accountId
  'Cash': 'cash-001',
  'Bank': 'bank-cibanco-001' 
};

// Account name mapping
const ACCOUNT_NAMES = {
  'cash-001': 'Cash',
  'bank-cibanco-001': 'CiBanco'
};

/**
 * Migrate existing accounts to use stable IDs
 */
async function migrateAccountsToIds(clientId, initialBalances = {}) {
  try {
    console.log(`🔄 Migrating accounts for client ${clientId} to use stable IDs...`);
    
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return false;
    }
    
    const currentData = clientDoc.data();
    let accounts = currentData.accounts || [];
    
    // Check if accounts already have IDs
    if (accounts.length > 0 && accounts[0].id) {
      console.log('✅ Accounts already have IDs. Skipping account structure migration.');
    } else {
      // Create new accounts array with IDs
      const newAccounts = [];
      
      // Handle Cash account
      const cashAccount = accounts.find(acc => acc.name === 'Cash') || {
        name: 'Cash',
        type: 'cash',
        currency: 'MXN',
        balance: initialBalances['cash-001'] || 0,
        updated: new Date()
      };
      
      newAccounts.push({
        ...cashAccount,
        id: 'cash-001',
        active: true,
        created: cashAccount.created || new Date(),
        updated: new Date()
      });
      
      // Handle CiBanco account
      const bankAccount = accounts.find(acc => acc.name === 'CiBanco') || {
        name: 'CiBanco',
        type: 'bank',
        currency: 'MXN',
        balance: initialBalances['bank-cibanco-001'] || 0,
        updated: new Date()
      };
      
      newAccounts.push({
        ...bankAccount,
        id: 'bank-cibanco-001',
        active: true,
        created: bankAccount.created || new Date(),
        updated: new Date()
      });
      
      // Update client with new accounts structure
      await clientRef.update({ accounts: newAccounts });
      accounts = newAccounts;
      
      console.log(`✅ Updated accounts structure with stable IDs for client ${clientId}:`);
      console.log(accounts);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error migrating accounts for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Update transaction records to use accountId instead of account name or accountType
 */
async function updateTransactionAccountIds(clientId) {
  try {
    console.log(`🔄 Updating transaction records for client ${clientId} to use accountId...`);
    
    const txnRef = db.collection(`clients/${clientId}/transactions`);
    const snapshot = await txnRef.get();
    
    if (snapshot.empty) {
      console.log(`No transactions found for client ${clientId}`);
      return true;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    let batches = [];
    let currentBatch = db.batch();
    let operationsInBatch = 0;
    
    // Process transactions in batches to avoid hitting Firestore limits
    for (const doc of snapshot.docs) {
      const transaction = doc.data();
      let needsUpdate = false;
      let updates = {};
      
      // Check if transaction needs accountId update
      if (!transaction.accountId) {
        // Try to derive accountId from account name
        if (transaction.account) {
          const matchedAccountId = Object.entries(ACCOUNT_NAMES)
            .find(([_, name]) => name === transaction.account)?.[0];
            
          if (matchedAccountId) {
            updates.accountId = matchedAccountId;
            needsUpdate = true;
          }
        } 
        // Try to derive accountId from accountType
        else if (transaction.accountType) {
          const matchedAccountId = ACCOUNT_MAPPING[transaction.accountType];
          
          if (matchedAccountId) {
            updates.accountId = matchedAccountId;
            // Also set the account field for backward compatibility
            updates.account = ACCOUNT_NAMES[matchedAccountId];
            needsUpdate = true;
          }
        }
      }
      
      // Update the transaction if needed
      if (needsUpdate) {
        currentBatch.update(doc.ref, updates);
        operationsInBatch++;
        updatedCount++;
        
        // Commit batch when it reaches the limit
        if (operationsInBatch >= 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationsInBatch = 0;
        }
      } else {
        skippedCount++;
      }
    }
    
    // Add the final batch if it has operations
    if (operationsInBatch > 0) {
      batches.push(currentBatch);
    }
    
    // Commit all batches
    console.log(`Committing ${batches.length} batches...`);
    for (let i = 0; i < batches.length; i++) {
      console.log(`Committing batch ${i + 1}/${batches.length}...`);
      await batches[i].commit();
    }
    
    console.log(`✅ Updated ${updatedCount} transactions with accountId`);
    console.log(`⏩ Skipped ${skippedCount} transactions that already had correct data`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating transaction accountIds for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Rebuild account balances after migration
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
 * Update HOA dues records to link to transaction IDs where possible
 * This uses notes field matching and sequence numbers to find related transactions
 */
async function updateHoaDuesTransactionLinks(clientId) {
  try {
    console.log(`🔄 Updating HOA dues transaction links for client ${clientId}...`);
    
    // Get all HOA dues records
    const duesRef = db.collection(`clients/${clientId}/hoaDues`);
    const duesSnapshot = await duesRef.get();
    
    if (duesSnapshot.empty) {
      console.log(`No HOA dues records found for client ${clientId}`);
      return true;
    }
    
    // Get HOA dues transactions from 2025
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31T23:59:59');
    
    const txnRef = db.collection(`clients/${clientId}/transactions`)
      .where('category', '==', 'HOA Dues')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate);
    
    console.log('Fetching 2025 HOA Dues transactions...');
    const txnSnapshot = await txnRef.get();
    
    if (txnSnapshot.empty) {
      console.log(`No transactions found for client ${clientId}`);
      return true;
    }
    
    // Build transaction lookup tables for better matching
    const transactionsByDate = {};
    const transactionsByUnit = {};
    const transactionsBySequence = {};
    const allTransactions = [];
    
    console.log(`Found ${txnSnapshot.size} HOA Dues transactions from 2025`);
    
    txnSnapshot.forEach(doc => {
      const tx = doc.data();
      const txWithId = { id: doc.id, ...tx };
      allTransactions.push(txWithId);
      
      // Index by date
      const dateKey = tx.date?.toDate().toISOString().split('T')[0] || 'unknown';
      if (!transactionsByDate[dateKey]) {
        transactionsByDate[dateKey] = [];
      }
      transactionsByDate[dateKey].push(txWithId);
      
      // Index by unit if available
      if (tx.unit) {
        const unitKey = tx.unit.toString().trim();
        if (!transactionsByUnit[unitKey]) {
          transactionsByUnit[unitKey] = [];
        }
        transactionsByUnit[unitKey].push(txWithId);
      }
      
      // Index by sequence number if available
      if (tx.nSeq) {
        transactionsBySequence[tx.nSeq] = txWithId;
      }
    });
    
    // Process HOA dues records
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let batch = db.batch();
    let operationsInBatch = 0;
    
    for (const doc of duesSnapshot.docs) {
      const dues = doc.data();
      let updates = {};
      let needsUpdate = false;
      let matchReason = '';
      
      // Skip if already linked
      if (dues.transactionId) {
        skippedCount++;
        continue;
      }
      
      // Extract sequence number from notes if present
      let sequenceMatch = null;
      if (dues.notes) {
        sequenceMatch = dues.notes.match(/nSeq\s*=\s*(\d+)/i);
      }
      
      let matchedTransaction = null;
      
      // Method 1: Try matching by sequence number
      if (sequenceMatch && sequenceMatch[1]) {
        const seqNumber = sequenceMatch[1];
        if (transactionsBySequence[seqNumber]) {
          matchedTransaction = transactionsBySequence[seqNumber];
          matchReason = `sequence number ${seqNumber}`;
        }
      }
      
      // Method 2: Try matching by unit and date pattern in notes
      if (!matchedTransaction && dues.unit && dues.notes) {
        const unitStr = dues.unit.toString().trim();
        const unitTransactions = transactionsByUnit[unitStr] || [];
        
        // Look for date patterns in notes
        const paymentMatch = dues.notes.match(/paid.*?(\d{4}-\d{2}-\d{2})/i);
        const monthMatch = dues.notes.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi);
        
        if (paymentMatch) {
          const paymentDate = paymentMatch[1];
          
          // Find transactions by unit and near this date
          for (const tx of unitTransactions) {
            const txDate = tx.date?.toDate().toISOString().split('T')[0] || '';
            
            // If transaction date is within 5 days of payment date and amount matches
            if (txDate && 
                Math.abs(new Date(txDate) - new Date(paymentDate)) <= 5 * 86400000 &&
                Math.abs(tx.amount - dues.amount) < 0.01) {
              matchedTransaction = tx;
              matchReason = `unit ${unitStr} and payment date ${paymentDate}`;
              break;
            }
          }
        }
        // Try matching by months mentioned in notes
        else if (monthMatch && monthMatch.length > 0) {
          const mentionedMonths = monthMatch.map(m => m.toLowerCase());
          
          // Match any transaction for this unit where the description mentions the same months
          for (const tx of unitTransactions) {
            if (tx.description) {
              const txDesc = tx.description.toLowerCase();
              // If any of the mentioned months appear in the transaction description
              if (mentionedMonths.some(month => txDesc.includes(month.toLowerCase()))) {
                matchedTransaction = tx;
                matchReason = `unit ${unitStr} and month mention in description`;
                break;
              }
            }
          }
        }
      }
      
      // Method 3: Try a simple amount match for the same unit
      if (!matchedTransaction && dues.unit && dues.amount) {
        const unitStr = dues.unit.toString().trim();
        const unitTransactions = transactionsByUnit[unitStr] || [];
        
        // Find any transaction for this unit with exactly matching amount
        for (const tx of unitTransactions) {
          if (Math.abs(tx.amount - dues.amount) < 0.01) {
            matchedTransaction = tx;
            matchReason = `unit ${unitStr} and exact amount match`;
            break;
          }
        }
      }
      
      // If we found a match, update the record
      if (matchedTransaction) {
        updates.transactionId = matchedTransaction.id;
        needsUpdate = true;
      }
      
      // Update the record if needed
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        operationsInBatch++;
        updatedCount++;
        console.log(`Linked HOA dues record ${doc.id} to transaction ${matchedTransaction.id} (${matchReason})`);
        
        // Commit batch when it reaches the limit
        if (operationsInBatch >= 500) {
          await batch.commit();
          batch = db.batch();
          operationsInBatch = 0;
        }
      } else {
        notFoundCount++;
      }
    }
    
    // Commit final batch if needed
    if (operationsInBatch > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Updated ${updatedCount} HOA dues records with transaction links`);
    console.log(`⏩ Skipped ${skippedCount} HOA dues records (already linked)`);
    console.log(`❓ No match found for ${notFoundCount} HOA dues records`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating HOA dues transaction links for client ${clientId}:`, error);
    return false;
  }
}

/**
 * Specialized function to analyze and link 2025 HOA dues transactions
 * This function performs a more focused analysis just on 2025 HOA transactions
 */
async function link2025HoaDuesTransactions(clientId) {
  try {
    console.log(`🔄 Analyzing and linking 2025 HOA dues transactions for client ${clientId}...`);
    
    // Get 2025 HOA dues transactions
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31T23:59:59');
    
    const txnRef = db.collection(`clients/${clientId}/transactions`)
      .where('category', '==', 'HOA Dues')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate);
    
    console.log('Fetching 2025 HOA Dues transactions...');
    const txnSnapshot = await txnRef.get();
    
    if (txnSnapshot.empty) {
      console.log('No 2025 HOA Dues transactions found');
      return true;
    }
    
    console.log(`Found ${txnSnapshot.size} HOA dues transactions in 2025`);
    
    // Get all HOA dues records
    const duesRef = db.collection(`clients/${clientId}/hoaDues`);
    const duesSnapshot = await duesRef.get();
    
    if (duesSnapshot.empty) {
      console.log('No HOA dues records found');
      return true;
    }
    
    console.log(`Found ${duesSnapshot.size} total HOA dues records`);
    
    // Organize HOA dues by unit
    const duesByUnit = {};
    let duesWithoutUnit = [];
    
    duesSnapshot.forEach(doc => {
      const dues = { id: doc.id, ref: doc.ref, ...doc.data() };
      
      if (dues.unit) {
        const unitKey = dues.unit.toString().trim();
        if (!duesByUnit[unitKey]) {
          duesByUnit[unitKey] = [];
        }
        duesByUnit[unitKey].push(dues);
      } else {
        duesWithoutUnit.push(dues);
      }
    });
    
    // Process transactions
    let linkedCount = 0;
    let analyzedCount = 0;
    const batch = db.batch();
    
    // Process each 2025 HOA Dues transaction
    for (const doc of txnSnapshot.docs) {
      const tx = { id: doc.id, ...doc.data() };
      analyzedCount++;
      
      // Find the best matching HOA dues record
      let bestMatch = null;
      let bestMatchScore = 0;
      let matchReason = '';
      
      // Check if transaction has a unit
      if (tx.unit) {
        const unitKey = tx.unit.toString().trim();
        const unitDues = duesByUnit[unitKey] || [];
        
        for (const dues of unitDues) {
          // Skip already linked dues
          if (dues.transactionId) continue;
          
          let score = 0;
          let reason = [];
          
          // Check for exact amount match
          if (Math.abs(tx.amount - dues.amount) < 0.01) {
            score += 20;
            reason.push('amount');
          }
          
          // Check for sequence number match in notes
          if (tx.nSeq && dues.notes && dues.notes.includes(tx.nSeq.toString())) {
            score += 50;
            reason.push(`sequence ${tx.nSeq}`);
          }
          
          // Check for month mentions in both records
          if (tx.description && dues.notes) {
            const txDesc = tx.description.toLowerCase();
            const duesNotes = dues.notes.toLowerCase();
            
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const txMonths = months.filter(m => txDesc.includes(m));
            const duesMonths = months.filter(m => duesNotes.includes(m));
            
            const commonMonths = txMonths.filter(m => duesMonths.includes(m));
            if (commonMonths.length > 0) {
              score += 15 * commonMonths.length;
              reason.push(`months (${commonMonths.join(', ')})`);
            }
          }
          
          // Check for date proximity if dues has a payment date
          const paymentMatch = dues.notes?.match(/paid.*?(\d{4}-\d{2}-\d{2})/i);
          if (paymentMatch && tx.date) {
            const paymentDate = new Date(paymentMatch[1]);
            const txDate = tx.date.toDate();
            const daysDiff = Math.abs(paymentDate - txDate) / (1000 * 60 * 60 * 24);
            
            if (daysDiff <= 5) {
              score += Math.max(0, 15 - daysDiff * 3); // More points for closer dates
              reason.push(`payment date (${daysDiff.toFixed(1)} days)`);
            }
          }
          
          // Update best match if this is better
          if (score > bestMatchScore) {
            bestMatchScore = score;
            bestMatch = dues;
            matchReason = reason.join(', ');
          }
        }
      }
      
      // If we found a good match with a score above the threshold
      if (bestMatch && bestMatchScore >= 20) {
        batch.update(bestMatch.ref, { transactionId: tx.id });
        linkedCount++;
        console.log(`Linked transaction ${tx.id} to HOA dues ${bestMatch.id} for Unit ${tx.unit} (score: ${bestMatchScore}, ${matchReason})`);
      }
      
      // Commit the batch every 100 transactions
      if (linkedCount > 0 && linkedCount % 100 === 0) {
        await batch.commit();
        console.log(`Committed batch of ${linkedCount} links so far`);
      }
    }
    
    // Commit final batch if needed
    if (linkedCount > 0 && linkedCount % 100 !== 0) {
      await batch.commit();
    }
    
    console.log(`✅ Analyzed ${analyzedCount} transactions and created ${linkedCount} links to HOA dues records`);
    return true;
  } catch (error) {
    console.error(`❌ Error linking 2025 HOA dues transactions: ${error}`);
    return false;
  }
}

// Export functions for use in other scripts
export {
  migrateAccountsToIds,
  updateTransactionAccountIds,
  rebuildAccountBalances,
  updateHoaDuesTransactionLinks,
  link2025HoaDuesTransactions
};

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Account ID Migration Tool

Usage:
  node account-id-migration.js <clientId> [options]

Options:
  --accounts          Migrate accounts to use stable IDs
  --transactions      Update transactions to reference accountId
  --rebuild           Rebuild account balances from transactions
  --hoa-links         Update HOA dues with transaction links
  --hoa-2025          Specialized analysis of 2025 HOA dues transactions
  --all               Perform all operations
  --set-balances      Set initial account balances (requires balance values after)
  --help              Show this help message

Examples:
  node account-id-migration.js MTC --all
  node account-id-migration.js MTC --hoa-2025
  node account-id-migration.js MTC --set-balances cash-001=5000 bank-cibanco-001=164088
`);
    process.exit(0);
  }
  
  const clientId = args[0];
  
  const migrateAccounts = args.includes('--accounts') || args.includes('--all');
  const migrateTransactions = args.includes('--transactions') || args.includes('--all');
  const rebuildBalances = args.includes('--rebuild') || args.includes('--all');
  const updateHoaLinks = args.includes('--hoa-links') || args.includes('--all');
  const hoaDues2025 = args.includes('--hoa-2025');
  
  // Process initial balances if provided
  const initialBalances = {};
  if (args.includes('--set-balances')) {
    const balanceArgs = args.slice(args.indexOf('--set-balances') + 1).filter(arg => !arg.startsWith('--'));
    
    balanceArgs.forEach(balanceStr => {
      const [accountId, balanceValue] = balanceStr.split('=');
      if (accountId && balanceValue) {
        initialBalances[accountId] = parseFloat(balanceValue);
      }
    });
    
    console.log('Initial balances set:', initialBalances);
  }
  
  // Execute requested operations
  if (migrateAccounts) {
    await migrateAccountsToIds(clientId, initialBalances);
  }
  
  if (migrateTransactions) {
    await updateTransactionAccountIds(clientId);
  }
  
  if (rebuildBalances) {
    await rebuildAccountBalances(clientId);
  }
  
  if (updateHoaLinks) {
    await updateHoaDuesTransactionLinks(clientId);
  }
  
  if (hoaDues2025) {
    await link2025HoaDuesTransactions(clientId);
  }
  
  console.log('✅ Migration completed');
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
