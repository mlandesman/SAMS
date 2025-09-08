/**
 * importHOADuesFixed3.js
 * Imports HOA dues data from JSON into Firestore with enhanced logging
 * and error tracking to identify issues.
 */

import { getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';
import fs from 'fs';
import path from 'path';

// Enable debug logging
const DEBUG = true;

// ANSI color codes for better log visibility
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

console.log(`${colors.blue}🚀 Starting HOA Dues Import Script${colors.reset}`);
console.log(`${colors.cyan}⏱️  Script started at: ${new Date().toISOString()}${colors.reset}`);

// Load the HOA dues data with more robust error handling
let hoaDuesData;
const hoaDuesDataPath = path.join(process.cwd(), 'MTCdata', 'HOA_Dues_Export.json');

console.log(`${colors.cyan}📂 Reading HOA dues data from: ${hoaDuesDataPath}${colors.reset}`);

try {
  const fileContent = fs.readFileSync(hoaDuesDataPath, 'utf8');
  console.log(`${colors.green}✅ File read successful. File size: ${fileContent.length} bytes${colors.reset}`);
  
  try {
    hoaDuesData = JSON.parse(fileContent);
    const unitCount = Object.keys(hoaDuesData).length;
    console.log(`${colors.green}✅ JSON parsing successful. Found ${unitCount} units.${colors.reset}`);
    
    if (unitCount === 0) {
      throw new Error('No units found in the JSON file. Data may be empty or invalid.');
    }
    
    // Log first unit as sample
    const firstUnitId = Object.keys(hoaDuesData)[0];
    console.log(`${colors.cyan}📊 Sample unit data for Unit ${firstUnitId}:`, 
      JSON.stringify(hoaDuesData[firstUnitId], null, 2).substring(0, 300) + '...');
  } catch (parseError) {
    console.error(`${colors.red}❌ Failed to parse JSON data: ${parseError.message}${colors.reset}`);
    console.error(`${colors.yellow}⚠️ First 100 characters of file: ${fileContent.substring(0, 100)}...${colors.reset}`);
    process.exit(1);
  }
} catch (fileError) {
  console.error(`${colors.red}❌ Failed to read file: ${fileError.message}${colors.reset}`);
  console.error(`${colors.yellow}⚠️ Current working directory: ${process.cwd()}${colors.reset}`);
  console.error(`${colors.yellow}⚠️ Does file exist? ${fs.existsSync(hoaDuesDataPath) ? 'Yes' : 'No'}${colors.reset}`);
  process.exit(1);
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
          if (DEBUG) console.warn(`${colors.yellow}⚠️ Invalid date parsed from: ${dateStr}${colors.reset}`);
          return null;
        }
        
        if (DEBUG) {
          console.log(`${colors.green}✓ Successfully parsed date: ${parsedDate.toISOString()} from notes${colors.reset}`);
        }
        
        return parsedDate;
      }
    } catch (err) {
      if (DEBUG) console.warn(`${colors.yellow}⚠️ Could not parse date from: ${match[1]}, error: ${err.message}${colors.reset}`);
    }
  }
  
  return null;
}

/**
 * Import HOA dues data for the MTC client
 */
