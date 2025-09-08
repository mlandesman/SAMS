#!/usr/bin/env node

/**
 * Test Penalty Calculation for Overdue Bills
 * Scenario: 100-series units paid July bills, 200-series did not
 * Today: August 12th (past 10-day grace period)
 */

import { createApiClient } from './apiClient.js';
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function testPenaltyCalculation() {
  console.log('\n📊 WATER BILLS WITH PENALTY CALCULATION\n');
  console.log('═'.repeat(100));
  console.log('Scenario: July bills issued August 1st, Due August 10th');
  console.log('Today: August 12th (2 days past due)');
  console.log('100-series units: PAID ✅');
  console.log('200-series units: UNPAID ❌ (will have penalties)');
  console.log('═'.repeat(100));
  
  try {
    const api = await createApiClient();
    const db = await getDb();
    
    // First, let's mark 100-series units as paid in July bills
    console.log('\n📝 Updating July payment status...');
    
    const julyBillsRef = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00'); // July is month 0
    
    const julyBillsDoc = await julyBillsRef.get();
    
    if (julyBillsDoc.exists) {
      const billsData = julyBillsDoc.data();
      const updatedBills = { ...billsData.bills.units };
      let totalPaid = 0;
      
      // Mark 100-series as paid
      for (const unitId in updatedBills) {
        if (unitId.startsWith('10')) {
          updatedBills[unitId].status = 'paid';
          updatedBills[unitId].paidAmount = updatedBills[unitId].totalAmount;
          totalPaid += updatedBills[unitId].totalAmount;
        }
      }
      
      // Update the document
      await julyBillsRef.update({
        'bills.units': updatedBills,
        'summary.totalPaid': totalPaid,
        'summary.totalUnpaid': billsData.summary.totalBilled - totalPaid
      });
      
      console.log(`✅ Marked 100-series units as paid (Total: $${totalPaid.toFixed(2)})`);
    }
    
    // Now calculate penalties for unpaid bills
    console.log('\n💰 Calculating penalties for overdue bills...\n');
    
    // Get the config for penalty calculation
    const configDoc = await db
      .collection('clients').doc('AVII')
      .collection('config').doc('waterBills')
      .get();
    
    const config = configDoc.data();
    const penaltyRate = config.penaltyRate || 0.05; // 5% monthly
    const compoundPenalty = config.compoundPenalty !== false; // default true
    const penaltyDays = config.penaltyDays || 10;
    
    console.log('Configuration:');
    console.log(`  • Penalty Rate: ${(penaltyRate * 100).toFixed(1)}% monthly`);
    console.log(`  • Compound Interest: ${compoundPenalty ? 'Yes' : 'No'}`);
    console.log(`  • Grace Period: ${penaltyDays} days`);
    console.log('');
    
    // Calculate days overdue (bills issued Aug 1, due Aug 10, today Aug 12)
    const daysOverdue = 2; // Aug 12 - Aug 10
    const monthsOverdue = daysOverdue / 30; // Fractional months for daily compounding
    
    console.log(`Days Overdue: ${daysOverdue} days (${monthsOverdue.toFixed(4)} months)`);
    console.log('');
    
    // Display July bills with penalties
    const response = await api.get('/api/clients/AVII/water/data/2026');
    const julyData = response.data.data.months[0];
    
    console.log('─'.repeat(100));
    console.log('🗓️  JULY 2025 BILLS - With Penalty Calculation\n');
    console.log('─'.repeat(100));
    console.log('Unit  │ Base Amount │ Status   │ Days Late │ Penalty (5%) │ Total Due   │ Notes');
    console.log('──────┼─────────────┼──────────┼───────────┼──────────────┼─────────────┼──────────');
    
    let totalBase = 0;
    let totalPenalties = 0;
    let totalDue = 0;
    
    // Get the updated bills data
    const updatedJulyDoc = await julyBillsRef.get();
    const updatedJulyData = updatedJulyDoc.data();
    
    for (const [unitId, billData] of Object.entries(updatedJulyData.bills.units)) {
      if (billData.baseAmount > 0) {
        const isPaid = billData.status === 'paid';
        let penalty = 0;
        let totalOwed = billData.baseAmount;
        let notes = '';
        
        if (!isPaid) {
          // Calculate penalty
          if (compoundPenalty) {
            // Compound: A = P(1 + r)^t
            // For fractional months: use daily compounding
            const dailyRate = penaltyRate / 30;
            penalty = billData.baseAmount * (Math.pow(1 + dailyRate, daysOverdue) - 1);
          } else {
            // Simple: I = P * r * t
            penalty = billData.baseAmount * penaltyRate * monthsOverdue;
          }
          
          totalOwed = billData.baseAmount + penalty;
          notes = unitId.startsWith('20') ? '⚠️ Overdue' : '';
        } else {
          notes = '✅ PAID';
        }
        
        console.log(
          `${unitId.padEnd(5)} │` +
          ` $${billData.baseAmount.toFixed(2).padStart(10)} │` +
          ` ${(isPaid ? 'PAID' : 'UNPAID').padEnd(8)} │` +
          ` ${(isPaid ? '-' : daysOverdue).toString().padStart(9)} │` +
          ` $${penalty.toFixed(2).padStart(11)} │` +
          ` $${totalOwed.toFixed(2).padStart(10)} │` +
          ` ${notes}`
        );
        
        totalBase += billData.baseAmount;
        if (!isPaid) {
          totalPenalties += penalty;
          totalDue += totalOwed;
        }
      }
    }
    
    console.log('──────┴─────────────┴──────────┴───────────┴──────────────┴─────────────┴──────────');
    console.log(`TOTALS:`.padEnd(14) + 
                `$${totalBase.toFixed(2).padStart(10)}`.padEnd(24) +
                `$${totalPenalties.toFixed(2).padStart(11)}`.padEnd(15) +
                `$${totalDue.toFixed(2).padStart(10)}`);
    
    // Show calculation example for one unit
    console.log('\n📐 PENALTY CALCULATION EXAMPLE - Unit 203 ($2,150.00 base):\n');
    
    const unit203Base = 2150.00;
    const dailyRate = penaltyRate / 30;
    
    if (compoundPenalty) {
      console.log('Using COMPOUND interest formula: A = P(1 + r)^t');
      console.log(`  P (Principal) = $${unit203Base.toFixed(2)}`);
      console.log(`  r (Daily Rate) = ${penaltyRate}/30 = ${(dailyRate * 100).toFixed(4)}% daily`);
      console.log(`  t (Days) = ${daysOverdue}`);
      console.log('');
      console.log(`  Calculation: $${unit203Base.toFixed(2)} × (1.${(dailyRate * 10000).toFixed(0)})^${daysOverdue}`);
      
      const compoundAmount = unit203Base * Math.pow(1 + dailyRate, daysOverdue);
      const compoundPenaltyCalc = compoundAmount - unit203Base;
      
      console.log(`  Total Amount = $${compoundAmount.toFixed(2)}`);
      console.log(`  Penalty = $${compoundPenaltyCalc.toFixed(2)}`);
    } else {
      console.log('Using SIMPLE interest formula: I = P × r × t');
      console.log(`  P (Principal) = $${unit203Base.toFixed(2)}`);
      console.log(`  r (Monthly Rate) = ${(penaltyRate * 100).toFixed(1)}%`);
      console.log(`  t (Time in months) = ${daysOverdue}/30 = ${monthsOverdue.toFixed(4)}`);
      console.log('');
      console.log(`  Penalty = $${unit203Base.toFixed(2)} × ${penaltyRate} × ${monthsOverdue.toFixed(4)}`);
      
      const simplePenalty = unit203Base * penaltyRate * monthsOverdue;
      console.log(`  Penalty = $${simplePenalty.toFixed(2)}`);
      console.log(`  Total Due = $${(unit203Base + simplePenalty).toFixed(2)}`);
    }
    
    console.log('\n═'.repeat(100));
    console.log('📊 SUMMARY\n');
    console.log(`  100-series units (6 units): PAID ✅`);
    console.log(`  200-series units (3 units): UNPAID + ${(penaltyRate * 100).toFixed(1)}% penalty`);
    console.log(`  Total Penalties Generated: $${totalPenalties.toFixed(2)}`);
    console.log(`  Total Outstanding (with penalties): $${totalDue.toFixed(2)}`);
    console.log('\n═'.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testPenaltyCalculation();