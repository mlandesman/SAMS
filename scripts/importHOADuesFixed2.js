/**
 * importHOADuesFixed2.js
 * Imports HOA dues data from JSON into Firestore.
 */

import { getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';
import fs from 'fs';
import path from 'path';

// Enable debug logging
const DEBUG = true;

// Load the HOA dues data
const hoaDuesDataPath = path.join(process.cwd(), 'MTCdata', 'HOA_Dues_Export.json');
console.log(`Reading HOA dues data from: ${hoaDuesDataPath}`);
const hoaDuesData = JSON.parse(fs.readFileSync(hoaDuesDataPath, 'utf8'));

if (DEBUG) {
  console.log(`Loaded data for ${Object.keys(hoaDuesData).length} units`);
  console.log(`First unit data sample:`, JSON.stringify(Object.values(hoaDuesData)[0], null, 2).substring(0, 500) + '...');
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
  const clientId = 'MTC';
  const year = 2025; // The year of the data we're importing
  const db = await getDb(); // Use await since getDb is async
  const today = new Date();
  
  console.log('📊 Starting HOA dues import for client MTC...');
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
      
      // Prepare the data to store in Firestore
      const duesData = {
        scheduledAmount,
        creditBalance,
        payments: payments.map(payment => {
          // Try to extract date from notes if no date is provided
          let paymentDate = payment.date ? new Date(payment.date) : null;
          
          if (!paymentDate && payment.notes) {
            paymentDate = extractDateFromNotes(payment.notes);
            if (paymentDate && DEBUG) {
              console.log(`Extracted date ${paymentDate.toISOString()} from notes for unit ${unitId}, month ${payment.month}`);
            }
          }
          
          return {
            month: payment.month,
            paid: payment.paid || 0,
            date: paymentDate,
            notes: payment.notes || ''
          };
        })
      };
      
      // Count payments with and without dates
      duesData.payments.forEach(payment => {
        if (payment.date) {
          paymentsWithDates++;
        } else {
          paymentsWithoutDates++;
        }
      });

      try {
        // Store in Firestore - using the admin SDK pattern
        const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(String(year));
        await duesRef.set(duesData);
        
        // Log the action
        await writeAuditLog(
          clientId,
          'hoa-dues',
          'import',
          `Imported HOA dues data for unit ${unitId} for year ${year}`,
          { unitId, year }
        );
        
        successCount++;
        if (DEBUG) {
          console.log(`✓ Imported unit ${unitId} successfully.`);
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

    console.log(`✅ Successfully imported HOA dues data for ${importCount} units.`);
    console.log(`📊 Import Statistics:`);
    console.log(`   - Total units processed: ${importCount}`);
    console.log(`   - Total payments: ${totalPayments}`);
    console.log(`   - Payments with dates: ${totalWithDates} (${Math.round((totalWithDates / totalPayments) * 100)}%)`);
    console.log(`   - Payments without dates: ${totalPayments - totalWithDates}`);
    console.log(`   - Success rate: ${Math.round((successCount / importCount) * 100)}%`);
    
    if (errorCount > 0) {
      console.warn(`⚠️ There were ${errorCount} errors during the import.`);
    }
  } catch (error) {
    console.error('❌ Error importing HOA dues data:', error);
  }
}

// Run the import
importHOADues().catch(console.error);
