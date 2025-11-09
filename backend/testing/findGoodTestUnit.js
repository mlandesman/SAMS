/**
 * Find a good test unit for unified transaction deletion
 * Criteria:
 * - Has unpaid water bills
 * - Has HOA penalties
 * - Has some credit balance (optional)
 */

import { tokenManager } from './tokenManager.js';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001';
const TEST_CLIENT = 'AVII';

async function getAuthHeaders() {
  const token = await tokenManager.getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function findGoodTestUnit() {
  console.log(`\n🔍 Searching for good test unit in ${TEST_CLIENT}...`);
  
  try {
    // Get water bills data
    console.log(`\n📊 Fetching water bills data...`);
    const waterResponse = await fetch(`${BASE_URL}/water/clients/${TEST_CLIENT}/bills/2026`, {
      headers: await getAuthHeaders()
    });
    
    if (!waterResponse.ok) {
      throw new Error(`Failed to fetch water data: ${waterResponse.status}`);
    }
    
    const waterData = await waterResponse.json();
    const months = waterData.data?.months || [];
    
    // Group bills by unit
    const unitsBills = {};
    for (const monthData of months) {
      const units = monthData.units || {};
      for (const [unitId, bill] of Object.entries(units)) {
        if (!unitsBills[unitId]) {
          unitsBills[unitId] = [];
        }
        unitsBills[unitId].push({
          month: monthData.month,
          year: monthData.year,
          ...bill
        });
      }
    }
    
    console.log(`\n📋 Analyzing ${Object.keys(unitsBills).length} units...`);
    
    // Analyze each unit
    const candidates = [];
    
    for (const [unitId, bills] of Object.entries(unitsBills)) {
      // Count unpaid bills
      const unpaidBills = bills.filter(b => b.status !== 'paid' && b.unpaidAmount > 0);
      const totalWaterDue = unpaidBills.reduce((sum, b) => sum + b.unpaidAmount, 0);
      
      // Check for penalties
      const billsWithPenalties = unpaidBills.filter(b => (b.penaltyAmount || 0) > 0);
      const totalWaterPenalties = billsWithPenalties.reduce((sum, b) => sum + (b.penaltyAmount || 0), 0);
      
      if (unpaidBills.length > 0) {
        // Get HOA data for this unit
        const hoaResponse = await fetch(`${BASE_URL}/api/clients/${TEST_CLIENT}/units/${unitId}/hoaDues`, {
          headers: await getAuthHeaders()
        });
        
        let hoaPenalties = 0;
        let hoaDue = 0;
        
        if (hoaResponse.ok) {
          const hoaDues = await hoaResponse.json();
          
          // Check 2026 dues
          if (hoaDues[2026]?.payments) {
            const payments = hoaDues[2026].payments;
            for (let i = 0; i < payments.length; i++) {
              const payment = payments[i];
              if (!payment || payment.amount === 0) {
                // Unpaid month - check for penalty
                const monthData = hoaDues[2026].months?.[i];
                if (monthData) {
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
        
        const totalDue = hoaDue + totalWaterDue;
        const totalPenalties = hoaPenalties + totalWaterPenalties;
        
        candidates.push({
          unitId,
          unpaidWaterBills: unpaidBills.length,
          waterDue: totalWaterDue,
          waterPenalties: totalWaterPenalties,
          hoaDue,
          hoaPenalties,
          totalDue,
          totalPenalties,
          creditBalance,
          score: unpaidBills.length + (hoaPenalties > 0 ? 10 : 0) + (totalPenalties > 0 ? 5 : 0)
        });
      }
    }
    
    // Sort by score (best candidates first)
    candidates.sort((a, b) => b.score - a.score);
    
    console.log(`\n📊 Top 5 Test Unit Candidates:\n`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('Unit  | Water Bills | Water $   | Water Pen | HOA $     | HOA Pen   | Credit   ');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
      const c = candidates[i];
      console.log(
        `${c.unitId.padEnd(6)}| ${String(c.unpaidWaterBills).padEnd(12)}| ` +
        `$${(c.waterDue / 100).toFixed(2).padStart(8)} | ` +
        `$${(c.waterPenalties / 100).toFixed(2).padStart(8)} | ` +
        `$${(c.hoaDue / 100).toFixed(2).padStart(8)} | ` +
        `$${(c.hoaPenalties / 100).toFixed(2).padStart(8)} | ` +
        `$${(c.creditBalance / 100).toFixed(2).padStart(8)}`
      );
    }
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    if (candidates.length > 0) {
      const best = candidates[0];
      console.log(`\n✅ RECOMMENDED TEST UNIT: ${best.unitId}`);
      console.log(`   - ${best.unpaidWaterBills} unpaid water bills`);
      console.log(`   - $${(best.waterDue / 100).toFixed(2)} water due (${(best.waterPenalties / 100).toFixed(2)} penalties)`);
      console.log(`   - $${(best.hoaDue / 100).toFixed(2)} HOA due (${(best.hoaPenalties / 100).toFixed(2)} penalties)`);
      console.log(`   - $${(best.creditBalance / 100).toFixed(2)} credit balance`);
      console.log(`   - Total Due: $${(best.totalDue / 100).toFixed(2)}`);
      console.log(`   - Total Penalties: $${(best.totalPenalties / 100).toFixed(2)}`);
      
      // Suggest payment amount
      const suggestedAmount = Math.ceil((best.totalDue + 5000) / 100) * 100; // Round up to nearest $100, add $50 for credit
      console.log(`\n💡 Suggested payment amount: $${suggestedAmount} (covers all dues + some credit)`);
      
      return best;
    } else {
      console.log(`\n❌ No suitable test units found`);
      return null;
    }
    
  } catch (error) {
    console.error(`\n❌ Error finding test unit:`, error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the search
findGoodTestUnit()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Search failed:', error);
    process.exit(1);
  });

