/**
 * link-hoa-dues-improved.js
 * 
 * Enhanced script to link HOA Dues payment records to transactions in SAMS
 * Handles the structure /clients/MTC/units/{unitID}/dues/2025 with payments array
 * 
 * Enhanced matching logic:
 * 1. Extracts transaction IDs from "Seq: XXXXX" in payment notes
 * 2. Handles multi-month payments
 * 3. Matches on unit name/ID, approximate amounts, date proximity
 * 4. Handles the empty field name ("") for transaction IDs
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized');

/**
 * Extract a transaction ID from payment notes if present
 * Looks for patterns like "Seq: 25009" which contains the transaction ID
 * @param {string} notes - Payment notes field
 * @returns {string|null} - Extracted transaction ID or null
 */
function extractTransactionIdFromNotes(notes) {
  if (!notes) return null;

  // Match Seq: XXXXX pattern
  const seqMatch = notes.match(/Seq:\s*(\d+)/i);
  if (seqMatch && seqMatch[1]) {
    return seqMatch[1];
  }
  
  return null;
}

/**
 * Check if the payment notes might correspond to a multi-month payment
 * @param {string} notes - Payment notes field
 * @returns {Object} - If it appears to be a multi-month payment
 */
function checkMultiMonthPayment(notes) {
  if (!notes) return { isMultiMonth: false };
  
  // Common multi-month patterns in notes
  const multiMonthPatterns = [
    /(\w+),\s*(\w+),\s*(\w+)(\s+\d{4})?\s+(?:payment|dues)/i,  // Jan, Feb, Mar 2025 payment
    /(\w+)\s+(?:to|through|thru|-)\s+(\w+)(\s+\d{4})?\s+(?:payment|dues)/i,  // Jan to Mar 2025 payment
    /Q\d\s+(?:payment|dues)/i,  // Q1 payment
    /quarter\s+\d\s+(?:payment|dues)/i  // Quarter 1 payment
  ];
  
  for (const pattern of multiMonthPatterns) {
    if (pattern.test(notes)) {
      return { 
        isMultiMonth: true,
        months: notes.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi)?.map(m => m.toLowerCase())
      };
    }
  }
  
  return { isMultiMonth: false };
}

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
    transactionsMatchedBySeq: 0,
    multiMonthPaymentsHandled: 0,
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
    const transactionsBySeq = {};
    
    txnSnapshot.forEach(doc => {
      const txData = doc.data();
      
      // Extract unitId from various fields and formats
      let unitId = null;
      
      // First try the standard unitId field
      if (txData.unitId) {
        unitId = txData.unitId;
      }
      // Then try Unit or unit field with parenthesis format extraction
      else if (txData.Unit || txData.unit) {
        const unitField = txData.Unit || txData.unit || '';
        // Extract just the unit ID part (before the space and parenthesis)
        // E.g., "PH4D (Landesman)" -> "PH4D"
        const unitMatch = unitField.match(/^([A-Za-z0-9-]+)/);
        if (unitMatch && unitMatch[1]) {
          unitId = unitMatch[1];
        } else {
          unitId = unitField; // Use the whole string if no match
        }
      }
      
      const transactionObj = {
        id: doc.id,
        date: txData.date instanceof Date ? txData.date : new Date(txData.date),
        amount: Number(txData.amount || 0),
        notes: txData.notes || '',
        unit: unitId,  // Standardized unit identifier (e.g., "PH4D")
        reference: txData.reference || '',
        accountId: txData.accountId || '',
        vendor: txData.vendor || '',
        // Extract sequence number (the empty field)
        seqNum: txData[""] ? String(txData[""]).trim() : null
      };
      
      transactions.push(transactionObj);
      
      // Create lookup by sequence number
      if (transactionObj.seqNum) {
        transactionsBySeq[transactionObj.seqNum] = transactionObj;
      }
    });
    
    console.log(`✅ Found ${transactions.length} HOA Dues transactions`);
    
    // Create unit name lookup for matching transactions with different unit formats
    const unitLookup = {};
    units.forEach(unit => {
      // Store unit by ID
      unitLookup[unit.id] = unit;
      
      // Store unit by name variations if available
      if (unit.owner) {
        const lowercaseName = unit.owner.toLowerCase();
        unitLookup[lowercaseName] = unit;
        
        // Also store without parenthetical parts
        const cleanName = unit.owner.replace(/\s*\(.*\)\s*/g, '').trim().toLowerCase();
        if (cleanName !== lowercaseName) {
          unitLookup[cleanName] = unit;
        }
      }
      
      // Handle common formats like "PH4D (Landesman)" -> "PH4D"
      if (unit.id.includes(' ')) {
        const baseId = unit.id.split(' ')[0];
        unitLookup[baseId] = unit;
      }
    });
    
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
          
          // Method 1: Check for sequence number in notes
          if (payment.notes) {
            const extractedSeq = extractTransactionIdFromNotes(payment.notes);
            if (extractedSeq && transactionsBySeq[extractedSeq]) {
              const matchedTx = transactionsBySeq[extractedSeq];
              console.log(`✅ Found transaction match via sequence number ${extractedSeq} in notes`);
              
              updatedPayments[i] = {
                ...payment,
                transactionId: matchedTx.id
              };
              
              linkedCount++;
              stats.paymentsLinked++;
              stats.transactionsMatchedBySeq++;
              continue;
            }
          }
          
          // Method 2: Check for multi-month payments
          const multiMonthInfo = checkMultiMonthPayment(payment.notes);
          
          // Find matching transaction based on criteria
          const matchingTransactions = transactions.filter(tx => {
            // Check for unit match with the unit field
            let unitMatch = false;
            
            // Case 1: Direct match with unit field
            if (tx.unit && tx.unit === unit.id) {
              unitMatch = true;
            }
            // Case 2: Match unit ID within transaction unit field
            else if (tx.unit && tx.unit.includes(unit.id)) {
              unitMatch = true;
            }
            // Case 3: Check if transaction unit can be resolved to this unit
            else if (tx.unit && unitLookup[tx.unit.toLowerCase()]) {
              const matchedUnit = unitLookup[tx.unit.toLowerCase()];
              unitMatch = matchedUnit.id === unit.id;
            }
            // Case 5: Clean the unit name of parentheses and try again
            else if (tx.unit) {
              const cleanUnitName = tx.unit.replace(/\s*\(.*\)\s*/g, '').trim();
              if (cleanUnitName !== tx.unit && unitLookup[cleanUnitName.toLowerCase()]) {
                const matchedUnit = unitLookup[cleanUnitName.toLowerCase()];
                unitMatch = matchedUnit.id === unit.id;
              }
            }
            
            // Check notes for unit ID
            if (!unitMatch && tx.notes) {
              unitMatch = tx.notes.includes(unit.id);
            }
            
            // Amount matching logic depends on whether this is potentially part of a multi-month payment
            let amountMatch = false;
            
            // For multi-month payments, check if this transaction is large enough to cover this payment
            if (multiMonthInfo.isMultiMonth && multiMonthInfo.months && multiMonthInfo.months.length > 0) {
              // The transaction amount should be roughly a multiple of the payment amount
              const monthCount = multiMonthInfo.months.length;
              
              // Transaction amount should be close to payment amount * number of months
              const expectedTotal = payment.paid * monthCount;
              amountMatch = Math.abs(tx.amount - expectedTotal) < monthCount;
            } else {
              // For single month payments, just check for close amount match with small tolerance for rounding
              amountMatch = Math.abs(tx.amount - payment.paid) < 1;
            }
            
            // Check for date match or proximity if payment has date
            let dateMatch = true;
            if (payment.date) {
              const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date);
              const txDate = tx.date;
              
              // Allow wider 45-day window for date matching (some payments may happen before or after due date)
              const diffTime = Math.abs(txDate - paymentDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              dateMatch = diffDays <= 45;
            }
            
            // Check for matching content in notes fields
            let notesMatch = false;
            if (payment.notes && tx.notes) {
              // Convert both to lowercase for case-insensitive matching
              const paymentNotesLower = payment.notes.toLowerCase();
              const txNotesLower = tx.notes.toLowerCase();
              
              // Look for matching month names
              const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const paymentMonth = monthNames[payment.month - 1]; // 1-indexed to 0-indexed

              // Look for month name in both notes
              notesMatch = txNotesLower.includes(paymentMonth) && 
                          (paymentNotesLower.includes(paymentMonth) || 
                          // Handle quarterly payments - Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
                          (payment.month >= 1 && payment.month <= 3 && paymentNotesLower.includes('q1')) ||
                          (payment.month >= 4 && payment.month <= 6 && paymentNotesLower.includes('q2')) ||
                          (payment.month >= 7 && payment.month <= 9 && paymentNotesLower.includes('q3')) ||
                          (payment.month >= 10 && payment.month <= 12 && paymentNotesLower.includes('q4')));
            }
            
            // Consider HOA-specific matches
            const hoaMatch = tx.vendor?.toLowerCase().includes('hoa') || 
                           tx.notes?.toLowerCase().includes('hoa dues') ||
                           tx.notes?.toLowerCase().includes('dues payment');
            
            console.log(`  - TX ${tx.id.substring(0,6)} (Seq: ${tx.seqNum || 'none'}): Amount: ${tx.amount}, Date: ${tx.date.toLocaleDateString()}`);
            console.log(`    Original Unit field: "${txData.unit || txData.Unit || ''}", Standardized Unit: "${tx.unit}", UnitMatch: ${unitMatch}`);
            console.log(`    AmountMatch: ${amountMatch}, DateMatch: ${dateMatch}, NotesMatch: ${notesMatch}, HOAMatch: ${hoaMatch}`);
            
            // Match if meets enough criteria: (amount match + unitMatch) OR (amount match + notes match + date match)
            return (amountMatch && unitMatch) || (amountMatch && notesMatch && dateMatch) || (amountMatch && hoaMatch && unitMatch);
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
              // Try to use multi-month payment info to disambiguate
              if (multiMonthInfo.isMultiMonth) {
                // Find the transaction with amount closest to the expected total
                const monthCount = multiMonthInfo.months?.length || 0;
                const expectedTotal = payment.paid * (monthCount || 3); // Default to 3 months if can't determine
                
                matchingTransactions.sort((a, b) => {
                  return Math.abs(a.amount - expectedTotal) - Math.abs(b.amount - expectedTotal);
                });
                
                const bestMatch = matchingTransactions[0];
                console.log(`✅ Selected best matching transaction ${bestMatch.id} based on multi-month amount ${expectedTotal}`);
                
                updatedPayments[i] = {
                  ...payment,
                  transactionId: bestMatch.id
                };
                
                linkedCount++;
                stats.paymentsLinked++;
                stats.transactionsMatched++;
                stats.multiMonthPaymentsHandled++;
              } else {
                console.log(`⚠️ Skipping month ${payment.month} due to multiple potential matches with no way to disambiguate`);
              }
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
    console.log(`✅ Transactions matched by sequence: ${stats.transactionsMatchedBySeq}`);
    console.log(`✅ Multi-month payments handled: ${stats.multiMonthPaymentsHandled}`);
    
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
HOA Dues Transaction Linking Tool (Improved)

Usage:
  node link-hoa-dues-improved.js [clientId] [year] [options]
  
Arguments:
  clientId      Client ID (default: MTC)
  year          Year to process (default: 2025)
  
Options:
  --client=ID   Specify client ID
  --year=YYYY   Specify year
  --help        Show this help message

Example:
  node link-hoa-dues-improved.js MTC 2025
  node link-hoa-dues-improved.js --client=MTC --year=2025
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
