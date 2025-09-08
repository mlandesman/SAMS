#!/usr/bin/env node

/**
 * importHOADuesEnhanced.js
 * Enhanced HOA dues import with notes parsing and transaction linking
 * 
 * Features:
 * - Parses notes field to extract payment dates and sequence numbers
 * - Links HOA payments to transaction IDs
 * - Uses actual payment dates from transactions, not today's date
 * - Maintains full audit trail between HOA Dues and Transactions
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { toFirestoreTimestamp, getCurrentTimestamp } from './utils/timestamp-converter.js';
import { validateCollectionData, removeDeprecatedFields } from './utils/field-validator.js';
import { createRequire } from 'module';

// Use require for JSON data
const require = createRequire(import.meta.url);
const hoaDuesData = require('../MTCdata/HOADues.json');
const transactionsData = require('../MTCdata/Transactions.json');

// Environment configuration
const ENV = process.env.FIRESTORE_ENV || 'dev';

// Debug logging
const DEBUG = true;

/**
 * Creates a lookup map of transactions by sequence number
 * @returns {Map} - Map of sequence number to transaction data
 */
function createTransactionLookup() {
  const lookup = new Map();
  
  transactionsData.forEach((transaction, index) => {
    const sequenceNumber = transaction[""] || transaction.sequence; // Handle both field names
    if (sequenceNumber) {
      // Store both the transaction data and the index for generating document IDs
      lookup.set(sequenceNumber, {
        ...transaction,
        originalIndex: index
      });
    }
  });
  
  console.log(`📊 Created transaction lookup with ${lookup.size} entries`);
  return lookup;
}

/**
 * Parses notes field to extract payment information
 * @param {string} notes - Notes string from HOA payment
 * @returns {Object} - Parsed payment info
 */
