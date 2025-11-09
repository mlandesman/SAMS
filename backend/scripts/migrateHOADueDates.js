/**
 * Migration Script: Update existing HOA dues documents with frequency-aware due dates
 * 
 * PHASE 5 TASK 5.1: Migrate existing HOA dues to use frequency-driven due dates
 * 
 * Usage: node backend/scripts/migrateHOADueDates.js [clientId]
 * - With clientId: Migrate specific client
 * - Without: Interactive prompt for client selection
 * 
 * What it does:
 * - Reads client's duesFrequency configuration
 * - Updates all HOA dues documents with correct due dates
 * - For monthly: Each month gets unique due date (1st of that month)
 * - For quarterly: Months 0-2, 3-5, 6-8, 9-11 share due dates
 */

import admin from 'firebase-admin';
import { createDate, toISOString } from '../../shared/services/DateService.js';
import { getDb } from '../firebase.js';
import readline from 'readline';

// Initialize Firebase Admin (using existing initialization from firebase.js)
let db;

/**
 * Calculate frequency-aware due date
 * (Same logic as in hoaDuesController.js)
 */
function calculateFrequencyAwareDueDate(fiscalMonthIndex, fiscalYear, frequency, fiscalYearStartMonth) {
  if (fiscalMonthIndex < 0 || fiscalMonthIndex > 11) {
    throw new Error(`fiscalMonthIndex must be 0-11, got ${fiscalMonthIndex}`);
  }
  
  if (!['monthly', 'quarterly'].includes(frequency)) {
    throw new Error(`Unsupported duesFrequency: ${frequency}. Expected 'monthly' or 'quarterly'.`);
  }
  
  // For monthly, each fiscal month has its own due date
  if (frequency === 'monthly') {
    const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
    const calendarYear = fiscalYear + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
    
    const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
    return toISOString(dueDate);
  }
  
  // For quarterly, months share due dates by quarter
  if (frequency === 'quarterly') {
    const quarterStartFiscalMonth = Math.floor(fiscalMonthIndex / 3) * 3;
    const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) % 12;
    const calendarYear = fiscalYear + Math.floor(((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) / 12);
    
    const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
    return toISOString(dueDate);
  }
  
  throw new Error(`Unsupported frequency: ${frequency}`);
}

/**
 * Migrate HOA due dates for a specific client
 */
