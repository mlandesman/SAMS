/**
 * Quick UI Verification
 * 
 * Displays only the essential numbers needed for UI verification
 * in the most concise format possible
 */

import { createApiClient } from './apiClient.js';
import { getStatementData } from '../services/statementDataService.js';

const allUnits = [
  // AVII Units
  { clientId: 'AVII', unitId: '101' },
  { clientId: 'AVII', unitId: '102' },
  { clientId: 'AVII', unitId: '103' },
  { clientId: 'AVII', unitId: '104' },
  { clientId: 'AVII', unitId: '105' },
  { clientId: 'AVII', unitId: '106' },
  { clientId: 'AVII', unitId: '201' },
  { clientId: 'AVII', unitId: '202' },
  { clientId: 'AVII', unitId: '203' },
  { clientId: 'AVII', unitId: '204' },
  // MTC Units
  { clientId: 'MTC', unitId: '1A' },
  { clientId: 'MTC', unitId: '1B' },
  { clientId: 'MTC', unitId: '1C' },
  { clientId: 'MTC', unitId: '2A' },
  { clientId: 'MTC', unitId: '2B' },
  { clientId: 'MTC', unitId: '2C' },
  { clientId: 'MTC', unitId: 'PH1A' },
  { clientId: 'MTC', unitId: 'PH2B' },
  { clientId: 'MTC', unitId: 'PH3C' },
  { clientId: 'MTC', unitId: 'PH4D' }
];

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function runQuickVerification() {
  console.log('='.repeat(70));
  console.log('QUICK UI VERIFICATION - KEY NUMBERS ONLY');
  console.log('='.repeat(70));
  console.log();
  
  try {
    const api = await createApiClient();
    const unitData = [];
    
    // Collect all data
    for (const unit of allUnits) {
      try {
        const data = await getStatementData(api, unit.clientId, unit.unitId);
        unitData.push({
          clientId: unit.clientId,
          unitId: unit.unitId,
          outstanding: data.summary.totalOutstanding,
          paid: data.summary.totalPaid,
          credit: data.creditBalance?.creditBalance || 0,
          hasWaterBills: data.waterBillsRaw && data.waterBillsRaw.length > 0
        });
      } catch (error) {
        console.error(`Error processing ${unit.clientId} ${unit.unitId}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // AVII Summary
    const aviiUnits = unitData.filter(u => u.clientId === 'AVII');
    const aviiTotals = {
      outstanding: aviiUnits.reduce((sum, u) => sum + u.outstanding, 0),
      paid: aviiUnits.reduce((sum, u) => sum + u.paid, 0),
      credit: aviiUnits.reduce((sum, u) => sum + u.credit, 0),
      unitsWithBalance: aviiUnits.filter(u => u.outstanding > 0).length
    };
    
    console.log('AVII CLIENT TOTALS:');
    console.log('─'.repeat(35));
    console.log(`Outstanding:    ${formatCurrency(aviiTotals.outstanding).padStart(15)}`);
    console.log(`Total Paid:     ${formatCurrency(aviiTotals.paid).padStart(15)}`);
    console.log(`Credit Balance: ${formatCurrency(aviiTotals.credit).padStart(15)}`);
    console.log(`Units w/Balance:${aviiTotals.unitsWithBalance.toString().padStart(15)}`);
    console.log();
    
    // MTC Summary
    const mtcUnits = unitData.filter(u => u.clientId === 'MTC');
    const mtcTotals = {
      outstanding: mtcUnits.reduce((sum, u) => sum + u.outstanding, 0),
      paid: mtcUnits.reduce((sum, u) => sum + u.paid, 0),
      credit: mtcUnits.reduce((sum, u) => sum + u.credit, 0),
      unitsWithBalance: mtcUnits.filter(u => u.outstanding > 0).length
    };
    
    console.log('MTC CLIENT TOTALS:');
    console.log('─'.repeat(35));
    console.log(`Outstanding:    ${formatCurrency(mtcTotals.outstanding).padStart(15)}`);
    console.log(`Total Paid:     ${formatCurrency(mtcTotals.paid).padStart(15)}`);
    console.log(`Credit Balance: ${formatCurrency(mtcTotals.credit).padStart(15)}`);
    console.log(`Units w/Balance:${mtcTotals.unitsWithBalance.toString().padStart(15)}`);
    console.log();
    
    // Show units with significant balances
    const significantUnits = unitData
      .filter(u => u.outstanding > 10000 || u.credit > 1000)
      .sort((a, b) => b.outstanding - a.outstanding);
    
    if (significantUnits.length > 0) {
      console.log('SIGNIFICANT BALANCES:');
      console.log('─'.repeat(50));
      console.log('Unit      Outstanding         Credit');
      console.log('─'.repeat(50));
      
      significantUnits.forEach(u => {
        const unit = `${u.clientId} ${u.unitId}`.padEnd(10);
        const outstanding = formatCurrency(u.outstanding).padStart(12);
        const credit = formatCurrency(u.credit).padStart(12);
        console.log(`${unit}${outstanding}    ${credit}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('TO VERIFY IN UI:');
    console.log('1. HOA Dues view should show these outstanding totals');
    console.log('2. Payment modals should show these credit balances');
    console.log('3. Dashboard should reflect these totals');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run verification
runQuickVerification();
