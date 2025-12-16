/**
 * Analyze Statement Data Discrepancies
 * 
 * This script helps identify specific types of discrepancies:
 * - Penalty calculation issues
 * - Credit balance mismatches
 * - Payment allocation problems
 * - Date ordering issues
 */

import { createApiClient } from './apiClient.js';
import { getStatementData } from '../services/statementDataService.js';

// Units to analyze based on the statement output
const unitsToAnalyze = [
  // Units with penalties
  { clientId: 'AVII', unitId: '102', notes: 'No payments, has penalties' },
  { clientId: 'AVII', unitId: '103', notes: 'Has credit balance and penalties' },
  { clientId: 'AVII', unitId: '106', notes: 'High outstanding with penalties' },
  
  // Units with credit balances
  { clientId: 'MTC', unitId: 'PH4D', notes: 'High credit balance ($14,400)' },
  { clientId: 'MTC', unitId: '1C', notes: 'Zero balance with credit' },
  
  // Units with negative balances
  { clientId: 'MTC', unitId: '1A', notes: 'Negative final balance' },
  { clientId: 'MTC', unitId: 'PH1A', notes: 'Negative final balance' },
  
  // Units with complex payment patterns
  { clientId: 'AVII', unitId: '204', notes: 'Multiple payments same day' },
  { clientId: 'MTC', unitId: '2B', notes: 'Large advance payments' }
];

