/**
 * importHOADues.js
 * Imports HOA dues data from JSON into Firestore with date extraction from notes field.
 */
import fs from 'fs';
import path from 'path';
import { getDb, initializeFirebase } from '../backend/firebase.js';

// Enable debug logging
const DEBUG = true;

async function importHOADues() {
  // Initialize Firebase
  await initializeFirebase();
  const db = await getDb();
  
  const clientId = 'MTC';
  const year = 2025; // The year of the data we're importing
  
  // Load the HOA dues data
  const hoaDuesDataPath = path.join(process.cwd(), 'MTCdata', 'HOA_Dues_Export.json');
  console.log(`Reading HOA dues data from: ${hoaDuesDataPath}`);
  const hoaDuesData = JSON.parse(fs.readFileSync(hoaDuesDataPath, 'utf8'));

  if (DEBUG) {
    console.log(`Loaded data for ${Object.keys(hoaDuesData).length} units`);
    console.log(`First unit data sample:`, JSON.stringify(Object.values(hoaDuesData)[0], null, 2).substring(0, 500) + '...');
  }
  
  console.log('📊 Starting HOA dues import for client MTC...');
  
  try {
    let importCount = 0;
    
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
        payments: payments.map(payment => ({
          month: payment.month,
          paid: payment.paid || 0,
      
      // Log the action
      await writeAuditLog({
        module: 'hoa-dues',
/**
 * Import HOA dues data for the MTC client with date extraction from notes
 */
async function importHOADues() { Dues`,
        notes: `Imported HOA dues data for unit ${unitId} for year ${year}`
      });tch (err) {
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
  try {
    console.log('✅ Import process Starting...');
    await importHOADues();
    console.log('✅ Import process completed successfully');
  } catch (err) {
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