async function importHOADues() {
  console.log(`${colors.blue}⌛ Initializing HOA dues import...${colors.reset}`);
  
  const clientId = 'MTC';
  const year = 2025; // The year of the data we're importing
  
  console.log(`${colors.blue}🔄 Getting Firestore database connection...${colors.reset}`);
  let db;
  try {
    db = await getDb();
    console.log(`${colors.green}✅ Database connection established successfully.${colors.reset}`);
  } catch (dbError) {
    console.error(`${colors.red}❌ Failed to connect to Firestore: ${dbError.message}${colors.reset}`);
    console.error(dbError);
    return;
  }
  
  console.log(`${colors.blue}📊 Starting HOA dues import for client ${clientId}...${colors.reset}`);
  console.log(`${colors.blue}🗓️ Importing data for year: ${year}${colors.reset}`);
  console.log(`${colors.blue}🏢 Total units to process: ${Object.keys(hoaDuesData).length}${colors.reset}`);
  
  try {
    let importCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let paymentsWithDates = 0;
    let paymentsWithoutDates = 0;
    let batchSize = 10; // Process units in smaller batches for better logging
    let unitIds = Object.keys(hoaDuesData);
    
    // Process units in batches
    for (let i = 0; i < unitIds.length; i += batchSize) {
      let batchUnitIds = unitIds.slice(i, i + batchSize);
      console.log(`${colors.blue}🔄 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(unitIds.length / batchSize)}...${colors.reset}`);
      
      // Process each unit's dues data in the current batch
      for (const unitId of batchUnitIds) {
        const unitData = hoaDuesData[unitId];
        console.log(`${colors.cyan}🏢 Processing unit ${unitId} (${importCount + 1}/${unitIds.length})...${colors.reset}`);
        
        // Extract only the fields we want to store and omit totalPaid and outstanding
        const { scheduledAmount, creditBalance, payments, totalPaid, outstanding, ...otherFields } = unitData;
        
        if (DEBUG) {
          console.log(`${colors.cyan}📄 Unit ${unitId} - scheduledAmount: ${scheduledAmount}, creditBalance: ${creditBalance}, payments: ${payments?.length || 0} entries${colors.reset}`);
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
                console.log(`${colors.green}📅 Extracted date ${paymentDate.toISOString()} from notes for unit ${unitId}, month ${payment.month}${colors.reset}`);
              }
            }
            
            // Count payments with/without dates
            if (paymentDate) {
              paymentsWithDates++;
            } else {
              paymentsWithoutDates++;
              if (payment.paid > 0) {
                console.log(`${colors.yellow}⚠️ Unit ${unitId}, Month ${payment.month} has payment of ${payment.paid} but no date${colors.reset}`);
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
        
        console.log(`${colors.blue}💾 Saving data for unit ${unitId} to Firestore...${colors.reset}`);
        
        try {
          // Log the raw object structure before saving to Firebase
          if (DEBUG) {
            console.log(`${colors.cyan}🔍 Firestore document reference: clients/${clientId}/units/${unitId}/dues/${year}${colors.reset}`);
          }
        
          // Store in Firestore - using the admin SDK pattern
          const duesRef = db.collection('clients').doc(clientId).collection('units').doc(unitId).collection('dues').doc(String(year));
          await duesRef.set(duesData);
          
          // Log success in detail
          console.log(`${colors.green}✅ Successfully saved unit ${unitId} data to Firestore.${colors.reset}`);
          
          // Log the action to audit log
          try {
            await writeAuditLog(
              clientId,
              'hoa-dues',
              'import',
              `Imported HOA dues data for unit ${unitId} for year ${year}`,
              { unitId, year }
            );
            console.log(`${colors.green}✅ Audit log written for unit ${unitId}.${colors.reset}`);
          } catch (auditErr) {
            console.error(`${colors.yellow}⚠️ Failed to write audit log for unit ${unitId}: ${auditErr.message}${colors.reset}`);
          }
          
          successCount++;
        } catch (err) {
          console.error(`${colors.red}❌ Error importing unit ${unitId}:${colors.reset}`, err);
          console.error(`${colors.red}Stack trace: ${err.stack}${colors.reset}`);
          errorCount++;
        }
        
        importCount++;
      }
      
      // Log batch completion
      console.log(`${colors.blue}✓ Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(unitIds.length / batchSize)}${colors.reset}`);
    }
    
    // Summary statistics
    console.log(`${colors.green}🎉 HOA dues import completed!${colors.reset}`);
    console.log(`${colors.cyan}📊 Import Statistics:${colors.reset}`);
    console.log(`${colors.cyan}   - Total units processed: ${importCount}${colors.reset}`);
    console.log(`${colors.cyan}   - Total payments: ${paymentsWithDates + paymentsWithoutDates}${colors.reset}`);
    console.log(`${colors.cyan}   - Payments with dates: ${paymentsWithDates} (${Math.round((paymentsWithDates / (paymentsWithDates + paymentsWithoutDates)) * 100) || 0}%)${colors.reset}`);
    console.log(`${colors.cyan}   - Payments without dates: ${paymentsWithoutDates}${colors.reset}`);
    console.log(`${colors.cyan}   - Success rate: ${Math.round((successCount / importCount) * 100)}%${colors.reset}`);
    
    if (errorCount > 0) {
      console.warn(`${colors.yellow}⚠️ There were ${errorCount} errors during the import.${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Fatal error importing HOA dues data:${colors.reset}`, error);
    console.error(`${colors.red}Stack trace: ${error.stack}${colors.reset}`);
  }
}

// Run the import with comprehensive error handling
console.log(`${colors.blue}🚀 Executing HOA dues import...${colors.reset}`);

importHOADues()
  .then(() => {
    console.log(`${colors.green}✅ Import process completed.${colors.reset}`);
    console.log(`${colors.cyan}⏱️  Script finished at: ${new Date().toISOString()}${colors.reset}`);
  })
  .catch(error => {
    console.error(`${colors.red}❌ Uncaught error in import process:${colors.reset}`, error);
    console.error(`${colors.red}Stack trace: ${error.stack}${colors.reset}`);
    process.exit(1);
  });
