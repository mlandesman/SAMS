#!/usr/bin/env node

/**
 * Enhanced HOA Dues Import with DateService
 * 
 * Imports HOA dues data with proper timezone handling for payment dates
 * Preserves complex date extraction logic from payment notes
 * 
 * Features:
 * - DateService for all date operations
 * - Preserves date extraction from payment notes
 * - Links payments to transactions via sequence numbers
 * - Client-agnostic implementation
 * 
 * Usage:
 *   node import-hoa-dues-enhanced.js <CLIENT_ID> [DATA_PATH]
 * 
 * Created: September 29, 2025
 */

import { 
  dateService, 
  getImportConfig, 
  initializeImport,
  parseDate,
  formatDate,
  getCurrentTimestamp,
  createMigrationMetadata,
  logProgress 
} from './import-config.js';
import { writeAuditLog } from '../../backend/utils/auditLogger.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('❌ Usage: node import-hoa-dues-enhanced.js <CLIENT_ID> [DATA_PATH]');
  process.exit(1);
}

const CLIENT_ID = args[0];
const DATA_PATH = args[1];
const YEAR = new Date().getFullYear();

// Get import configuration
const config = getImportConfig(CLIENT_ID, DATA_PATH);

// Enable debug logging
const DEBUG = process.env.DEBUG === 'true';

/**
 * Extract date from payment notes that contain a date string
 * Format example: "Posted: MXN 15,000.00 on Sat Dec 28 2024 13:56:50 GMT-0500 (Eastern Standard Time)"
 * @param {string} notes - The payment notes text
 * @returns {FirestoreTimestamp|null} - The extracted date or null if not found
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
      if (dateParts.length >= 5) {
        // Reconstruct a parseable date string
        const dateStr = dateParts.slice(0, 5).join(' ');
        
        // Parse using DateService with appropriate format
        const parsedDate = parseDate(dateStr, 'hoaPayment');
        
        if (parsedDate) {
          if (DEBUG) {
            logProgress(`Extracted date from notes: ${formatDate(parsedDate)}`, 'info');
          }
          return parsedDate;
        } else {
          logProgress(`Could not parse date from notes: ${dateStr}`, 'warn');
        }
      }
    } catch (err) {
      logProgress(`Error extracting date from notes: ${err.message}`, 'warn');
    }
  } else if (DEBUG) {
    console.log(`No date match found in notes: ${notes.substring(0, 50)}...`);
  }
  
  return null;
}

/**
 * Load HOA dues data from JSON file
 */
async function loadHOADuesData() {
  logProgress(`Loading HOA dues data from ${config.dataPath}...`, 'info');
  
  const hoaDuesFile = path.join(config.dataPath, 'HOA_Dues_Export.json');
  
  try {
    const hoaDuesData = JSON.parse(await fs.readFile(hoaDuesFile, 'utf-8'));
    const unitCount = Object.keys(hoaDuesData).length;
    
    logProgress(`Loaded HOA dues data for ${unitCount} units`, 'success');
    
    if (DEBUG) {
      const firstUnit = Object.keys(hoaDuesData)[0];
      console.log(`First unit (${firstUnit}) sample:`, 
        JSON.stringify(hoaDuesData[firstUnit], null, 2).substring(0, 500) + '...');
    }
    
    return hoaDuesData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`HOA dues file not found at: ${hoaDuesFile}`);
    }
    throw error;
  }
}

/**
 * Load transaction ID mapping
 */
async function loadTransactionIdMapping() {
  const mappingFile = path.join(config.dataPath, 'transaction-id-mapping.json');
  
  try {
    const mappingData = JSON.parse(await fs.readFile(mappingFile, 'utf-8'));
    logProgress(`Loaded transaction ID mapping with ${mappingData.count} entries`, 'success');
    return mappingData.mapping || {};
  } catch (error) {
    logProgress('No transaction ID mapping found - payments will not be linked', 'warn');
    return {};
  }
}

/**
 * Import HOA dues data
 */
