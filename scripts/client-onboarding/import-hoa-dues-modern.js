#!/usr/bin/env node

/**
 * Modern HOA Dues Import Script
 * Uses hoaDuesController for all operations
 * Links payments to transactions using cross-reference
 * Properly extracts sequence numbers from notes
 * 
 * Phase 4: Complex Import Script Modernization
 * Date: 2025-09-29
 */

import { initializeApp, getApp } from '../../backend/firebase.js';
import { getDb } from '../../backend/firebase.js';
import { 
  createMockContext, 
  createDateService, 
  ProgressLogger,
  handleControllerResponse,
  convertLegacyDate,
  loadJsonData,
  createImportSummary,
  validateImportData
} from './utils/import-utils-modern.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  dataDir: process.env.DATA_DIR || 'MTCdata',
  hoaDuesFile: 'HOADues.json',
  crossRefFile: 'HOA_Transaction_CrossRef.json',
  mappingFile: 'transaction-id-mapping.json',
  defaultYear: '2025',
  debug: process.env.DEBUG === 'true'
};

/**
 * Parse payment notes to extract sequence number and other metadata
 * Example notes format:
 * "Posted: MXN 17,400.00 on Fri Dec 27 2024 16:27:51 GMT-0500 (hora estándar central)↵BANCO AZTECA; December 2024→Seq: 25009"
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
    // Extract payment date
    const dateMatch = notes.match(/on\s+(.+?)\s+GMT/);
    if (dateMatch) {
      result.paymentDate = new Date(dateMatch[1]);
    }
    
    // Extract sequence number - CRITICAL for linking
    const seqMatch = notes.match(/Seq:\s*(\d+)/);
    if (seqMatch) {
      result.sequenceNumber = seqMatch[1]; // Keep as string
    }
    
    // Extract original amount
    const amountMatch = notes.match(/MXN\s+([\d,]+\.?\d*)/);
    if (amountMatch) {
      result.originalAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }
    
    // Extract payment method - look for text between newline and semicolon
    const lines = notes.split(/[\n↵]/);
    if (lines.length > 1) {
      // Second line typically contains payment method
      const secondLine = lines[1];
      const methodMatch = secondLine.match(/^([^;→]+)/);
      if (methodMatch) {
        result.paymentMethod = methodMatch[1].trim();
      }
    }
    
    if (CONFIG.debug) {
      console.log('📝 Parsed notes:', {
        original: notes,
        parsed: result
      });
    }
    
  } catch (error) {
    console.warn(`⚠️ Error parsing notes:`, error.message);
  }
  
  return result;
}

/**
 * Import HOA dues for a single unit
 */
