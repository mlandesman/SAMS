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

// Environment configuration
const ENV = process.env.FIRESTORE_ENV || 'dev';

// Enable debug logging
const DEBUG = true;

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
    
    let importCount = 0;
    const today = new Date(); // Use today's date for all payments
    
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
        
        // Create 12-element array for payments (per new specification)
        payments: Array(12).fill(null).map((_, index) => {
          const monthPayment = payments.find(p => p.month === index + 1);
          return {
            paid: monthPayment ? Math.round((monthPayment.paid || 0) * 100) : 0, // Convert to cents
            date: monthPayment && monthPayment.paid > 0 ? toFirestoreTimestamp(today) : null,
            transactionId: null // No transaction linking in simple import
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
        
        console.log(`✅ Saved data for unit ${unitId}`);
        console.log(`    Scheduled Amount: $${(validatedData.scheduledAmount / 100).toFixed(2)}`);
        console.log(`    Credit Balance: $${(validatedData.creditBalance / 100).toFixed(2)}`);
        console.log(`    Paid Months: ${paidMonths}/12`);
        console.log(`    Total Paid: $${(totalPaid / 100).toFixed(2)}`);
        
        importCount++;
      } catch (validationError) {
        console.error(`❌ Error processing unit ${unitId}:`, validationError.message);
        throw validationError; // Re-throw to be caught by outer catch
      }
    }
    
    console.log(`\n✅ Successfully imported HOA dues data for ${importCount} units.`);
    console.log(`Environment: ${ENV}`);
    console.log(`Data conforms to FIELD_SPECIFICATION_HOA_DUES_FINAL.md`);
    console.log(`All amounts converted to cents as required`);
    console.log(`Payments array has exactly 12 elements as required`);
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
