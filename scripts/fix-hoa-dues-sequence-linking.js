/**
 * Fix HOA Dues Sequence Linking
 * 
 * Correctly links HOA dues payments to transactions using sequence numbers
 * 
 * Task ID: MTC-MIGRATION-001 - Fix HOA Dues Sequence Linking
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

/**
 * Load transaction ID mapping
 */
async function loadTransactionMapping() {
  const mappingData = JSON.parse(await fs.readFile('./scripts/transaction-id-mapping.json', 'utf-8'));
  return mappingData.mapping;
}

/**
 * Extract sequence number from notes
 */
function extractSequenceNumber(notes) {
  if (!notes) return null;
  
  const seqMatch = notes.match(/Seq:\s*(\d+)/);
  return seqMatch ? seqMatch[1] : null;
}

/**
 * Fix HOA dues linking using sequence numbers
 */
async function fixHOADuesLinking() {
  console.log('🔧 Fixing HOA Dues sequence linking...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  // Load transaction mapping
  console.log('📁 Loading transaction mapping...');
  const transactionMapping = await loadTransactionMapping();
  console.log(`✅ Loaded ${Object.keys(transactionMapping).length} transaction mappings`);
  
  // Get all units
  const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
  const unitsSnapshot = await unitsRef.get();
  
  console.log(`\n🏢 Found ${unitsSnapshot.size} units to process`);
  
  const results = {
    unitsProcessed: 0,
    paymentsProcessed: 0,
    paymentsLinked: 0,
    paymentsUnlinked: 0,
    sequenceMatches: 0,
    sequenceMisses: 0,
    errors: []
  };
  
  for (const unitDoc of unitsSnapshot.docs) {
    const unitId = unitDoc.id;
    console.log(`\n🏢 Processing unit ${unitId}...`);
    results.unitsProcessed++;
    
    try {
      // Get dues for 2025
      const duesRef = unitDoc.ref.collection('dues').doc('2025');
      const duesDoc = await duesRef.get();
      
      if (!duesDoc.exists) {
        console.log(`   ⚠️ No dues document found for unit ${unitId}`);
        continue;
      }
      
      const duesData = duesDoc.data();
      const payments = duesData.payments || [];
      
      if (payments.length === 0) {
        console.log(`   ⚠️ No payments found for unit ${unitId}`);
        continue;
      }
      
      console.log(`   📊 Found ${payments.length} payments`);
      results.paymentsProcessed += payments.length;
      
      // Process each payment
      const updatedPayments = payments.map((payment, index) => {
        const sequenceNumber = extractSequenceNumber(payment.notes);
        
        if (sequenceNumber) {
          const transactionId = transactionMapping[sequenceNumber];
          
          if (transactionId) {
            console.log(`   ✅ Payment ${index + 1} (Month ${payment.month}): Seq ${sequenceNumber} → ${transactionId}`);
            results.paymentsLinked++;
            results.sequenceMatches++;
            
            return {
              ...payment,
              transactionId: transactionId,
              sequenceNumber: sequenceNumber
            };
          } else {
            console.log(`   ❌ Payment ${index + 1} (Month ${payment.month}): Seq ${sequenceNumber} not found in mapping`);
            results.sequenceMisses++;
            results.paymentsUnlinked++;
            
            return {
              ...payment,
              sequenceNumber: sequenceNumber,
              transactionId: null // Clear incorrect link
            };
          }
        } else {
          console.log(`   ⚠️ Payment ${index + 1} (Month ${payment.month}): No sequence number found in notes`);
          results.paymentsUnlinked++;
          
          return {
            ...payment,
            transactionId: null // Clear incorrect link
          };
        }
      });
      
      // Update the dues document
      await duesRef.update({
        payments: updatedPayments,
        lastUpdated: new Date()
      });
      
      console.log(`   ✅ Updated dues document for unit ${unitId}`);
      
    } catch (error) {
      console.error(`   ❌ Error processing unit ${unitId}:`, error);
      results.errors.push({
        unit: unitId,
        error: error.message
      });
    }
  }
  
  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 HOA DUES SEQUENCE LINKING FIX SUMMARY');
  console.log('='.repeat(70));
  console.log(`🏢 Units processed: ${results.unitsProcessed}`);
  console.log(`💰 Payments processed: ${results.paymentsProcessed}`);
  console.log(`✅ Payments linked: ${results.paymentsLinked}`);
  console.log(`❌ Payments unlinked: ${results.paymentsUnlinked}`);
  console.log(`🔗 Sequence matches: ${results.sequenceMatches}`);
  console.log(`⚠️ Sequence misses: ${results.sequenceMisses}`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${results.errors.length}`);
    results.errors.forEach(err => {
      console.log(`   ${err.unit}: ${err.error}`);
    });
  }
  
  console.log('\n✅ HOA Dues sequence linking fix completed!');
  console.log('='.repeat(70));
  
  return results;
}

// Execute
fixHOADuesLinking()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });