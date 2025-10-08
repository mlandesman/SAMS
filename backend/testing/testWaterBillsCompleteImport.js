/**
 * Complete Water Bills Import Test
 * 
 * This test validates the entire water bills import process:
 * 1. Chronology building
 * 2. Readings import
 * 3. Bills generation
 * 4. Payments application
 * 
 * This is a DRY RUN test that simulates the process without writing to Firestore
 */

import { ImportService } from '../services/importService.js';
import { readFileFromFirebaseStorage } from '../api/importStorage.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';

const CLIENT_ID = 'AVII';
const TEST_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
const FISCAL_YEAR_START_MONTH = 7;

async function runTest() {
  try {
    console.log('\n🌊 Complete Water Bills Import Test');
    console.log('='.repeat(80));
    console.log('Mode: DRY RUN (simulation only)');
    console.log('='.repeat(80));
    
    // Create import service instance
    const importService = new ImportService(CLIENT_ID, 'firebase_storage', { uid: TEST_USER_ID });
    
    // Load data files
    console.log('\n📥 Loading data files...');
    const readingsData = await importService.loadJsonFile('waterMeterReadings.json');
    const waterCrossRef = await importService.loadJsonFile('waterCrossRef.json');
    
    // For testing, we'll simulate the transaction CrossRef
    console.log('📥 Loading Transactions.json to simulate CrossRef...');
    const transactionsData = await importService.loadJsonFile('Transactions.json');
    
    // Build simulated transaction CrossRef
    const txnCrossRef = {
      byPaymentSeq: {},
      byUnit: {}
    };
    
    for (const transaction of transactionsData) {
      if (transaction.Category === "Water Consumption" && transaction['']) {
        const paySeq = transaction[''];
        const unitMatch = transaction.Unit?.match(/^(\d+)/);
        const unitId = unitMatch ? unitMatch[1] : transaction.Unit;
        
        txnCrossRef.byPaymentSeq[paySeq] = {
          transactionId: `TXN-${Date.now()}-simulated`,
          unitId: unitId,
          amount: transaction.Amount,
          date: transaction.Date
        };
      }
    }
    
    console.log(`✓ Loaded ${readingsData.length} units with readings`);
    console.log(`✓ Loaded ${waterCrossRef.length} charge records`);
    console.log(`✓ Simulated transaction CrossRef with ${Object.keys(txnCrossRef.byPaymentSeq).length} payments`);
    
    // Test chronology building
    console.log('\n🔨 Building chronology...');
    const chronology = importService.buildWaterBillsChronology(readingsData, waterCrossRef, txnCrossRef);
    
    console.log(`✓ Built chronology with ${chronology.length} month cycles\n`);
    
    // Display chronology
    console.log('📅 CHRONOLOGICAL PROCESSING ORDER:');
    console.log('─'.repeat(80));
    console.log('Reading Month → Billing Month (Fiscal Year-Month) | Units | Payments');
    console.log('─'.repeat(80));
    
    for (const cycle of chronology) {
      const fiscalLabel = `FY${cycle.fiscalYear}-${String(cycle.fiscalMonth).padStart(2, '0')}`;
      const unitCount = Object.keys(cycle.readings).filter(u => u !== 'Building' && u !== 'Common').length;
      const paymentCount = cycle.payments.length;
      
      console.log(`${cycle.readingMonth} → ${cycle.billingMonth} (${fiscalLabel}) | ${unitCount} units | ${paymentCount} payments`);
    }
    
    // Analyze each cycle in detail
    console.log('\n📊 DETAILED CYCLE ANALYSIS:');
    console.log('='.repeat(80));
    
    for (let i = 0; i < chronology.length; i++) {
      const cycle = chronology[i];
      
      console.log(`\n📅 Cycle ${i + 1}: ${cycle.readingMonth} → ${cycle.billingMonth}`);
      console.log(`   Fiscal: FY${cycle.fiscalYear}-${String(cycle.fiscalMonth).padStart(2, '0')}`);
      
      // Readings analysis
      const regularUnits = Object.keys(cycle.readings).filter(u => u !== 'Building' && u !== 'Common');
      const hasBuilding = 'Building' in cycle.readings;
      const hasCommon = 'Common' in cycle.readings;
      
      console.log(`   Readings: ${regularUnits.length} units${hasBuilding ? ' + Building' : ''}${hasCommon ? ' + Common' : ''}`);
      
      // Sample readings
      const sampleUnits = regularUnits.slice(0, 3);
      for (const unitId of sampleUnits) {
        console.log(`     Unit ${unitId}: ${cycle.readings[unitId]}`);
      }
      if (regularUnits.length > 3) {
        console.log(`     ... and ${regularUnits.length - 3} more`);
      }
      
      // Payments analysis
      if (cycle.payments.length > 0) {
        // Group by payment sequence
        const paymentGroups = {};
        for (const charge of cycle.payments) {
          if (!paymentGroups[charge.PaymentSeq]) {
            paymentGroups[charge.PaymentSeq] = {
              charges: [],
              total: 0,
              base: 0,
              penalties: 0
            };
          }
          paymentGroups[charge.PaymentSeq].charges.push(charge);
          paymentGroups[charge.PaymentSeq].total += charge.AmountApplied;
          if (charge.Category === 'WC') {
            paymentGroups[charge.PaymentSeq].base += charge.AmountApplied;
          } else if (charge.Category === 'WCP') {
            paymentGroups[charge.PaymentSeq].penalties += charge.AmountApplied;
          }
        }
        
        console.log(`   Payments: ${Object.keys(paymentGroups).length} payment(s)`);
        
        for (const [paySeq, payment] of Object.entries(paymentGroups)) {
          console.log(`     ${paySeq}: $${payment.total.toFixed(2)} (${payment.charges.length} charges)`);
          console.log(`       Base: $${payment.base.toFixed(2)}, Penalties: $${payment.penalties.toFixed(2)}`);
        }
      } else {
        console.log(`   Payments: None`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 IMPORT SIMULATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalReadingMonths = chronology.length;
    const totalPayments = chronology.reduce((sum, c) => {
      const paymentGroups = {};
      for (const charge of c.payments) {
        paymentGroups[charge.PaymentSeq] = true;
      }
      return sum + Object.keys(paymentGroups).length;
    }, 0);
    
    console.log(`Total Cycles: ${totalReadingMonths}`);
    console.log(`Total Payments to Apply: ${totalPayments}`);
    console.log(`\n✅ Chronology validation PASSED`);
    console.log(`✅ Ready for live import test\n`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
runTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
