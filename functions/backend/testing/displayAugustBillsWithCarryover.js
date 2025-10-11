#!/usr/bin/env node

/**
 * Display August Bills with July Carryover
 * Shows how unpaid July bills affect August statements
 */

import { createApiClient } from './apiClient.js';
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function displayAugustBillsWithCarryover() {
  console.log('\n📊 AUGUST 2025 WATER BILLS - Including July Carryover\n');
  console.log('═'.repeat(120));
  console.log('Scenario: Today is August 12, 2025');
  console.log('July bills: 100-series PAID ✅ | 200-series UNPAID ❌ (12 days overdue)');
  console.log('August bills: Issued August 1st, Due August 10th (2 days overdue if unpaid)');
  console.log('═'.repeat(120));
  
  try {
    const api = await createApiClient();
    const db = await getDb();
    
    // Get config for calculations
    const configDoc = await db
      .collection('clients').doc('AVII')
      .collection('config').doc('waterBills')
      .get();
    
    const config = configDoc.data();
    const penaltyRate = config.penaltyRate || 0.05; // 5% monthly
    const dailyRate = penaltyRate / 30;
    
    // Get July bills to check carryover
    const julyBillsDoc = await db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00')
      .get();
    
    const julyBills = julyBillsDoc.data();
    
    // Get August bills
    const augustBillsDoc = await db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-01')
      .get();
    
    const augustBills = augustBillsDoc.data();
    
    // Calculate carryover amounts for unpaid July bills
    const julyCarryover = {};
    for (const [unitId, bill] of Object.entries(julyBills.bills.units)) {
      if (bill.status === 'unpaid') {
        // July bills are 12 days overdue (issued Aug 1, due Aug 10, today Aug 12)
        const daysOverdue = 12; // From Aug 1 to Aug 12
        const penalty = bill.baseAmount * (Math.pow(1 + dailyRate, daysOverdue) - 1);
        julyCarryover[unitId] = {
          baseAmount: bill.baseAmount,
          penalty: penalty,
          totalDue: bill.baseAmount + penalty,
          daysOverdue: daysOverdue
        };
      }
    }
    
    // Display August bills with carryover
    console.log('\n🗓️  AUGUST 2025 WATER BILLS - Statement Date: August 12, 2025\n');
    console.log('─'.repeat(120));
    console.log('Unit  │ July Balance │ July Penalty │ Aug Reading │ Aug Charge │ Aug Penalty │ TOTAL DUE  │ Status');
    console.log('──────┼──────────────┼──────────────┼─────────────┼────────────┼─────────────┼────────────┼─────────');
    
    let totalJulyCarryover = 0;
    let totalJulyPenalties = 0;
    let totalAugustCharges = 0;
    let totalAugustPenalties = 0;
    let grandTotal = 0;
    
    // Process all units
    const allUnits = new Set([
      ...Object.keys(augustBills.bills.units),
      ...Object.keys(julyCarryover)
    ]);
    
    for (const unitId of Array.from(allUnits).sort()) {
      const augustBill = augustBills.bills.units[unitId] || {};
      const julyBalance = julyCarryover[unitId];
      
      let julyBase = julyBalance ? julyBalance.baseAmount : 0;
      let julyPenalty = julyBalance ? julyBalance.penalty : 0;
      let augustCharge = augustBill.baseAmount || 0;
      let augustPenalty = 0;
      let status = 'Current';
      
      // Calculate August penalty if unpaid (2 days overdue)
      if (augustCharge > 0 && !unitId.startsWith('10')) {
        // 200-series units haven't paid August either
        const augDaysOverdue = 2;
        augustPenalty = augustCharge * (Math.pow(1 + dailyRate, augDaysOverdue) - 1);
        status = 'Overdue';
      } else if (unitId.startsWith('10') && augustCharge > 0) {
        status = 'Current';
      }
      
      // If unit has July balance
      if (julyBalance) {
        status = 'Overdue*';
      }
      
      const totalDue = julyBase + julyPenalty + augustCharge + augustPenalty;
      
      if (augustCharge > 0 || julyBase > 0) {
        console.log(
          `${unitId.padEnd(5)} │` +
          ` ${julyBase > 0 ? '$' + julyBase.toFixed(2).padStart(11) : '-'.padStart(12)} │` +
          ` ${julyPenalty > 0 ? '$' + julyPenalty.toFixed(2).padStart(11) : '-'.padStart(12)} │` +
          ` ${augustBill.consumption !== undefined ? (augustBill.consumption + ' m³').padStart(11) : '-'.padStart(11)} │` +
          ` ${augustCharge > 0 ? '$' + augustCharge.toFixed(2).padStart(10) : '-'.padStart(11)} │` +
          ` ${augustPenalty > 0 ? '$' + augustPenalty.toFixed(2).padStart(10) : '-'.padStart(11)} │` +
          ` $${totalDue.toFixed(2).padStart(9)} │` +
          ` ${status}`
        );
        
        totalJulyCarryover += julyBase;
        totalJulyPenalties += julyPenalty;
        totalAugustCharges += augustCharge;
        totalAugustPenalties += augustPenalty;
        grandTotal += totalDue;
      }
    }
    
    console.log('──────┴──────────────┴──────────────┴─────────────┴────────────┴─────────────┴────────────┴─────────');
    console.log(
      'TOTALS:'.padEnd(7) +
      `$${totalJulyCarryover.toFixed(2).padStart(11)}`.padEnd(15) +
      `$${totalJulyPenalties.toFixed(2).padStart(11)}`.padEnd(15) +
      ''.padEnd(14) +
      `$${totalAugustCharges.toFixed(2).padStart(10)}`.padEnd(14) +
      `$${totalAugustPenalties.toFixed(2).padStart(10)}`.padEnd(14) +
      `$${grandTotal.toFixed(2).padStart(9)}`
    );
    
    // Summary breakdown
    console.log('\n' + '═'.repeat(120));
    console.log('📊 BILLING SUMMARY\n');
    
    console.log('**100-Series Units (Current)**:');
    console.log('  • July: PAID in full');
    console.log('  • August: Current charges only');
    console.log(`  • Total Due: $${
      Object.keys(augustBills.bills.units)
        .filter(id => id.startsWith('10'))
        .reduce((sum, id) => sum + (augustBills.bills.units[id].baseAmount || 0), 0)
        .toFixed(2)
    }`);
    
    console.log('\n**200-Series Units (Overdue)**:');
    console.log('  • July: UNPAID (12 days overdue with compound penalty)');
    console.log('  • August: UNPAID (2 days overdue with compound penalty)');
    console.log(`  • July carryover: $${totalJulyCarryover.toFixed(2)} + $${totalJulyPenalties.toFixed(2)} penalty`);
    console.log(`  • August charges: $${
      Object.keys(augustBills.bills.units)
        .filter(id => id.startsWith('20'))
        .reduce((sum, id) => sum + (augustBills.bills.units[id].baseAmount || 0), 0)
        .toFixed(2)
    } + $${totalAugustPenalties.toFixed(2)} penalty`);
    
    const unit203JulyBase = julyCarryover['203'] ? julyCarryover['203'].baseAmount : 0;
    const unit203JulyPenalty = julyCarryover['203'] ? julyCarryover['203'].penalty : 0;
    const unit203AugBase = augustBills.bills.units['203'] ? augustBills.bills.units['203'].baseAmount : 0;
    const unit203AugPenalty = unit203AugBase * (Math.pow(1 + dailyRate, 2) - 1);
    const unit203Total = unit203JulyBase + unit203JulyPenalty + unit203AugBase + unit203AugPenalty;
    
    console.log('\n**Example: Unit 203 Statement**:');
    console.log('  July Balance:');
    console.log(`    Original: $${unit203JulyBase.toFixed(2)}`);
    console.log(`    Penalty (12 days @ ${(dailyRate * 100).toFixed(4)}% daily): $${unit203JulyPenalty.toFixed(2)}`);
    console.log('  August Charges:');
    console.log(`    Current month: $${unit203AugBase.toFixed(2)}`);
    console.log(`    Penalty (2 days @ ${(dailyRate * 100).toFixed(4)}% daily): $${unit203AugPenalty.toFixed(2)}`);
    console.log(`  **TOTAL DUE: $${unit203Total.toFixed(2)}**`);
    
    console.log('\n**Legend**:');
    console.log('  Current = August charges only, no overdue balance');
    console.log('  Overdue = August charges with penalty (unpaid)');
    console.log('  Overdue* = Has July carryover balance plus August charges');
    
    console.log('\n' + '═'.repeat(120));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the display
displayAugustBillsWithCarryover();