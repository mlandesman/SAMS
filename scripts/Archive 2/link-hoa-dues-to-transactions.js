/**
 * link-hoa-dues-to-transactions.js
 * 
 * Script to link HOA Dues payment records to transactions in SAMS
 * Handles the structure /clients/MTC/units/{unitID}/dues/2025 with payments array
 * 
 * Performs matching based on multiple criteria:
 * - Unit number match
 * - Date match or proximity
 * - Amount match
 * - Notes content matching
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized');

/**
 * Link HOA Dues payments to transactions for a client
 * @param {string} clientId - Client ID
 * @param {number} year - Year to process dues for
 * @returns {object} - Stats about linking process
 */
async function linkHoaDuesToTransactions(clientId, year) {
  console.log(`\n🔗 Linking HOA Dues payments to transactions for client ${clientId} (Year: ${year})...`);
  
  const stats = {
    unitsProcessed: 0,
    paymentsProcessed: 0,
    paymentsLinked: 0,
    transactionsMatched: 0,
    errors: []
  };
  
  try {
    // Step 1: Get all units for the client
    console.log('📊 Fetching units...');
    const unitsRef = db.collection(`clients/${clientId}/units`);
    const unitsSnapshot = await unitsRef.get();
    
    if (unitsSnapshot.empty) {
      console.warn('⚠️ No units found for client');
      return { success: false, reason: 'no-units', stats };
    }
    
    const units = [];
    unitsSnapshot.forEach(doc => {
      units.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${units.length} units`);
    
    // Step 2: Fetch all HOA dues transactions
    console.log('📊 Fetching HOA Dues transactions...');
    const txnRef = db.collection(`clients/${clientId}/transactions`);
    const query = txnRef.where('category', '==', 'HOA Dues');
    const txnSnapshot = await query.get();
    
    if (txnSnapshot.empty) {
      console.warn('⚠️ No HOA Dues transactions found');
      return { success: false, reason: 'no-transactions', stats };
    }
    
    // Extract transactions and format for matching
    const transactions = [];
    txnSnapshot.forEach(doc => {
      const txData = doc.data();
      transactions.push({
        id: doc.id,
        date: txData.date instanceof Date ? txData.date : new Date(txData.date),
        amount: Number(txData.amount || 0),
        notes: txData.notes || '',
        unit: txData.unit || '',
        reference: txData.reference || '',
        accountId: txData.accountId || '',
        vendor: txData.vendor || ''
      });
    });
    
    console.log(`✅ Found ${transactions.length} HOA Dues transactions`);
    
    // Process each unit
    for (const unit of units) {
      console.log(`\n🏢 Processing unit ${unit.id}...`);
      stats.unitsProcessed++;
      
      try {
        // Step 3: Get dues document for this unit and year
        const duesRef = db.collection(`clients/${clientId}/units/${unit.id}/dues`).doc(year.toString());
        const duesDoc = await duesRef.get();
        
        if (!duesDoc.exists) {
          console.log(`⚠️ No dues record found for unit ${unit.id} for year ${year}`);
          continue;
        }
        
        const duesData = duesDoc.data();
        if (!duesData.payments || !Array.isArray(duesData.payments)) {
          console.log(`⚠️ No payments array found for unit ${unit.id}`);
          continue;
        }
        
        console.log(`📊 Found ${duesData.payments.length} payment entries for unit ${unit.id}`);
        
        // Step 4: Process each payment in the dues record
        let updatedPayments = [...duesData.payments];
        let linkedCount = 0;
        
        for (let i = 0; i < updatedPayments.length; i++) {
          const payment = updatedPayments[i];
          stats.paymentsProcessed++;
          
          // Skip if payment is already linked
          if (payment.transactionId) {
            console.log(`✅ Payment for month ${payment.month} already linked to transaction: ${payment.transactionId}`);
            stats.paymentsLinked++;
            continue;
          }
          
          // Skip if payment amount is 0
          if (!payment.paid || payment.paid === 0) {
            console.log(`⏩ Skipping month ${payment.month} with zero payment amount`);
            continue;
          }
          
          console.log(`📊 Looking for matching transaction for unit ${unit.id}, month ${payment.month}, amount ${payment.paid}`);
          
          // Find matching transaction based on criteria
          const matchingTransactions = transactions.filter(tx => {
            // Check for unit match if available in transaction
            const unitMatch = !tx.unit || tx.unit === unit.id;
            
            // Check amount match with more flexibility for rounding
            // Some HOA payments might have slight rounding differences
            const amountMatch = Math.abs(tx.amount - payment.paid) < 1;
            
            // Check for date match or proximity if payment has date
            let dateMatch = true;
            if (payment.date) {
              const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
              const txDate = tx.date;
              
              // Allow wider 30-day window for date matching
              const diffTime = Math.abs(txDate - paymentDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              dateMatch = diffDays <= 30;
            }
            
            // Look for unit ID or sequence in notes, or vendor being HOA
            const notesMatch = tx.notes?.includes(unit.id) || 
                             (payment.notes && tx.notes?.includes(payment.notes)) ||
                             tx.vendor?.includes('HOA') ||
                             tx.notes?.includes('HOA Dues') ||
                             tx.notes?.includes(`Unit ${unit.id}`);
            
            console.log(`  - TX ${tx.id.substring(0,6)}: Amount: ${tx.amount}, Date: ${tx.date ? tx.date.toLocaleDateString() : 'n/a'}, AmountMatch: ${amountMatch}, UnitMatch: ${unitMatch}, NotesMatch: ${notesMatch}`);
            
            // Match if amount matches and either we have a unit match or notes match or date match
            return amountMatch && (unitMatch || notesMatch || dateMatch);
          });
          
          if (matchingTransactions.length === 1) {
            // Exact match - link the payment
            const tx = matchingTransactions[0];
            console.log(`✅ Found matching transaction ${tx.id} for month ${payment.month}`);
            
            updatedPayments[i] = {
              ...payment,
              transactionId: tx.id
            };
            
            linkedCount++;
            stats.paymentsLinked++;
            stats.transactionsMatched++;
          } else if (matchingTransactions.length > 1) {
            // Multiple matches - use additional criteria
            console.log(`⚠️ Found ${matchingTransactions.length} potential matching transactions for month ${payment.month}`);
            
            // Try to find best match based on date if payment has a date
            if (payment.date) {
              const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
              
              // Sort by date proximity
              matchingTransactions.sort((a, b) => {
                const diffA = Math.abs(a.date - paymentDate);
                const diffB = Math.abs(b.date - paymentDate);
                return diffA - diffB;
              });
              
              const bestMatch = matchingTransactions[0];
              console.log(`✅ Selected best matching transaction ${bestMatch.id} based on date proximity`);
              
              updatedPayments[i] = {
                ...payment,
                transactionId: bestMatch.id
              };
              
              linkedCount++;
              stats.paymentsLinked++;
              stats.transactionsMatched++;
            } else {
              console.log(`⚠️ Skipping month ${payment.month} due to multiple potential matches and no date to disambiguate`);
            }
          } else {
            console.log(`⚠️ No matching transaction found for month ${payment.month}`);
          }
        }
        
        // Step 5: Update dues document if links were added
        if (linkedCount > 0) {
          console.log(`✏️ Updating dues document for unit ${unit.id} with ${linkedCount} linked payments`);
          
          await duesRef.update({
            payments: updatedPayments
          });
          
          console.log(`✅ Successfully updated dues document for unit ${unit.id}`);
        } else {
          console.log(`ℹ️ No payment links to update for unit ${unit.id}`);
        }
      } catch (error) {
        console.error(`❌ Error processing unit ${unit.id}:`, error);
        stats.errors.push({
          unit: unit.id,
          error: error.message
        });
      }
    }
    
    // Final summary
    console.log('\n📊 Linking Summary:');
    console.log(`✅ Units processed: ${stats.unitsProcessed}`);
    console.log(`✅ Payments processed: ${stats.paymentsProcessed}`);
    console.log(`✅ Payments linked: ${stats.paymentsLinked}`);
    console.log(`✅ Transactions matched: ${stats.transactionsMatched}`);
    
    if (stats.errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach(err => {
        console.log(`  - Unit ${err.unit}: ${err.error}`);
      });
    }
    
    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error(`❌ Error linking HOA dues to transactions:`, error);
    return {
      success: false,
      reason: 'exception',
      error: error.message,
      stats
    };
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Default values
  let clientId = 'MTC';
  let year = 2025;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--client=')) {
      clientId = args[i].split('=')[1];
    } else if (args[i].startsWith('--year=')) {
      year = parseInt(args[i].split('=')[1]);
    } else if (!args[i].startsWith('--')) {
      // First non-flag argument is the client ID
      clientId = args[i];
      
      // Second non-flag argument is the year
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        year = parseInt(args[i + 1]);
        i++; // Skip the next argument
      }
    }
  }
  
  // Show help if requested
  if (args.includes('--help')) {
    console.log(`
HOA Dues Transaction Linking Tool

Usage:
  node link-hoa-dues-to-transactions.js [clientId] [year] [options]
  
Arguments:
  clientId      Client ID (default: MTC)
  year          Year to process (default: 2025)
  
Options:
  --client=ID   Specify client ID
  --year=YYYY   Specify year
  --help        Show this help message

Example:
  node link-hoa-dues-to-transactions.js MTC 2025
  node link-hoa-dues-to-transactions.js --client=MTC --year=2025
`);
    process.exit(0);
  }
  
  console.log(`🚀 Starting HOA Dues transaction linking for client ${clientId} and year ${year}`);
  
  const result = await linkHoaDuesToTransactions(clientId, year);
  
  if (result.success) {
    console.log('\n✅ HOA Dues transaction linking completed successfully');
  } else {
    console.log(`\n❌ HOA Dues transaction linking failed: ${result.reason}`);
    if (result.error) {
      console.error(result.error);
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
