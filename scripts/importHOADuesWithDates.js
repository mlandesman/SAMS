/**
 * importHOADuesWithDates.js
 * Imports HOA dues data from JSON into Firestore with date extraction from notes field.
 * This combines the working structure from Simple with the date extraction from Fixed.
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
        return new Date(dateStr);
      }
    } catch (err) {
      console.warn(`Could not parse date from: ${match[1]}`);
    }
  }
  
  return null;
}

/**
 * Import HOA dues data for the MTC client with date extraction from notes
 */
async function importHOADuesWithDates() {
  const clientId = 'MTC';
  const year = 2025; // The year of the data we're importing
  
  console.log('📊 Starting HOA dues import with date extraction for client MTC...');
  
  try {
    // Get Firestore db - IMPORTANT: await the promise!
    const db = await getDb();
    console.log('✅ Connected to Firestore');
    
    let importCount = 0;
    let dateExtractedCount = 0;
    let dateDefaultedCount = 0;
    const today = new Date(); // Fallback date
    
    console.log(`Found ${Object.keys(hoaDuesData).length} units to process`);
    
    // Process each unit's dues data
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      console.log(`Processing unit ${unitId}...`);
      
      // Extract only the fields we want to store and omit totalPaid and outstanding
      const { scheduledAmount, creditBalance, payments } = unitData;
      
      if (DEBUG) {
        console.log(`Unit ${unitId} - scheduledAmount: ${scheduledAmount}, creditBalance: ${creditBalance}, payments: ${payments?.length || 0} entries`);
      }
      
      // Prepare the data to store in Firestore with date extraction
      const processedPayments = payments.map(payment => {
        // Try to extract date from notes
        const extractedDate = extractDateFromNotes(payment.notes);
        
        if (extractedDate) {
          dateExtractedCount++;
          if (DEBUG) console.log(`✅ Extracted date: ${extractedDate.toISOString()} from notes`);
        } else {
          dateDefaultedCount++;
          if (DEBUG) console.log(`⚠️ Could not extract date from notes, using today's date`);
        }
        
        return {
          month: payment.month,
          paid: payment.paid || 0,
          date: extractedDate || today, // Use extracted date or today as fallback
          notes: payment.notes || ''
        };
      });
      
      const duesData = {
        scheduledAmount,
        creditBalance,
        payments: processedPayments
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
    
    console.log(`
✅ Import Summary:
   - Processed ${importCount} units
   - Extracted dates from ${dateExtractedCount} payments
   - Used default date for ${dateDefaultedCount} payments
    `);
  } catch (error) {
    console.error('❌ Error importing HOA dues data:', error);
    console.error('Error stack:', error.stack);
  }
}

// Convert the script to an ES module
async function main() {
  try {
    console.log('✅ Import process Starting...');
    await importHOADuesWithDates();
    console.log('✅ Import process completed successfully');
  } catch (err) {
    console.error('❌ Error during HOA dues import:', err);
    process.exit(1);
  }
}

// Run the import
main();
