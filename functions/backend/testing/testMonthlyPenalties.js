#!/usr/bin/env node

/**
 * Test Monthly Penalty System
 * Penalties are only applied at billing time, not daily
 */

import { createApiClient } from './apiClient.js';

async function testMonthlyPenalties() {
  console.log('\n📊 MONTHLY PENALTY SYSTEM DEMONSTRATION\n');
  console.log('═'.repeat(100));
  console.log('Penalty Rules:');
  console.log('  • Penalties are ONLY calculated when new bills are generated');
  console.log('  • Each unpaid bill gets 5% penalty per month');
  console.log('  • Compound interest if configured (default: Yes)');
  console.log('  • No daily calculations - avoids payment timing issues');
  console.log('═'.repeat(100));
  
  try {
    const api = await createApiClient();
    
    // Scenario setup
    console.log('\n📅 SCENARIO:\n');
    console.log('July Bills (Month 0):');
    console.log('  • 100-series: PAID ✅');
    console.log('  • 200-series: UNPAID ❌');
    console.log('');
    console.log('August Bills (Month 1):');
    console.log('  • Generated today - July unpaid bills get 5% penalty (1 month overdue)');
    console.log('');
    
    // Show how penalties would be calculated
    console.log('─'.repeat(100));
    console.log('💰 PENALTY CALCULATION AT AUGUST BILLING:\n');
    console.log('─'.repeat(100));
    
    // Example calculations
    const examples = [
      { unit: '201', july: 50, august: 0 },
      { unit: '203', july: 2150, august: 1700 },
      { unit: '204', july: 50, august: 200 }
    ];
    
    console.log('Unit  │ July Bill │ Months Late │ Penalty (5%) │ July Total │ Aug Charge │ TOTAL DUE');
    console.log('──────┼───────────┼─────────────┼──────────────┼────────────┼────────────┼───────────');
    
    let totalJulyBase = 0;
    let totalPenalties = 0;
    let totalAugust = 0;
    let grandTotal = 0;
    
    for (const example of examples) {
      const monthsLate = 1; // July bills are 1 month late when August bills generate
      const penalty = example.july * 0.05 * monthsLate; // Simple 5% per month
      const julyTotal = example.july + penalty;
      const total = julyTotal + example.august;
      
      console.log(
        `${example.unit.padEnd(5)} │` +
        ` $${example.july.toFixed(2).padStart(8)} │` +
        ` ${monthsLate.toString().padStart(11)} │` +
        ` $${penalty.toFixed(2).padStart(11)} │` +
        ` $${julyTotal.toFixed(2).padStart(9)} │` +
        ` $${example.august.toFixed(2).padStart(9)} │` +
        ` $${total.toFixed(2).padStart(9)}`
      );
      
      totalJulyBase += example.july;
      totalPenalties += penalty;
      totalAugust += example.august;
      grandTotal += total;
    }
    
    console.log('──────┴───────────┴─────────────┴──────────────┴────────────┴────────────┴───────────');
    console.log(
      'TOTALS:'.padEnd(7) +
      `$${totalJulyBase.toFixed(2).padStart(8)}`.padEnd(15) +
      ''.padEnd(14) +
      `$${totalPenalties.toFixed(2).padStart(11)}`.padEnd(15) +
      ''.padEnd(13) +
      `$${totalAugust.toFixed(2).padStart(9)}`.padEnd(13) +
      `$${grandTotal.toFixed(2).padStart(9)}`
    );
    
    // Show what happens if they remain unpaid
    console.log('\n─'.repeat(100));
    console.log('📅 IF STILL UNPAID IN SEPTEMBER (Month 2):\n');
    console.log('─'.repeat(100));
    
    console.log('With COMPOUND Interest:');
    console.log('  • July bills: 2 months overdue = Original × (1.05)² = Original × 1.1025 (10.25% total)');
    console.log('  • August bills: 1 month overdue = Original × 1.05 (5% penalty)');
    console.log('');
    
    console.log('Unit 203 Example:');
    console.log('  • July $2,150 × 1.1025 = $2,370.38 (includes $220.38 penalty)');
    console.log('  • August $1,700 × 1.05 = $1,785.00 (includes $85.00 penalty)');
    console.log('  • September new charges: $X');
    console.log('  • Total Due: $4,155.38 + $X');
    
    console.log('\n─'.repeat(100));
    console.log('✅ ADVANTAGES OF MONTHLY CALCULATION:\n');
    console.log('─'.repeat(100));
    console.log('1. **Predictable**: Penalties only change at billing time');
    console.log('2. **No Payment Timing Issues**: Pay anytime during month without daily changes');
    console.log('3. **Clear Communication**: Bills show exact penalty amounts that won\'t change');
    console.log('4. **Simpler Accounting**: Penalties align with billing cycles');
    console.log('5. **Fair**: Everyone gets same penalty regardless of payment processing time');
    
    console.log('\n═'.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testMonthlyPenalties();