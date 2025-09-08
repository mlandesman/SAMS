/**
 * importHOADuesFixed.js
 * Imports HOA dues data from JSON into Firestore.
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { toFirestoreTimestamp, getCurrentTimestamp } from './utils/timestamp-converter.js';
import { validateCollectionData, removeDeprecatedFields } from './utils/field-validator.js';
import { logImportStart, logImportCompletion, logDocumentImport } from './utils/import-audit-logger.js';
import { createRequire } from 'module';
import fs from 'fs/promises';

// Use require for JSON data
const require = createRequire(import.meta.url);
const hoaDuesData = require('../MTCdata/HOADues.json');

// Load transaction ID mapping
let transactionMapping = {};
try {
  const mappingData = JSON.parse(await fs.readFile('./transaction-id-mapping.json', 'utf-8'));
  transactionMapping = mappingData.mapping || {};
  console.log(`📋 Loaded transaction mapping with ${Object.keys(transactionMapping).length} entries`);
} catch (error) {
  console.warn(`⚠️ Could not load transaction mapping: ${error.message}`);
}

// Environment configuration
const ENV = process.env.FIRESTORE_ENV || 'dev';
const CLIENT_ID = 'MTC';

// Enable debug logging
const DEBUG = true;

if (DEBUG) {
  console.log(`Loaded data for ${Object.keys(hoaDuesData).length} units`);
  console.log(`First unit data sample:`, JSON.stringify(Object.values(hoaDuesData)[0], null, 2).substring(0, 500) + '...');
}

/**
 * Extract sequence number from payment notes
 * Format example: "Seq: 25010" or "Sequence: 25010"
 * @param {string} notes - The payment notes text
 * @returns {string|null} - The extracted sequence number or null if not found
 */