async function getApiClient() {
  // Use the createApiClient from apiClient.js which handles authentication
  return await createApiClient();
}

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(date) {
  if (!date) return 'N/A';
  if (typeof date === 'string') return date.split('T')[0];
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

async function analyzeUnit(api, clientId, unitId, notes) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Analyzing ${clientId} - ${unitId}`);
  console.log(`Notes: ${notes}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    // Get statement data
    const data = await getStatementData(api, clientId, unitId);
    
    // Analyze penalties
    console.log('\n🔴 Penalty Analysis:');
    const penalties = data.chronologicalTransactions.filter(t => 
      t.description && (t.description.includes('Penalty') || t.description.includes('penalty'))
    );
    
    if (penalties.length > 0) {
      console.log(`   Found ${penalties.length} penalty entries:`);
      penalties.forEach(p => {
        console.log(`   ${formatDate(p.date)} - ${p.description}: ${formatCurrency(p.charge)}`);
      });
      
      // Check penalty timing
      console.log('\n   Penalty Timing Analysis:');
      penalties.forEach(penalty => {
        const penaltyDate = new Date(penalty.date);
        const penaltyMonth = penaltyDate.getMonth();
        const penaltyDay = penaltyDate.getDate();
        
        // Find related charge
        const relatedCharges = data.chronologicalTransactions.filter(t => {
          if (!t.description || t.type !== 'charge' || t === penalty) return false;
          const desc = penalty.description.toLowerCase();
          
          if (desc.includes('hoa penalty')) {
            return t.description.includes('HOA Dues') && 
                   t.description.includes(penalty.quarter || penalty.month);
          } else if (desc.includes('water penalty')) {
            return t.description.includes('Water Bill');
          }
          return false;
        });
        
        if (relatedCharges.length > 0) {
          relatedCharges.forEach(charge => {
            const chargeDate = new Date(charge.date);
            const daysDiff = Math.floor((penaltyDate - chargeDate) / (1000 * 60 * 60 * 24));
            console.log(`      Penalty for "${charge.description}" applied after ${daysDiff} days`);
          });
        }
      });
    } else {
      console.log('   No penalties found');
    }
    
    // Analyze credit balance
    console.log('\n💰 Credit Balance Analysis:');
    const creditData = data.creditBalance;
    if (creditData && creditData.creditBalance > 0) {
      console.log(`   Current Balance: ${formatCurrency(creditData.creditBalance)}`);
      console.log(`   Last Updated: ${formatDate(creditData.lastUpdated)}`);
      
      // Look for credit-related transactions
      const creditTransactions = data.transactions.filter(t => 
        t.allocations && t.allocations.some(a => a.category === 'credit')
      );
      
      if (creditTransactions.length > 0) {
        console.log(`\n   Credit-related transactions:`);
        creditTransactions.forEach(txn => {
          const creditAllocations = txn.allocations.filter(a => a.category === 'credit');
          creditAllocations.forEach(alloc => {
            console.log(`   ${formatDate(txn.date)} - ${alloc.description}: ${formatCurrency(Math.abs(alloc.amount))}`);
          });
        });
      }
    } else {
      console.log('   No credit balance');
    }
    
    // Analyze payment allocations
    console.log('\n💸 Payment Allocation Analysis:');
    const payments = data.transactions.filter(t => t.type === 'payment');
    
    if (payments.length > 0) {
      console.log(`   Found ${payments.length} payments:`);
      
      // Check for same-day payments
      const paymentsByDate = {};
      payments.forEach(p => {
        const dateKey = formatDate(p.date);
        if (!paymentsByDate[dateKey]) paymentsByDate[dateKey] = [];
        paymentsByDate[dateKey].push(p);
      });
      
      Object.entries(paymentsByDate).forEach(([date, dayPayments]) => {
        if (dayPayments.length > 1) {
          console.log(`\n   ⚠️  Multiple payments on ${date}:`);
          dayPayments.forEach(p => {
            console.log(`      ${formatCurrency(Math.abs(p.amount))} - ${p.description || 'No description'}`);
          });
        }
      });
      
      // Check for overpayments
      payments.forEach(payment => {
        if (payment.allocations) {
          const hasCredit = payment.allocations.some(a => a.category === 'credit');
          if (hasCredit) {
            const creditAmount = payment.allocations
              .filter(a => a.category === 'credit')
              .reduce((sum, a) => sum + Math.abs(a.amount), 0);
            console.log(`\n   💳 Overpayment on ${formatDate(payment.date)}: ${formatCurrency(creditAmount)} to credit`);
          }
        }
      });
    }
    
    // Analyze balance progression
    console.log('\n📈 Balance Progression Analysis:');
    const transactions = data.chronologicalTransactions;
    
    // Find largest balance jumps
    let maxIncrease = { amount: 0, from: null, to: null };
    let maxDecrease = { amount: 0, from: null, to: null };
    
    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1];
      const curr = transactions[i];
      const change = curr.balance - prev.balance;
      
      if (change > maxIncrease.amount) {
        maxIncrease = { amount: change, from: prev, to: curr };
      }
      if (change < maxDecrease.amount) {
        maxDecrease = { amount: change, from: prev, to: curr };
      }
    }
    
    if (maxIncrease.amount > 0) {
      console.log(`   Largest balance increase: ${formatCurrency(maxIncrease.amount)}`);
      console.log(`      From: ${maxIncrease.from.description} (${formatDate(maxIncrease.from.date)})`);
      console.log(`      To:   ${maxIncrease.to.description} (${formatDate(maxIncrease.to.date)})`);
    }
    
    if (maxDecrease.amount < 0) {
      console.log(`   Largest balance decrease: ${formatCurrency(Math.abs(maxDecrease.amount))}`);
      console.log(`      From: ${maxDecrease.from.description} (${formatDate(maxDecrease.from.date)})`);
      console.log(`      To:   ${maxDecrease.to.description} (${formatDate(maxDecrease.to.date)})`);
    }
    
    // Check for negative balances
    const negativeBalances = transactions.filter(t => t.balance < 0);
    if (negativeBalances.length > 0) {
      console.log(`\n   ⚠️  Periods with negative balance: ${negativeBalances.length}`);
      console.log(`      Most negative: ${formatCurrency(Math.min(...negativeBalances.map(t => t.balance)))}`);
    }
    
    // Water bills analysis (for AVII only)
    if (clientId === 'AVII') {
      console.log('\n💧 Water Bills Analysis:');
      const waterCharges = transactions.filter(t => 
        t.description && t.description.includes('Water Bill')
      );
      const waterPayments = transactions.filter(t => 
        t.description && t.description.includes('Water Payment')
      );
      
      console.log(`   Water charges: ${waterCharges.length}`);
      console.log(`   Water payments: ${waterPayments.length}`);
      
      if (waterCharges.length > 0) {
        const totalWaterCharges = waterCharges.reduce((sum, t) => sum + t.charge, 0);
        const totalWaterPayments = waterPayments.reduce((sum, t) => sum + t.payment, 0);
        console.log(`   Total water charged: ${formatCurrency(totalWaterCharges)}`);
        console.log(`   Total water paid: ${formatCurrency(totalWaterPayments)}`);
        console.log(`   Water balance: ${formatCurrency(totalWaterCharges - totalWaterPayments)}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error analyzing ${clientId} ${unitId}:`, error.message);
  }
}

async function runAnalysis() {
  console.log('🔍 Statement Data Discrepancy Analysis');
  console.log('='.repeat(70));
  console.log('Analyzing specific units for common issues\n');
  
  try {
    // Create API client
    const api = await getApiClient();
    
    // Analyze each unit
    for (const unit of unitsToAnalyze) {
      await analyzeUnit(api, unit.clientId, unit.unitId, unit.notes);
      
      // Small delay between units
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Analysis complete!');
    console.log('\nCommon patterns to check:');
    console.log('1. Penalties applied on correct dates (usually 1st of month)');
    console.log('2. Credit balances match overpayment amounts');
    console.log('3. Multiple same-day payments allocated correctly');
    console.log('4. Negative balances indicate overpayments/credits');
    console.log('5. Water bills and payments tracked separately from HOA');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run analysis
runAnalysis();
