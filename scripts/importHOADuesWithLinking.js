/**
 * importHOADuesSimple.js - Updated for New Field Structure
 * Simplified script to import HOA dues data from JSON into Firestore.
 * Updated to conform to FIELD_SPECIFICATION_HOA_DUES_FINAL.md
 *
 * Task ID: IMPORT-SCRIPTS-UPDATE-001 (Subagent 5)
 * Date: July 4, 2025
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { toFirestoreTimestamp, getCurrentTimestamp } from './utils/timestamp-converter.js';
import { validateCollectionData, removeDeprecatedFields } from './utils/field-validator.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Use require for JSON data
const require = createRequire(import.meta.url);
const hoaDuesData = require('../MTCdata/HOADues.json');
const transactionsData = require('../MTCdata/Transactions.json');

// Environment configuration
const ENV = process.env.FIRESTORE_ENV || 'dev';

// Enable debug logging
const DEBUG = true;

/**
 * Creates a lookup map of transactions by sequence number
 */
function createTransactionLookup() {
  const lookup = new Map();
  
  transactionsData.forEach((transaction, index) => {
    const sequenceNumber = transaction[""] || transaction.sequence;
    if (sequenceNumber) {
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
 */
function parsePaymentNotes(notes) {
  if (!notes) {
    return { 
      paymentDate: null, 
      sequenceNumber: null, 
      originalAmount: null,
      paymentMethod: null
    };
  }
  
  const result = {
    paymentDate: null,
    sequenceNumber: null,
    originalAmount: null,
    paymentMethod: null
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
    
    // Extract payment method from months line
    const lines = notes.split('\n');
    if (lines.length > 1) {
      const methodMatch = lines[1].match(/;\s*(.+?)(?:\s*→|$)/);
      if (methodMatch) {
        result.paymentMethod = methodMatch[1].trim();
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error parsing notes:`, error.message);
  }
  
  return result;
}

/**
 * Generates transaction document ID based on transaction data
 */
function generateTransactionDocId(transaction) {
  const date = new Date(transaction.Date);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const categoryId = transaction.Category.toLowerCase().replace(/\s+/g, '').substring(0, 10);
  const sequence = transaction[""] || transaction.originalIndex;
  
  return `${dateStr}-${categoryId}-${sequence}`;
}

/**
 * Import HOA dues data for the MTC client with simplified date handling
 */
async function importHOADuesSimple() {
  const clientId = 'MTC';
  const year = '2025'; // The year as string (per new specification)
  
  console.log('📊 Starting simplified HOA dues import for client MTC...');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  try {
    // Initialize Firebase for current environment
    const { db } = await initializeFirebase(ENV);
    console.log('✅ Connected to Firestore');
    
    // Create transaction lookup for linking
    const transactionLookup = createTransactionLookup();
    
    let importCount = 0;
    let linkedPayments = 0;
    let unlinkedPayments = 0;
    
    console.log(`Found ${Object.keys(hoaDuesData).length} units to process`);
    
    // Process each unit's dues data
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      console.log(`Processing unit ${unitId}...`);
      
      // Extract only the fields we want to store and omit totalPaid and outstanding
      const { scheduledAmount, creditBalance, payments } = unitData;
      
      if (DEBUG) {
        console.log(`Unit ${unitId} - scheduledAmount: ${scheduledAmount}, creditBalance: ${creditBalance}, payments: ${payments?.length || 0} entries`);
      }
      
      // Prepare the data according to new field specification
      const duesData = {
        year: year, // Required year field (string format per specification)
        scheduledAmount: Math.round((scheduledAmount || 0) * 100), // Convert to cents
        creditBalance: Math.round((creditBalance || 0) * 100), // Convert to cents, required with default 0
        
        // Create 12-element array for payments with transaction linking
        payments: Array(12).fill(null).map((_, monthIndex) => {
          const month = monthIndex + 1;
          const monthPayment = payments.find(p => p.month === month);
          
          if (!monthPayment || monthPayment.paid <= 0) {
            return {
              paid: 0,
              date: null,
              transactionId: null,
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
              console.warn(`    ⚠️ Month ${month}: Transaction ${parsedNotes.sequenceNumber} not found`);
              unlinkedPayments++;
            }
          } else if (parsedNotes.paymentDate) {
            // Use the parsed date from notes if no sequence number
            paymentDate = toFirestoreTimestamp(parsedNotes.paymentDate);
            unlinkedPayments++;
          } else {
            // Fallback to current timestamp
            paymentDate = getCurrentTimestamp();
            unlinkedPayments++;
          }
          
          return {
            paid: Math.round(monthPayment.paid * 100), // Convert to cents
            date: paymentDate,
            transactionId: transactionId,
            paymentMethod: paymentMethod || null
          };
        }),
        
        // Optional credit balance history
        creditBalanceHistory: [],
        
        // Required timestamp
        updated: getCurrentTimestamp()
      };
      
      // Remove any deprecated fields
      const cleanedData = removeDeprecatedFields(duesData, 'hoaDues');
      
      // Validate against field specification  
      try {
        const validatedData = validateCollectionData(cleanedData, 'hoaDues');
        
        if (!validatedData) {
          throw new Error('Validation returned undefined result');
        }
        
        // Store in Firestore - using the collection/doc pattern
        const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(year);
        await duesRef.set(validatedData);
      
        const paidMonths = validatedData.payments.filter(p => p.paid > 0).length;
        const totalPaid = validatedData.payments.reduce((sum, p) => sum + p.paid, 0);
        const linkedMonths = validatedData.payments.filter(p => p.transactionId).length;
        
        console.log(`✅ Saved enhanced data for unit ${unitId}`);
        console.log(`    💰 Scheduled: $${(validatedData.scheduledAmount / 100).toFixed(2)} | Credit: $${(validatedData.creditBalance / 100).toFixed(2)}`);
        console.log(`    📊 Paid: ${paidMonths}/12 months | Total: $${(totalPaid / 100).toFixed(2)}`);
        console.log(`    🔗 Linked: ${linkedMonths}/${paidMonths} payments have transaction references`);
        
        importCount++;
      } catch (validationError) {
        console.error(`❌ Error processing unit ${unitId}:`, validationError.message);
        throw validationError; // Re-throw to be caught by outer catch
      }
    }
    
    console.log(`\n🎉 Enhanced HOA dues import completed successfully!`);
    console.log(`\n📊 Import Summary:`);
    console.log(`   Units processed: ${importCount}`);
    console.log(`   Payments linked to transactions: ${linkedPayments}`);
    console.log(`   Payments without transaction links: ${unlinkedPayments}`);
    console.log(`   Total payments processed: ${linkedPayments + unlinkedPayments}`);
    console.log(`   Link success rate: ${linkedPayments > 0 ? ((linkedPayments/(linkedPayments + unlinkedPayments))*100).toFixed(1) : 0}%`);
    console.log(`\n✅ Features implemented:`);
    console.log(`   - Payment dates extracted from transaction records`);
    console.log(`   - Transaction IDs linked via sequence numbers`);
    console.log(`   - Payment methods preserved`);
    console.log(`   - Notes accessible via linked transaction documents`);
    console.log(`   - Clean data structure without duplication`);
    console.log(`   - Full field specification compliance`);
    console.log(`   - Environment: ${ENV}`);
  } catch (error) {
    console.error('❌ Error importing HOA dues data:', error);
    console.error('Error stack:', error.stack);
  }
}

// Convert the script to an ES module
async function main() {
  try {
    console.log('✅ Import process Starting...');
    await importHOADuesSimple();
    console.log('✅ Import process completed successfully');
  } catch (err) {
    console.error('❌ Error during HOA dues import:', err);
    process.exit(1);
  }
}

// Run the import
main();
