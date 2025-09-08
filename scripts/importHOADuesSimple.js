/**
 * importHOADuesSimple.js
 * Simplified script to import HOA dues data from JSON into Firestore.
 * Uses today's date for all payments to bypass date extraction issues.
 */

import { getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Use require for JSON data
const require = createRequire(import.meta.url);
const hoaDuesData = require('../MTCdata/HOA_Dues_Export.json');

// Enable debug logging
const DEBUG = true;

/**
 * Import HOA dues data for the MTC client with simplified date handling
 */
async function importHOADuesSimple() {
  const clientId = 'MTC';
  const year = 2025; // The year of the data we're importing
  
  console.log('📊 Starting simplified HOA dues import for client MTC...');
  
  try {
    // Get Firestore db - IMPORTANT: await the promise!
    const db = await getDb();
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
      
      // Prepare the data to store in Firestore
      const duesData = {
        scheduledAmount,
        creditBalance,
        payments: payments.map(payment => ({
          month: payment.month,
          paid: payment.paid || 0,
          date: today, // Use today's date for all payments
          notes: payment.notes || ''
        }))
      };
      
      // Store in Firestore - using the collection/doc pattern
      const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(String(year));
      await duesRef.set(duesData);
      console.log(`✅ Saved data for unit ${unitId}`);
      
      // Log the action
      try {
        await writeAuditLog({
          module: 'hoa-dues',
          action: 'import',
          parentPath: `clients/${clientId}/units/${unitId}/dues/${year}`,
          docId: String(year),
          friendlyName: `Unit ${unitId} HOA Dues`,
          notes: `Imported HOA dues data for unit ${unitId} for year ${year}`
        });
      } catch (logError) {
        console.error(`❌ Error writing audit log for unit ${unitId}:`, logError);
      }
      
      importCount++;
    }
    
    console.log(`✅ Successfully imported HOA dues data for ${importCount} units.`);
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