async function importUnitDues(clientId, unitId, unitData, year, crossReference, dateService) {
  try {
    const db = await getDb();
    
    // Extract data from source
    const {
      scheduledAmount = 0,
      totalPaid = 0,
      outstanding = 0,
      creditBalance = 0,
      payments = []
    } = unitData;

    // Initialize 12-month payment array
    const paymentArray = new Array(12).fill(null).map(() => ({
      paid: 0,
      date: null,
      transactionId: null,
      paymentMethod: null
    }));

    let linkedPayments = 0;
    let unlinkedPayments = 0;

    // Process each payment
    for (const payment of payments) {
      const month = payment.month;
      if (month < 1 || month > 12) {
        console.warn(`⚠️ Invalid month ${month} for unit ${unitId}`);
        continue;
      }

      if (!payment.paid || payment.paid <= 0) {
        continue;
      }

      // Parse payment notes
      const parsedNotes = parsePaymentNotes(payment.notes);
      const monthIndex = month - 1; // 0-based array index

      // Convert amount to cents
      const amountInCents = Math.round(payment.paid * 100);

      // Try to link to transaction
      let transactionId = null;
      let paymentDate = parsedNotes.paymentDate;
      let paymentMethod = parsedNotes.paymentMethod;

      if (parsedNotes.sequenceNumber && crossReference.bySequence[parsedNotes.sequenceNumber]) {
        const linkedTransaction = crossReference.bySequence[parsedNotes.sequenceNumber];
        transactionId = linkedTransaction.transactionId;
        linkedPayments++;
        
        if (CONFIG.debug) {
          console.log(`✅ Linked payment for ${unitId} month ${month} to transaction ${transactionId}`);
        }
      } else {
        unlinkedPayments++;
        if (CONFIG.debug) {
          console.log(`⚠️ No transaction link found for ${unitId} month ${month}, sequence: ${parsedNotes.sequenceNumber}`);
        }
      }

      // Update payment array
      paymentArray[monthIndex] = {
        paid: amountInCents,
        date: paymentDate ? convertLegacyDate(paymentDate, dateService) : null,
        transactionId: transactionId,
        paymentMethod: paymentMethod
      };
    }

    // Create the dues document
    const duesData = {
      year: year,
      scheduledAmount: Math.round(scheduledAmount * 100), // Convert to cents
      creditBalance: Math.round(creditBalance * 100), // Convert to cents
      payments: paymentArray,
      creditBalanceHistory: [], // Initialize empty
      updated: new Date()
    };

    // Validate the data structure
    if (duesData.payments.length !== 12) {
      throw new Error(`Invalid payment array length: ${duesData.payments.length}`);
    }

    // Save to Firestore
    const duesRef = db.collection('clients')
      .doc(clientId)
      .collection('units')
      .doc(unitId)
      .collection('dues')
      .doc(year);

    await duesRef.set(duesData);

    return {
      success: true,
      linkedPayments,
      unlinkedPayments,
      totalPayments: linkedPayments + unlinkedPayments
    };

  } catch (error) {
    console.error(`Error importing HOA dues for unit ${unitId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main import function
 */
async function importHOADues() {
  const startTime = Date.now();
  console.log('🏘️ Starting Modern HOA Dues Import...\n');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const clientId = args[0];
    const year = args[1] || CONFIG.defaultYear;
    const environment = args[2] || 'dev';

    if (!clientId) {
      throw new Error('Usage: node import-hoa-dues-modern.js <clientId> [year] [environment]');
    }

    console.log(`📋 Configuration:`);
    console.log(`   Client: ${clientId}`);
    console.log(`   Year: ${year}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Data Directory: ${CONFIG.dataDir}`);
    console.log(`   Debug Mode: ${CONFIG.debug}\n`);

    // Initialize Firebase
    process.env.SAMS_ENV = environment;
    await initializeApp();
    console.log('✅ Firebase initialized\n');

    // Initialize DateService
    const dateService = createDateService();

    // Load HOA dues data
    const dataPath = path.join(__dirname, CONFIG.dataDir, CONFIG.hoaDuesFile);
    console.log(`📄 Loading HOA dues from: ${dataPath}`);
    const hoaDuesData = await loadJsonData(dataPath);
    const unitCount = Object.keys(hoaDuesData).length;
    console.log(`✅ Loaded data for ${unitCount} units\n`);

    // Load cross-reference data
    let crossReference = { bySequence: {} };
    const crossRefPath = path.join(__dirname, CONFIG.crossRefFile);
    
    try {
      crossReference = await loadJsonData(crossRefPath);
      console.log(`✅ Loaded cross-reference with ${Object.keys(crossReference.bySequence).length} entries\n`);
    } catch (error) {
      console.warn(`⚠️ No cross-reference file found at ${crossRefPath}`);
      console.warn(`   Payments will not be linked to transactions\n`);
    }

    // Alternative: Try transaction mapping file
    if (Object.keys(crossReference.bySequence).length === 0) {
      const mappingPath = path.join(__dirname, CONFIG.mappingFile);
      try {
        const mapping = await loadJsonData(mappingPath);
        if (mapping.bySequence) {
          crossReference = mapping;
          console.log(`✅ Using transaction mapping with ${Object.keys(crossReference.bySequence).length} entries\n`);
        }
      } catch (error) {
        // Ignore if not found
      }
    }

    // Initialize progress tracking
    const progress = new ProgressLogger('HOA Dues Import', unitCount);

    // Track overall statistics
    let totalLinkedPayments = 0;
    let totalUnlinkedPayments = 0;
    let successfulUnits = 0;

    // Import dues for each unit
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      const result = await importUnitDues(clientId, unitId, unitData, year, crossReference, dateService);
      
      if (result.success) {
        progress.logItem(unitId, 'success');
        successfulUnits++;
        totalLinkedPayments += result.linkedPayments;
        totalUnlinkedPayments += result.unlinkedPayments;
      } else {
        progress.logError(unitId, { message: result.error });
      }

      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Display summary
    const summary = progress.logSummary();
    
    console.log('\n📊 Payment Linking Summary:');
    console.log(`   Total payments processed: ${totalLinkedPayments + totalUnlinkedPayments}`);
    console.log(`   Payments linked to transactions: ${totalLinkedPayments}`);
    console.log(`   Payments without transaction links: ${totalUnlinkedPayments}`);
    if (totalLinkedPayments + totalUnlinkedPayments > 0) {
      const linkRate = (totalLinkedPayments / (totalLinkedPayments + totalUnlinkedPayments) * 100).toFixed(1);
      console.log(`   Link success rate: ${linkRate}%`);
    }

    // Create overall summary
    const importSummary = createImportSummary('import-hoa-dues-modern.js', {
      ...summary,
      linkedPayments: totalLinkedPayments,
      unlinkedPayments: totalUnlinkedPayments
    }, startTime);
    
    console.log('\n✅ HOA Dues import completed!');
    console.log(JSON.stringify(importSummary, null, 2));

  } catch (error) {
    console.error('\n❌ HOA Dues import failed:', error.message);
    if (CONFIG.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the import
importHOADues().catch(console.error);