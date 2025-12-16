/**
 * Check Units 102 and 106 for unpaid bills to select best test unit
 */

import { tokenManager } from './tokenManager.js';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001';
const TEST_CLIENT = 'AVII';
const TEST_UNITS = ['102', '106'];

async function getAuthHeaders() {
  const token = await tokenManager.getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function checkUnit(unitId) {
  console.log(`\n📊 Checking Unit ${unitId}...`);
  
  // Get water bills
  const waterResponse = await fetch(`${BASE_URL}/water/clients/${TEST_CLIENT}/bills/2026`, {
    headers: await getAuthHeaders()
  });
  
  const waterData = await waterResponse.json();
  const months = waterData.data?.months || [];
  
  let unpaidWaterBills = 0;
  let waterDue = 0;
  let waterPenalties = 0;
  
  for (const monthData of months) {
    const unitBill = monthData.units?.[unitId];
    if (unitBill && unitBill.status !== 'paid' && unitBill.unpaidAmount > 0) {
      unpaidWaterBills++;
      waterDue += unitBill.unpaidAmount;
      waterPenalties += unitBill.penaltyAmount || 0;
    }
  }
  
  // Get HOA dues
  const hoaResponse = await fetch(`${BASE_URL}/api/clients/${TEST_CLIENT}/units/${unitId}/hoaDues`, {
    headers: await getAuthHeaders()
  });
  
  let unpaidHOAMonths = 0;
  let hoaDue = 0;
  let hoaPenalties = 0;
  
  if (hoaResponse.ok) {
    const hoaDues = await hoaResponse.json();
    if (hoaDues[2026]?.payments) {
      const payments = hoaDues[2026].payments;
      for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        if (!payment || payment.amount === 0) {
          const monthData = hoaDues[2026].months?.[i];
          if (monthData) {
            unpaidHOAMonths++;
            hoaDue += monthData.baseCharge || 0;
            hoaPenalties += monthData.penaltyAmount || 0;
          }
        }
      }
    }
  }
  
  // Get credit balance
  const creditResponse = await fetch(`${BASE_URL}/credit/${TEST_CLIENT}/${unitId}`, {
    headers: await getAuthHeaders()
  });
  
  let creditBalance = 0;
  if (creditResponse.ok) {
    const creditData = await creditResponse.json();
    creditBalance = creditData.creditBalance || 0;
  }
  
  const totalDue = hoaDue + waterDue;
  const totalPenalties = hoaPenalties + waterPenalties;
  
  return {
    unitId,
    unpaidWaterBills,
    waterDue,
    waterPenalties,
    unpaidHOAMonths,
    hoaDue,
    hoaPenalties,
    totalDue,
    totalPenalties,
    creditBalance,
    hasUnifiedData: unpaidHOAMonths > 0 && unpaidWaterBills > 0
  };
}

async function main() {
  console.log('🔍 Checking test units for unified transaction testing...\n');
  
  const results = [];
  
  for (const unitId of TEST_UNITS) {
    try {
      const result = await checkUnit(unitId);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error checking unit ${unitId}:`, error.message);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('Unit  | HOA Months | HOA $     | HOA Pen   | Water Bills | Water $   | Water Pen | Credit    | Unified?');
  console.log('───────────────────────────────────────────────────────────────────────────────');
  
  for (const r of results) {
    console.log(
      `${r.unitId.padEnd(6)}| ${String(r.unpaidHOAMonths).padEnd(11)}| ` +
      `$${(r.hoaDue / 100).toFixed(2).padStart(8)} | ` +
      `$${(r.hoaPenalties / 100).toFixed(2).padStart(8)} | ` +
      `${String(r.unpaidWaterBills).padEnd(12)}| ` +
      `$${(r.waterDue / 100).toFixed(2).padStart(8)} | ` +
      `$${(r.waterPenalties / 100).toFixed(2).padStart(8)} | ` +
      `$${(r.creditBalance / 100).toFixed(2).padStart(8)} | ` +
      `${r.hasUnifiedData ? '✅ YES' : '❌ NO'}`
    );
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  
  // Find best unit for testing
  const unifiedUnits = results.filter(r => r.hasUnifiedData);
  
  if (unifiedUnits.length === 0) {
    console.log('\n❌ No units found with both HOA and Water bills for unified testing');
    process.exit(1);
  }
  
  // Prefer unit with more total due (more interesting test)
  const bestUnit = unifiedUnits.sort((a, b) => b.totalDue - a.totalDue)[0];
  
  console.log(`\n✅ RECOMMENDED: Unit ${bestUnit.unitId}`);
  console.log(`   HOA: ${bestUnit.unpaidHOAMonths} months, $${(bestUnit.hoaDue / 100).toFixed(2)} + $${(bestUnit.hoaPenalties / 100).toFixed(2)} penalties`);
  console.log(`   Water: ${bestUnit.unpaidWaterBills} bills, $${(bestUnit.waterDue / 100).toFixed(2)} + $${(bestUnit.waterPenalties / 100).toFixed(2)} penalties`);
  console.log(`   Credit: $${(bestUnit.creditBalance / 100).toFixed(2)}`);
  console.log(`   Total Due: $${(bestUnit.totalDue / 100).toFixed(2)}`);
  
  // Suggest payment amount (total due + some extra for credit)
  const suggestedPayment = Math.ceil((bestUnit.totalDue + 10000) / 100) * 100; // Round to nearest $100
  console.log(`\n💡 Suggested payment: $${suggestedPayment} (covers all dues + $100 credit)`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});