function parsePaymentNotes(notes) {
  if (!notes) {
    return { 
      paymentDate: null, 
      sequenceNumber: null, 
      originalAmount: null,
      paymentMethod: null,
      monthsCovered: null
    };
  }
  
  const result = {
    paymentDate: null,
    sequenceNumber: null,
    originalAmount: null,
    paymentMethod: null,
    monthsCovered: null
  };
  
  try {
    // Extract payment date: "Posted: MXN 17,400.00 on Fri Dec 27 2024 16:27:51 GMT-0500"
    const dateMatch = notes.match(/on\s+(.+?)\s+GMT/);
    if (dateMatch) {
      result.paymentDate = new Date(dateMatch[1]);
    }
    
    // Extract sequence number: "Seq: 25009"
    const seqMatch = notes.match(/Seq:\s*(\d+)/);
    if (seqMatch) {
      result.sequenceNumber = parseInt(seqMatch[1]);
    }
    
    // Extract original amount: "MXN 17,400.00"
    const amountMatch = notes.match(/MXN\s+([\d,]+\.?\d*)/);
    if (amountMatch) {
      result.originalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Extract payment method and months info
    const lines = notes.split('\n');
    if (lines.length > 1) {
      result.monthsCovered = lines[1]; // e.g., "Jan, Feb, Mar 2025; BBVA → MTC Bank"
      
      // Extract payment method from months line
      const methodMatch = lines[1].match(/;\s*(.+?)(?:\s*→|$)/);
      if (methodMatch) {
        result.paymentMethod = methodMatch[1].trim();
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error parsing notes: ${notes}`, error.message);
  }
  
  return result;
}

/**
 * Generates transaction document ID based on transaction data
 * This should match the ID generation used in the transaction import script
 * @param {Object} transaction - Transaction data
 * @returns {string} - Document ID
 */
function generateTransactionDocId(transaction) {
  // Use the same pattern as the transaction import script
  // Format: YYYYMMDD-category-sequence
  const date = new Date(transaction.Date);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const categoryId = transaction.Category.toLowerCase().replace(/\s+/g, '').substring(0, 10);
  const sequence = transaction[""] || transaction.originalIndex;
  
  return `${dateStr}-${categoryId}-${sequence}`;
}

/**
 * Enhanced HOA dues import with transaction linking
 */
async function importHOADuesEnhanced() {
  const clientId = 'MTC';
  const year = '2025';
  
  console.log('📊 Starting enhanced HOA dues import for client MTC...');
  console.log('✅ Features enabled:');
  console.log('   - Notes parsing for payment dates');
  console.log('   - Transaction linking via sequence numbers');
  console.log('   - Audit trail preservation');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase
    console.log('🔄 Initializing Firebase...');
    const { db } = await initializeFirebase(ENV);
    console.log('✅ Connected to Firestore');
    
    // Create transaction lookup
    const transactionLookup = createTransactionLookup();
    
    let importCount = 0;
    let linkedPayments = 0;
    let unlinkedPayments = 0;
    
    console.log(`\n📦 Found ${Object.keys(hoaDuesData).length} units to process\n`);
    
    // Check backend availability for transaction creation
    const backendAvailable = await checkBackendAvailable();
    if (backendAvailable) {
      console.log('✅ Backend API available - will create HOA income transactions');
    } else {
      console.log('⚠️ Backend API unavailable - HOA transactions will not be created');
    }
    
    // Process each unit's dues data
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      console.log(`Processing unit ${unitId}...`);
      
      const { scheduledAmount, creditBalance, payments } = unitData;
      
      if (DEBUG) {
        console.log(`  📋 Unit ${unitId}: scheduled=$${scheduledAmount}, credit=$${creditBalance}, payments=${payments?.length || 0}`);
      }
      
      // Enhanced payments processing with transaction linking and income transaction creation
      const enhancedPayments = Array(12).fill(null).map((_, monthIndex) => {
        const month = monthIndex + 1;
        const monthPayment = payments.find(p => p.month === month);
        
        if (!monthPayment || monthPayment.paid <= 0) {
          return {
            paid: 0,
            date: null,
            transactionId: null,
            notes: null,
            paymentMethod: null
          };
        }
        
        // Parse the notes to extract payment information
        const parsedNotes = parsePaymentNotes(monthPayment.notes);
        
        let paymentDate = null;
        let transactionId = null;
        let paymentMethod = parsedNotes.paymentMethod;
        
        // Look up the linked transaction if we have a sequence number
        if (parsedNotes.sequenceNumber) {
          const linkedTransaction = transactionLookup.get(parsedNotes.sequenceNumber);
          
          if (linkedTransaction) {
            // Use the transaction date as the payment date
            paymentDate = toFirestoreTimestamp(linkedTransaction.Date);
            
            // Generate the transaction document ID
            transactionId = generateTransactionDocId(linkedTransaction);
            
            // Use transaction account as payment method if not extracted from notes
            if (!paymentMethod) {
              paymentMethod = linkedTransaction.Account;
            }
            
            linkedPayments++;
            
            if (DEBUG) {
              console.log(`    ✅ Month ${month}: Linked to transaction ${parsedNotes.sequenceNumber} (${transactionId})`);
            }
          } else {
            console.warn(`    ⚠️ Month ${month}: Transaction ${parsedNotes.sequenceNumber} not found in lookup`);
            unlinkedPayments++;
          }
        } else if (parsedNotes.paymentDate) {
          // Use the parsed date from notes if no sequence number
          paymentDate = toFirestoreTimestamp(parsedNotes.paymentDate);
          unlinkedPayments++;
          
          if (DEBUG) {
            console.log(`    📅 Month ${month}: Using parsed date (no sequence number)`);
          }
        } else {
          // Fallback to today's date
          paymentDate = getCurrentTimestamp();
          unlinkedPayments++;
          
          if (DEBUG) {
            console.log(`    ⚠️ Month ${month}: Using current date (no date info in notes)`);
          }
        }
        
        // CRITICAL: Create corresponding income transaction for HOA payment
        if (monthPayment.paid > 0 && backendAvailable) {
          try {
            const hoaTransactionData = {
              // CRITICAL: HOA Dues as POSITIVE income with BOTH ID and NAME fields
              vendorId: 'vendor-hoa-dues',
              vendorName: 'HOA Dues',
              categoryId: 'cat-hoa-dues', // CRITICAL: Must include categoryId
              categoryName: 'HOA Dues',
              accountId: 'account-mtc-bank',
              accountName: 'MTC Bank',
              accountType: 'bank',
              
              amount: Math.abs(Math.round(monthPayment.paid * 100)), // Force positive for income
              type: 'income', // Explicit income type
              date: paymentDate,
              
              description: `HOA Dues - Unit ${unitId} - Month ${month}`,
              memo: monthPayment.notes || '',
              reference: `HOA-${unitId}-${year}-${month.toString().padStart(2, '0')}`,
              clientId: clientId,
              
              status: 'completed',
              reconciled: false,
              updated: getCurrentTimestamp()
            };
            
            // Create transaction via backend validation
            await createTransactionViaAPI(clientId, hoaTransactionData);
            console.log(`    💰 Created HOA income transaction for unit ${unitId}, month ${month}`);
            
          } catch (error) {
            console.warn(`    ⚠️ Failed to create HOA transaction: ${error.message}`);
          }
        }
        
        return {
          paid: Math.round(monthPayment.paid * 100), // Convert to cents
          date: paymentDate,
          transactionId: transactionId,
          notes: monthPayment.notes || null,
          paymentMethod: paymentMethod || null
        };
      });
      
      // Prepare the HOA dues document
      const duesData = {
        year: year,
        scheduledAmount: Math.round((scheduledAmount || 0) * 100), // Convert to cents
        creditBalance: Math.round((creditBalance || 0) * 100), // Convert to cents
        payments: enhancedPayments,
        creditBalanceHistory: [],
        updated: getCurrentTimestamp()
      };
      
      // Remove deprecated fields and validate
      const cleanedData = removeDeprecatedFields(duesData, 'hoaDues');
      const validatedData = validateCollectionData(cleanedData, 'hoaDues');
      
      if (!validatedData) {
        throw new Error('Validation returned undefined result');
      }
      
      // Store in Firestore
      const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(year);
      await duesRef.set(validatedData);
      
      // Calculate summary stats
      const paidMonths = validatedData.payments.filter(p => p.paid > 0).length;
      const totalPaid = validatedData.payments.reduce((sum, p) => sum + p.paid, 0);
      const linkedMonths = validatedData.payments.filter(p => p.transactionId).length;
      
      console.log(`  ✅ Saved enhanced data for unit ${unitId}`);
      console.log(`     💰 Scheduled: $${(validatedData.scheduledAmount / 100).toFixed(2)} | Credit: $${(validatedData.creditBalance / 100).toFixed(2)}`);
      console.log(`     📊 Paid: ${paidMonths}/12 months | Total: $${(totalPaid / 100).toFixed(2)}`);
      console.log(`     🔗 Linked: ${linkedMonths}/${paidMonths} payments have transaction references`);
      
      importCount++;
    }
    
    console.log(`\n🎉 Enhanced HOA dues import completed successfully!`);
    console.log(`\n📊 Import Summary:`);
    console.log(`   Units processed: ${importCount}`);
    console.log(`   Payments linked to transactions: ${linkedPayments}`);
    console.log(`   Payments without transaction links: ${unlinkedPayments}`);
    console.log(`   Total payments processed: ${linkedPayments + unlinkedPayments}`);
    console.log(`\n✅ Features implemented:`);
    console.log(`   - Payment dates extracted from transaction records`);
    console.log(`   - Transaction IDs linked via sequence numbers`);
    console.log(`   - Payment methods preserved`);
    console.log(`   - Notes preserved for audit trail`);
    console.log(`   - Full field specification compliance`);
    
  } catch (error) {
    console.error('❌ Error in enhanced HOA dues import:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Enhanced HOA Dues Import...\n');
  
  try {
    await importHOADuesEnhanced();
    console.log('\n✅ Enhanced import process completed successfully');
  } catch (error) {
    console.error('❌ Main execution error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error.message);
    process.exit(1);
  });
}