async function importHOADues(hoaDuesData, transactionIdMap) {
  const { db } = await initializeImport(CLIENT_ID);
  
  logProgress(`Starting HOA dues import for year ${YEAR}...`, 'info');
  logProgress(`Total units to process: ${Object.keys(hoaDuesData).length}`, 'info');
  
  const results = {
    importCount: 0,
    successCount: 0,
    errorCount: 0,
    paymentsWithDates: 0,
    paymentsWithoutDates: 0,
    paymentsLinked: 0,
    totalPayments: 0
  };
  
  // Process each unit's dues data
  for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
    try {
      if (DEBUG) {
        console.log(`\nProcessing unit ${unitId}...`);
        console.log(`   Scheduled: $${unitData.scheduledAmount}`);
        console.log(`   Credit Balance: $${unitData.creditBalance}`);
        console.log(`   Payments: ${unitData.payments?.length || 0}`);
      }
      
      // Extract only the fields we want to store
      const { scheduledAmount, creditBalance, payments, totalPaid, outstanding, ...otherFields } = unitData;
      
      // Process payments with proper date handling
      const processedPayments = [];
      if (payments && Array.isArray(payments)) {
        for (const payment of payments) {
          // Try to extract date from notes if no date is provided
          let paymentDate = null;
          
          if (payment.date) {
            // Parse existing date
            paymentDate = parseDate(payment.date, 'transaction');
          }
          
          if (!paymentDate && payment.notes) {
            // Extract from notes
            paymentDate = extractDateFromNotes(payment.notes);
          }
          
          // Extract sequence number from notes for transaction linking
          const seqMatch = payment.notes?.match(/Seq: (\d+)/);
          const sequenceNumber = seqMatch ? seqMatch[1] : null;
          
          // Find linked transaction
          let transactionId = null;
          if (sequenceNumber && transactionIdMap[sequenceNumber]) {
            transactionId = transactionIdMap[sequenceNumber];
            results.paymentsLinked++;
            if (DEBUG) {
              console.log(`   Linked payment seq ${sequenceNumber} to transaction ${transactionId}`);
            }
          }
          
          const processedPayment = {
            month: payment.month,
            paid: payment.paid || 0,
            date: paymentDate,
            notes: payment.notes || '',
            transactionId: transactionId,
            sequenceNumber: sequenceNumber
          };
          
          processedPayments.push(processedPayment);
          
          // Track statistics
          if (paymentDate) {
            results.paymentsWithDates++;
          } else {
            results.paymentsWithoutDates++;
          }
          results.totalPayments++;
        }
      }
      
      // Prepare the data to store in Firestore
      const duesData = {
        scheduledAmount: scheduledAmount || 0,
        creditBalance: creditBalance || 0,
        payments: processedPayments,
        year: YEAR,
        importedAt: getCurrentTimestamp(),
        ...createMigrationMetadata({
          originalUnitId: unitId,
          paymentsCount: processedPayments.length,
          linkedPayments: processedPayments.filter(p => p.transactionId).length
        })
      };
      
      // Store in Firestore
      const duesRef = db.collection('clients').doc(CLIENT_ID)
        .collection('units').doc(unitId)
        .collection('dues').doc(String(YEAR));
      
      await duesRef.set(duesData);
      
      // Log the action
      await writeAuditLog({
        module: 'hoa-dues',
        action: 'import',
        clientId: CLIENT_ID,
        parentPath: `clients/${CLIENT_ID}/units/${unitId}/dues/${YEAR}`,
        docId: String(YEAR),
        friendlyName: `Unit ${unitId} HOA Dues`,
        notes: `Imported HOA dues data for unit ${unitId} for year ${YEAR}`,
        userId: 'import-script-enhanced'
      });
      
      results.successCount++;
      results.importCount++;
      
      if (DEBUG || results.successCount <= 3) {
        logProgress(`Imported unit ${unitId} successfully`, 'success');
      }
      
    } catch (err) {
      logProgress(`Error importing unit ${unitId}: ${err.message}`, 'error');
      results.errorCount++;
      results.importCount++;
    }
  }
  
  return results;
}

/**
 * Verify HOA dues import
 */