async function migrateClientHOADueDates(clientId) {
  console.log(`\n🔄 [MIGRATION] Starting migration for client: ${clientId}`);
  
  try {
    // Get database instance
    if (!db) {
      db = await getDb();
    }
    
    // Get client document
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return { success: false, error: 'Client not found' };
    }
    
    const clientData = clientDoc.data();
    
    // Get configuration
    const duesFrequency = clientData.feeStructure?.duesFrequency || 'monthly';
    const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;
    
    console.log(`   📋 Configuration:`);
    console.log(`      Dues Frequency: ${duesFrequency}`);
    console.log(`      Fiscal Year Start: Month ${fiscalYearStartMonth} (${getMonthName(fiscalYearStartMonth)})`);
    
    if (duesFrequency === 'monthly') {
      console.log(`   ℹ️  Client uses monthly billing - due dates likely already correct`);
      console.log(`   ℹ️  Migration will still run to ensure consistency`);
    }
    
    // Get all units
    const unitsSnapshot = await db.collection('clients').doc(clientId)
      .collection('units').get();
    
    let totalUnits = 0;
    let totalDocs = 0;
    let totalUpdates = 0;
    let errors = [];
    
    console.log(`   📦 Found ${unitsSnapshot.docs.length} unit documents`);
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Skip metadata docs
      if (unitId === 'creditBalances') continue;
      
      totalUnits++;
      
      // Get all dues documents for this unit
      const duesSnapshot = await db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').get();
      
      console.log(`   🏠 Unit ${unitId}: ${duesSnapshot.docs.length} dues document(s)`);
      
      for (const duesDoc of duesSnapshot.docs) {
        const fiscalYear = parseInt(duesDoc.id);
        const data = duesDoc.data();
        
        totalDocs++;
        
        if (!data.payments || !Array.isArray(data.payments)) {
          console.warn(`   ⚠️  Skipping ${unitId}/${fiscalYear} - no payments array`);
          continue;
        }
        
        // Update due dates for each month
        let monthsUpdated = 0;
        const updatedPayments = data.payments.map((payment, monthIndex) => {
          if (!payment) return payment;
          
          const newDueDate = calculateFrequencyAwareDueDate(
            monthIndex,
            fiscalYear,
            duesFrequency,
            fiscalYearStartMonth
          );
          
          // Check if due date changed
          if (payment.dueDate !== newDueDate) {
            monthsUpdated++;
          }
          
          return {
            ...payment,
            dueDate: newDueDate
          };
        });
        
        // Write back to Firestore
        if (monthsUpdated > 0) {
          try {
            await duesDoc.ref.update({ payments: updatedPayments });
            totalUpdates++;
            console.log(`   ✅ Updated ${unitId}/${fiscalYear}: ${monthsUpdated} month(s) updated`);
          } catch (updateError) {
            console.error(`   ❌ Error updating ${unitId}/${fiscalYear}:`, updateError.message);
            errors.push({ unitId, fiscalYear, error: updateError.message });
          }
        } else {
          console.log(`   ⏭️  Skipped ${unitId}/${fiscalYear}: already up-to-date`);
        }
      }
    }
    
    console.log(`\n✅ [MIGRATION] Complete for ${clientId}:`);
    console.log(`   📊 Units processed: ${totalUnits}`);
    console.log(`   📊 Dues documents processed: ${totalDocs}`);
    console.log(`   📊 Documents updated: ${totalUpdates}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${errors.length}`);
      errors.forEach(err => {
        console.log(`   - ${err.unitId}/${err.fiscalYear}: ${err.error}`);
      });
    }
    
    return {
      success: true,
      clientId,
      duesFrequency,
      fiscalYearStartMonth,
      unitsProcessed: totalUnits,
      documentsProcessed: totalDocs,
      documentsUpdated: totalUpdates,
      errors: errors.length
    };
    
  } catch (error) {
    console.error(`❌ [MIGRATION] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get month name from month number (1-12)
 */
function getMonthName(month) {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return names[(month - 1) % 12] || `Month ${month}`;
}

/**
 * Interactive client selection
 */
async function selectClient() {
  if (!db) {
    db = await getDb();
  }
  
  const clientsSnapshot = await db.collection('clients').get();
  const clients = clientsSnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().basicInfo?.displayName || doc.id
  }));
  
  console.log('\n📋 Available clients:');
  clients.forEach((client, index) => {
    console.log(`   ${index + 1}. ${client.name} (${client.id})`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nSelect client number (or press Enter for all): ', (answer) => {
      rl.close();
      
      if (!answer || answer.trim() === '') {
        resolve(clients.map(c => c.id));
      } else {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < clients.length) {
          resolve([clients[index].id]);
        } else {
          console.error('Invalid selection');
          process.exit(1);
        }
      }
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 [MIGRATION] HOA Dues Due Date Migration Script');
  console.log('   Phase 5 Task 5.1: Frequency-aware due dates\n');
  
  try {
    // Get client ID from command line or interactive selection
    let clientIds;
    
    if (process.argv[2]) {
      clientIds = [process.argv[2]];
      console.log(`📌 Migrating specific client: ${clientIds[0]}\n`);
    } else {
      clientIds = await selectClient();
    }
    
    // Migrate each client
    const results = [];
    for (const clientId of clientIds) {
      const result = await migrateClientHOADueDates(clientId);
      results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n✅ Successful: ${successful.length} client(s)`);
    console.log(`❌ Failed: ${failed.length} client(s)`);
    
    if (successful.length > 0) {
      console.log('\nDetails:');
      successful.forEach(r => {
        console.log(`   ${r.clientId}: ${r.documentsUpdated}/${r.documentsProcessed} documents updated (${r.duesFrequency})`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\nErrors:');
      failed.forEach(r => {
        console.log(`   ${r.clientId || 'Unknown'}: ${r.error}`);
      });
    }
    
    process.exit(failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ [MIGRATION] Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateClientHOADueDates, calculateFrequencyAwareDueDate };

