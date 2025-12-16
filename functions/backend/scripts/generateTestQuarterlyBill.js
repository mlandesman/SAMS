#!/usr/bin/env node

/**
 * Generate Test Quarterly Bill for AVII
 * Creates quarterly bills using existing readings (format: YYYY-Q#)
 */

import { getDb } from '../firebase.js';
import waterBillsService from '../services/waterBillsService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

console.log('💰 Generating Test Quarterly Bill for AVII\n');
console.log('═══════════════════════════════════════════════════════════════\n');

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const DUE_DATE = '2025-10-01'; // Oct 1, 2025 (in arrears for Jul-Sep readings)

async function generateTestBill() {
  try {
    await getDb();
    console.log('✅ Connected to Firebase\n');
    
    // Check existing bills
    console.log('📋 Checking for existing quarterly bills...');
    const existingBills = await waterBillsService.getQuarterlyBillsForYear(CLIENT_ID, FISCAL_YEAR);
    console.log(`   Found: ${existingBills.length} quarterly bills\n`);
    
    if (existingBills.length > 0) {
      console.log('⚠️  Quarterly bills already exist:');
      existingBills.forEach(bill => {
        console.log(`   - ${bill._billId} (Q${bill.fiscalQuarter}, Due: ${bill.dueDate})`);
      });
      console.log('');
      console.log('❓ Do you want to generate another quarterly bill?');
      console.log('   This will create the next sequential quarterly bill based on available readings.');
      console.log('');
      console.log('   To proceed, delete existing bills first or modify this script.');
      process.exit(0);
    }
    
    // Check available readings
    console.log('📖 Checking available readings...');
    const db = await getDb();
    const readingsRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    const snapshot = await readingsRef
      .where('year', '==', FISCAL_YEAR)
      .get();
    
    const readingsCount = snapshot.size;
    const months = snapshot.docs.map(doc => doc.data().month).sort((a, b) => a - b);
    
    console.log(`   Found: ${readingsCount} months of readings`);
    console.log(`   Months: ${months.join(', ')}\n`);
    
    if (readingsCount < 3) {
      console.log('❌ Error: Need at least 3 months of readings to generate quarterly bill');
      console.log(`   Current: ${readingsCount} months`);
      console.log('   Add more readings first.');
      process.exit(1);
    }
    
    // Generate the bill
    console.log('💰 Generating quarterly bill...');
    console.log(`   Year: ${FISCAL_YEAR}`);
    console.log(`   Due Date: ${DUE_DATE}`);
    console.log('');
    
    const result = await waterBillsService.generateQuarterlyBill(
      CLIENT_ID,
      FISCAL_YEAR,
      DUE_DATE
    );
    
    console.log('✅ Quarterly bill generated successfully!\n');
    
    // Display bill details
    console.log('📊 Bill Details:');
    console.log('─────────────────────────────────────────');
    console.log(`Bill ID: ${result._billId}`);
    console.log(`Fiscal Year: ${result.fiscalYear}`);
    console.log(`Fiscal Quarter: Q${result.fiscalQuarter}`);
    console.log(`Due Date: ${result.dueDate}`);
    console.log(`Penalty Start: ${result.penaltyStartDate}`);
    console.log(`Billing Period: ${result.billingPeriod}`);
    console.log('');
    
    console.log(`Readings Included: ${result.readingsIncluded?.length || 0} months`);
    if (result.readingsIncluded) {
      result.readingsIncluded.forEach(r => {
        console.log(`  - Month ${r.month} (${r.docId})`);
      });
    }
    console.log('');
    
    console.log('💵 Financial Summary:');
    console.log(`  Total Units: ${result.summary.totalUnits}`);
    console.log(`  Total Billed: $${centavosToPesos(result.summary.totalBilled)}`);
    console.log(`  Total Unpaid: $${centavosToPesos(result.summary.totalUnpaid)}`);
    console.log(`  Currency: ${result.summary.currency}`);
    console.log('');
    
    // Show first unit as example
    const units = result.bills?.units || {};
    const firstUnitId = Object.keys(units)[0];
    if (firstUnitId) {
      const unitBill = units[firstUnitId];
      console.log(`📋 Example Unit (${firstUnitId}):`);
      console.log(`  Total Consumption: ${unitBill.totalConsumption} m³`);
      console.log(`  Water Charge: $${centavosToPesos(unitBill.waterCharge)}`);
      console.log(`  Total Amount: $${centavosToPesos(unitBill.totalAmount)}`);
      console.log(`  Status: ${unitBill.status}`);
      console.log('');
      
      if (unitBill.monthlyBreakdown) {
        console.log('  Monthly Breakdown:');
        unitBill.monthlyBreakdown.forEach(m => {
          console.log(`    Month ${m.month}: ${m.consumption} m³ = $${centavosToPesos(m.waterCharge)}`);
        });
      }
      console.log('');
    }
    
    console.log('✅ Test bill generation complete!');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Run test suite again: node backend/testing/testWaterBillsQuarterlyComplete.js');
    console.log('   2. Test API endpoint: GET /water/clients/AVII/bills/quarterly/2026');
    console.log('   3. View bill in Firestore Console');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error generating test bill:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run generation
generateTestBill();