async function verifyHOADuesImport(db) {
  logProgress('Verifying HOA dues import...', 'info');
  
  // Sample a few units
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const unitsSnapshot = await unitsRef.limit(5).get();
  
  let totalDuesRecords = 0;
  let unitsWithDues = 0;
  
  for (const unitDoc of unitsSnapshot.docs) {
    const duesRef = unitDoc.ref.collection('dues').doc(String(YEAR));
    const duesDoc = await duesRef.get();
    
    if (duesDoc.exists) {
      unitsWithDues++;
      const duesData = duesDoc.data();
      console.log(`\n   Unit ${unitDoc.id}:`);
      console.log(`      Scheduled: $${duesData.scheduledAmount}`);
      console.log(`      Credit Balance: $${duesData.creditBalance}`);
      console.log(`      Payments: ${duesData.payments?.length || 0}`);
      
      // Check for linked payments
      const linkedPayments = duesData.payments?.filter(p => p.transactionId) || [];
      if (linkedPayments.length > 0) {
        console.log(`      Linked Payments: ${linkedPayments.length}`);
      }
    }
  }
  
  return {
    sampledUnits: unitsSnapshot.size,
    unitsWithDues,
    year: YEAR
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Enhanced HOA Dues Import with DateService...\n');
  console.log('✅ Features:');
  console.log('   - DateService timezone handling (America/Cancun)');
  console.log('   - Payment date extraction from notes');
  console.log('   - Transaction linking via sequence numbers');
  console.log('   - Client-agnostic implementation\n');
  
  const results = {
    timestamp: dateService.formatForFrontend(new Date()).iso,
    timestampDisplay: dateService.formatForFrontend(new Date()).displayFull,
    clientId: CLIENT_ID,
    dataPath: config.dataPath,
    year: YEAR,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Load data
    const hoaDuesData = await loadHOADuesData();
    const transactionIdMap = await loadTransactionIdMapping();
    
    // Import HOA dues
    console.log('\n=== STEP 1: HOA DUES IMPORT ===');
    results.import = await importHOADues(hoaDuesData, transactionIdMap);
    
    // Verify
    console.log('\n=== STEP 2: VERIFICATION ===');
    const { db } = await initializeImport(CLIENT_ID);
    results.verification = await verifyHOADuesImport(db);
    
    // Check success
    results.success = results.import.errorCount === 0;
    
    // Calculate statistics
    const datePercentage = results.import.totalPayments > 0 
      ? Math.round((results.import.paymentsWithDates / results.import.totalPayments) * 100)
      : 0;
    const linkPercentage = results.import.totalPayments > 0
      ? Math.round((results.import.paymentsLinked / results.import.totalPayments) * 100)
      : 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ENHANCED HOA DUES IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Data Path: ${config.dataPath}`);
    console.log(`📅 Year: ${YEAR}`);
    console.log(`⏰ Completed: ${results.timestampDisplay}`);
    console.log(`🕐 Timezone: ${config.timezone}`);
    console.log('');
    console.log('📊 IMPORT STATISTICS:');
    console.log(`   Units processed: ${results.import.importCount}`);
    console.log(`   Successful imports: ${results.import.successCount}`);
    console.log(`   Errors: ${results.import.errorCount}`);
    console.log(`   Total payments: ${results.import.totalPayments}`);
    console.log(`   Payments with dates: ${results.import.paymentsWithDates} (${datePercentage}%)`);
    console.log(`   Payments without dates: ${results.import.paymentsWithoutDates}`);
    console.log(`   Payments linked to transactions: ${results.import.paymentsLinked} (${linkPercentage}%)`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Units sampled: ${results.verification.sampledUnits}`);
    console.log(`   Units with dues data: ${results.verification.unitsWithDues}`);
    
    if (results.success) {
      console.log('\n✅ ENHANCED HOA DUES IMPORT SUCCESSFUL!');
      console.log('🕐 All payment dates preserved in America/Cancun timezone');
      console.log('🔗 Payments linked to transactions where possible');
      console.log('📊 Ready for reporting and reconciliation');
    } else {
      console.log('\n⚠️ HOA DUES IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    logProgress(`Import failed: ${error.message}`, 'error');
    console.error(error);
    results.error = error.message;
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

// Export for testing
export { extractDateFromNotes, loadHOADuesData, importHOADues };