function extractSequenceFromNotes(notes) {
  if (!notes) return null;
  
  // Look for sequence pattern: "Seq: 25010" or "Sequence: 25010"
  const seqRegex = /Seq(?:uence)?:\s*(\d+)/i;
  const match = notes.match(seqRegex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Extract date from payment notes that contain a date string
 * Format example: "Posted: MXN 15,000.00 on Sat Dec 28 2024 13:56:50 GMT-0500 (Eastern Standard Time)"
 * @param {string} notes - The payment notes text
 * @returns {Date|null} - The extracted date or null if not found
 */
function extractDateFromNotes(notes) {
  if (!notes) return null;
  
  // Use regex to extract the date portion between "on" and "GMT"
  const dateRegex = /on\s+(.*?)\s+GMT/;
  const match = notes.match(dateRegex);
  
  if (match && match[1]) {
    try {
      // Extract just the date part without GMT info to avoid timezone issues
      const dateParts = match[1].trim().split(' ');
      
      // Format: Sat Dec 28 2024 13:56:50
      // We need: [Sat, Dec, 28, 2024, 13:56:50]
      if (dateParts.length >= 5) {
        // Reconstruct a parseable date string
        const dateStr = dateParts.slice(0, 5).join(' ');
        const parsedDate = new Date(dateStr);
        
        // Verify the date is valid
        if (isNaN(parsedDate.getTime())) {
          console.warn(`Invalid date parsed from: ${dateStr}`);
          return null;
        }
        
        if (DEBUG) {
          console.log(`Successfully parsed date: ${parsedDate.toISOString()} from notes: ${notes.substring(0, 50)}...`);
        }
        
        return parsedDate;
      }
    } catch (err) {
      console.warn(`Could not parse date from: ${match[1]}, error: ${err.message}`);
    }
  } else if (DEBUG) {
    console.log(`No date match found in notes: ${notes.substring(0, 50)}...`);
  }
  
  return null;
}

/**
 * Import HOA dues data for the MTC client
 */
async function importHOADues() {
  const clientId = CLIENT_ID;
  const year = '2025'; // The year as string (per new specification)
  
  console.log('📊 Starting HOA dues import for client MTC...');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  // Initialize Firebase for current environment
  const { db } = await initializeFirebase(ENV);
  
  // Log import start
  await logImportStart(db, CLIENT_ID, 'hoaDues', {
    totalRecords: Object.keys(hoaDuesData).length,
    source: 'MTCdata/HOADues.json',
    year: year
  });
  
  const today = new Date();
  
  console.log(`🗓️ Importing data for year: ${year}`);
  console.log(`🏢 Total units to process: ${Object.keys(hoaDuesData).length}`);
  
  try {
    let importCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let paymentsWithDates = 0;
    let paymentsWithoutDates = 0;
    
    // Process each unit's dues data
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      console.log(`Processing unit ${unitId}...`);
      
      // Extract only the fields we want to store and omit totalPaid and outstanding
      const { scheduledAmount, creditBalance, payments, totalPaid, outstanding, ...otherFields } = unitData;
      
      if (DEBUG) {
        console.log(`Unit ${unitId} - scheduledAmount: ${scheduledAmount}, creditBalance: ${creditBalance}, payments: ${payments?.length || 0} entries`);
      }
      
      // Prepare the data according to new field specification
      const duesData = {
        year: year, // Required year field (string format per specification)
        scheduledAmount: Math.round((scheduledAmount || 0) * 100), // Convert to cents
        creditBalance: Math.round((creditBalance || 0) * 100), // Convert to cents, required with default 0
        
        // Create 12-element array for payments (per new specification)
        payments: Array(12).fill(null).map((_, index) => {
          const monthPayment = payments.find(p => p.month === index + 1);
          if (monthPayment) {
            // Try to extract date from notes if no date is provided
            let paymentDate = monthPayment.date ? new Date(monthPayment.date) : null;
            
            if (!paymentDate && monthPayment.notes) {
              paymentDate = extractDateFromNotes(monthPayment.notes);
              if (paymentDate && DEBUG) {
                console.log(`Extracted date ${paymentDate.toISOString()} from notes for unit ${unitId}, month ${monthPayment.month}`);
              }
            }
            
            // Extract sequence number and look up transaction ID
            const sequenceNumber = extractSequenceFromNotes(monthPayment.notes);
            const transactionId = sequenceNumber ? transactionMapping[sequenceNumber] : null;
            
            if (sequenceNumber && transactionId && DEBUG) {
              console.log(`  💰 Linked payment for month ${monthPayment.month}: Seq ${sequenceNumber} → Transaction ${transactionId}`);
            } else if (sequenceNumber && !transactionId && DEBUG) {
              console.log(`  ⚠️ Sequence ${sequenceNumber} found but no matching transaction ID`);
            }
            
            return {
              paid: Math.round((monthPayment.paid || 0) * 100), // Convert to cents
              date: paymentDate ? toFirestoreTimestamp(paymentDate) : null,
              transactionId: transactionId || null // Link to corresponding transaction if found, null if not
            };
          } else {
            return {
              paid: 0,
              date: null,
              transactionId: null
            };
          }
        }),
        
        // Optional credit balance history
        creditBalanceHistory: [],
        
        // Required timestamp
        updated: getCurrentTimestamp()
      };
      
      // Remove any deprecated fields
      const cleanedData = removeDeprecatedFields(duesData, 'hoaDues');
      
      // Validate against field specification
      const validatedData = validateCollectionData(cleanedData, 'hoaDues');
      
      // Count payments with and without dates
      validatedData.payments.forEach(payment => {
        if (payment.date) {
          paymentsWithDates++;
        } else {
          paymentsWithoutDates++;
        }
      });

      try {
        // Store in Firestore - using the admin SDK pattern
        const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(year);
        await duesRef.set(validatedData);
        
        // Log individual document import with metadata
        await logDocumentImport(
          db, CLIENT_ID, 'hoaDues', `${unitId}_${year}`,
          unitData, // Original source data
          validatedData, // Final imported data
          `HOA Dues ${unitId} ${year}` // Friendly name
        );
        
        const paidMonths = validatedData.payments.filter(p => p.paid > 0).length;
        const totalPaid = validatedData.payments.reduce((sum, p) => sum + p.paid, 0);
        
        successCount++;
        if (DEBUG) {
          console.log(`✓ Imported unit ${unitId} successfully.`);
          console.log(`    Scheduled Amount: $${(validatedData.scheduledAmount / 100).toFixed(2)}`);
          console.log(`    Credit Balance: $${(validatedData.creditBalance / 100).toFixed(2)}`);
          console.log(`    Paid Months: ${paidMonths}/12`);
          console.log(`    Total Paid: $${(totalPaid / 100).toFixed(2)}`);
        }
      } catch (err) {
        console.error(`❌ Error importing unit ${unitId}:`, err);
        errorCount++;
      }
      
      importCount++;
    }
    
    // Gather statistics
    let totalPayments = 0;
    let totalWithDates = 0;
    Object.values(hoaDuesData).forEach(unitData => {
      if (unitData.payments) {
        totalPayments += unitData.payments.length;
        unitData.payments.forEach(payment => {
          if (payment.date || (payment.notes && extractDateFromNotes(payment.notes))) {
            totalWithDates++;
          }
        });
      }
    });

    // Log import completion
    await logImportCompletion(db, CLIENT_ID, 'hoaDues', {
      success: successCount,
      errors: errorCount,
      total: importCount,
      totalPayments: totalPayments,
      paymentsWithDates: totalWithDates,
      year: year
    });

    console.log(`\n✅ Successfully imported HOA dues data for ${importCount} units.`);
    console.log(`Environment: ${ENV}`);
    console.log(`Data conforms to FIELD_SPECIFICATION_HOA_DUES_FINAL.md`);
    console.log(`All amounts converted to cents as required`);
    console.log(`Payments array has exactly 12 elements as required`);
    console.log(`Import metadata: Stored under clients/${CLIENT_ID}/importMetadata`);
    console.log(`\n📊 Import Statistics:`);
    console.log(`   - Total units processed: ${importCount}`);
    console.log(`   - Total payments: ${totalPayments}`);
    console.log(`   - Payments with dates: ${totalWithDates} (${totalPayments > 0 ? Math.round((totalWithDates / totalPayments) * 100) : 0}%)`);
    console.log(`   - Payments without dates: ${totalPayments - totalWithDates}`);
    console.log(`   - Success rate: ${Math.round((successCount / importCount) * 100)}%`);
    console.log(`   - Audit logs: ${successCount} (via import logger)`);
    
    if (errorCount > 0) {
      console.warn(`⚠️ There were ${errorCount} errors during the import.`);
    }
  } catch (error) {
    console.error('❌ Error importing HOA dues data:', error);
  }
}

// Run the import
importHOADues().catch(console.error);
