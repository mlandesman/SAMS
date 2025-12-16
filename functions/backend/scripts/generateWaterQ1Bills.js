#!/usr/bin/env node

/**
 * Generate Q1 Water Bills for AVII
 * Creates quarterly bill 2026-Q1 for Jul-Sep (fiscal months 0-2)
 * Due Date: October 1, 2025 (in arrears)
 * 
 * USAGE:
 *   node backend/scripts/generateWaterQ1Bills.js
 * 
 * This script is designed to be run after data reset/reimport
 * to regenerate Q1 bills with proper quarterly structure.
 * 
 * Bill ID Format: YYYY-Q# (e.g., 2026-Q1)
 * Matches HOA Dues naming convention.
 */

import { getDb } from '../firebase.js';
import waterBillsService from '../services/waterBillsService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

console.log('💧 Generating Q1 Water Bills for AVII');
console.log('═══════════════════════════════════════════════════════════════\n');

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const DUE_DATE = '2025-10-01'; // October 1, 2025 (in arrears for Jul-Sep)
const EXPECTED_MONTHS = [0, 1, 2]; // Jul, Aug, Sep

async function generateQ1Bills() {
  try {
    await getDb();
    console.log('✅ Connected to Firebase\n');
    
    // Step 1: Verify config is set to quarterly
    console.log('📋 Step 1: Verify Configuration...');
    const config = await waterBillsService.getBillingConfig(CLIENT_ID);
    
    if (config.billingPeriod !== 'quarterly') {
      console.log('❌ Error: AVII is not configured for quarterly billing');
      console.log(`   Current billingPeriod: ${config.billingPeriod}`);
      console.log('');
      console.log('💡 Run this first: node backend/scripts/updateWaterConfigToQuarterly.js');
      process.exit(1);
    }
    
    console.log('   ✅ Config: quarterly billing, 30-day grace period\n');
    
    // Step 2: Check for existing quarterly bills
    console.log('📋 Step 2: Check for Existing Bills...');
    const existingBills = await waterBillsService.getQuarterlyBillsForYear(CLIENT_ID, FISCAL_YEAR);
    
    if (existingBills.length > 0) {
      console.log(`   ✅ Found ${existingBills.length} existing quarterly bill(s):`);
      existingBills.forEach(bill => {
        const months = bill.readingsIncluded?.map(r => r.label || `month ${r.month}`).join(', ') || 'unknown';
        console.log(`     - ${bill._billId} (Q${bill.fiscalQuarter}, ${months}, due: ${bill.dueDate})`);
        console.log(`       Total: $${centavosToPesos(bill.summary?.totalBilled || 0)}, Units: ${bill.summary?.totalUnits || 0}`);
      });
      console.log('');
      console.log('   💡 Bill already exists. To regenerate:');
      console.log('      node backend/scripts/deleteAndRegenerateQ1.js');
      console.log('');
      process.exit(0);
    }
    
    console.log('   ✅ No existing quarterly bills found\n');
    
    // Step 3: Verify Q1 readings exist (months 0, 1, 2)
    console.log('📋 Step 3: Verify Q1 Readings (Jul-Sep)...');
    const db = await getDb();
    const readingsRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    const snapshot = await readingsRef
      .where('year', '==', FISCAL_YEAR)
      .get();
    
    const availableMonths = {};
    let totalUnits = 0;
    let totalConsumption = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      availableMonths[data.month] = {
        docId: doc.id,
        units: Object.keys(data.readings || {}).length,
        consumption: Object.values(data.readings || {}).reduce((sum, r) => sum + (r.consumption || 0), 0)
      };
    });
    
    console.log('   Available Readings:');
    EXPECTED_MONTHS.forEach(month => {
      const monthNames = ['Jul', 'Aug', 'Sep'];
      if (availableMonths[month]) {
        const info = availableMonths[month];
        console.log(`     ✅ Month ${month} (${monthNames[month]}): ${info.units} units, ${info.consumption} m³`);
        totalUnits = Math.max(totalUnits, info.units);
        totalConsumption += info.consumption;
      } else {
        console.log(`     ❌ Month ${month} (${monthNames[month]}): MISSING`);
      }
    });
    console.log('');
    
    const missingMonths = EXPECTED_MONTHS.filter(m => !availableMonths[m]);
    if (missingMonths.length > 0) {
      console.log(`   ❌ Error: Missing readings for months: ${missingMonths.join(', ')}`);
      console.log('   Please add readings for all Q1 months (Jul, Aug, Sep) before generating bill.');
      console.log('');
      process.exit(1);
    }
    
    if (totalConsumption === 0) {
      console.log('   ⚠️  Warning: Total consumption is 0 for all Q1 months');
      console.log('   The bill will be generated but will have $0 charges.');
      console.log('');
    } else {
      console.log(`   ✅ Q1 Readings Complete: ${totalUnits} units, ${totalConsumption} m³ total\n`);
    }
    
    // Step 4: Generate the bill
    console.log('📋 Step 4: Generate Q1 Bill...');
    console.log(`   Client: ${CLIENT_ID}`);
    console.log(`   Fiscal Year: ${FISCAL_YEAR}`);
    console.log(`   Due Date: ${DUE_DATE} (in arrears)`);
    console.log(`   Months: 0-2 (Jul, Aug, Sep)`);
    console.log('');
    
    console.log('   🔄 Generating bill...');
    const result = await waterBillsService.generateQuarterlyBill(
      CLIENT_ID,
      FISCAL_YEAR,
      DUE_DATE
    );
    
    console.log('   ✅ Bill generated!\n');
    
    // Step 5: Display results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Q1 BILL DETAILS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(`Bill ID: ${result._billId}`);
    console.log(`Fiscal Year: ${result.fiscalYear}`);
    console.log(`Fiscal Quarter: Q${result.fiscalQuarter}`);
    console.log(`Billing Period: ${result.billingPeriod}`);
    console.log('');
    
    console.log(`Due Date: ${result.dueDate}`);
    console.log(`Penalty Start Date: ${result.penaltyStartDate} (30 days after due)`);
    console.log('');
    
    console.log(`Readings Included: ${result.readingsIncluded?.length || 0} months`);
    if (result.readingsIncluded) {
      const monthNames = ['Jul', 'Aug', 'Sep'];
      result.readingsIncluded.forEach(r => {
        console.log(`  - Month ${r.month} (${monthNames[r.month]}) - ${r.docId}`);
      });
    }
    console.log('');
    
    console.log('💰 Financial Summary:');
    console.log(`  Total Units: ${result.summary.totalUnits}`);
    console.log(`  Total Billed: $${centavosToPesos(result.summary.totalBilled)}`);
    console.log(`  Total Unpaid: $${centavosToPesos(result.summary.totalUnpaid)}`);
    console.log(`  Currency: ${result.summary.currency}`);
    console.log('');
    
    // Show sample units
    const units = result.bills?.units || {};
    const unitIds = Object.keys(units);
    
    if (unitIds.length > 0) {
      console.log(`📋 Unit Details (${unitIds.length} total):`);
      console.log('');
      
      // Show first 3 units as examples
      unitIds.slice(0, 3).forEach(unitId => {
        const unitBill = units[unitId];
        console.log(`  Unit ${unitId}:`);
        console.log(`    Total Consumption: ${unitBill.totalConsumption} m³`);
        console.log(`    Water Charge: $${centavosToPesos(unitBill.waterCharge)}`);
        if (unitBill.carWashCharge > 0) {
          console.log(`    Car Wash: $${centavosToPesos(unitBill.carWashCharge)}`);
        }
        if (unitBill.boatWashCharge > 0) {
          console.log(`    Boat Wash: $${centavosToPesos(unitBill.boatWashCharge)}`);
        }
        console.log(`    Total Amount: $${centavosToPesos(unitBill.totalAmount)}`);
        console.log(`    Status: ${unitBill.status}`);
        
        if (unitBill.monthlyBreakdown && unitBill.monthlyBreakdown.length > 0) {
          console.log(`    Monthly Breakdown:`);
          const monthNames = ['Jul', 'Aug', 'Sep'];
          unitBill.monthlyBreakdown.forEach(m => {
            console.log(`      ${monthNames[m.month]}: ${m.consumption} m³ = $${centavosToPesos(m.waterCharge)}`);
          });
        }
        console.log('');
      });
      
      if (unitIds.length > 3) {
        console.log(`  ... and ${unitIds.length - 3} more units`);
        console.log('');
      }
    } else {
      console.log('  ⚠️  No units with charges (consumption may be 0)');
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Q1 BILL GENERATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('🎯 Next Steps:');
    console.log('   1. View bill in Firestore Console:');
    console.log(`      clients/AVII/projects/waterBills/bills/${result._billId}`);
    console.log('');
    console.log('   2. Test the API endpoint:');
    console.log('      GET /water/clients/AVII/bills/quarterly/2026');
    console.log('');
    console.log('   3. View in SAMS UI:');
    console.log('      Water Bills > History Tab (once frontend is updated)');
    console.log('');
    console.log('   4. To generate Q2 bills later (Oct-Dec):');
    console.log('      - Add readings for months 3, 4, 5');
    console.log('      - Run: POST /water/clients/AVII/bills/generate');
    console.log('      - Body: { "year": 2026, "dueDate": "2026-01-01" }');
    console.log('      - Result: 2026-Q2');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error generating Q1 bills:', error.message);
    console.error('');
    
    if (error.message.includes('No new readings')) {
      console.error('💡 This might mean:');
      console.error('   - Readings don\'t exist for months 0-2');
      console.error('   - Readings have incorrect year/month values');
      console.error('   - Bill was already generated previously');
      console.error('');
    }
    
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run generation
generateQ1Bills();

