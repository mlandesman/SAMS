#!/usr/bin/env node

import { WaterMeterService } from '../services/waterMeterService.js';

console.log('================================================================================');
console.log('                    DETAILED WATER CALCULATION TEST REPORT                      ');
console.log('================================================================================\n');

const service = new WaterMeterService();

// TEST 1: CALCULATE CONSUMPTION
console.log('TEST 1: calculateConsumption()');
console.log('================================');
console.log('PARAMETERS SENT:');
console.log('  currentReading: 1234.56');
console.log('  previousReading: 1180.00');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateConsumption(1234.56, 1180.00)');
console.log('\nRETURN VALUE:');
const test1Result = service.calculateConsumption(1234.56, 1180.00);
console.log(JSON.stringify(test1Result, null, 2));
console.log('\n---\n');

// TEST 2: METER ROLLOVER
console.log('TEST 2: calculateConsumption() with ROLLOVER');
console.log('==============================================');
console.log('PARAMETERS SENT:');
console.log('  currentReading: 100');
console.log('  previousReading: 9950');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateConsumption(100, 9950)');
console.log('\nRETURN VALUE:');
const test2Result = service.calculateConsumption(100, 9950);
console.log(JSON.stringify(test2Result, null, 2));
console.log('\n---\n');

// TEST 3: HIGH CONSUMPTION
console.log('TEST 3: calculateConsumption() with HIGH CONSUMPTION');
console.log('======================================================');
console.log('PARAMETERS SENT:');
console.log('  currentReading: 1450');
console.log('  previousReading: 1200');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateConsumption(1450, 1200)');
console.log('\nRETURN VALUE:');
const test3Result = service.calculateConsumption(1450, 1200);
console.log(JSON.stringify(test3Result, null, 2));
console.log('\n---\n');

// TEST 4: COMPOUND PENALTY
console.log('TEST 4: applyCompoundPenalty()');
console.log('================================');
console.log('PARAMETERS SENT:');
console.log('  outstandingAmount: 273900 (cents = $2,739.00 MXN)');
console.log('  penaltyRate: 0.05 (5% per month)');
console.log('  monthsLate: 2');
console.log('\nFUNCTION CALLED:');
console.log('  service.applyCompoundPenalty(273900, 0.05, 2)');
console.log('\nRETURN VALUE:');
const test4Result = service.applyCompoundPenalty(273900, 0.05, 2);
console.log(JSON.stringify(test4Result, null, 2));
console.log(`\nIN DOLLARS: penalty=$${test4Result.penalty/100}, total=$${test4Result.totalWithPenalty/100}`);
console.log('\n---\n');

// TEST 5: CREDIT BALANCE
console.log('TEST 5: handleCreditBalance()');
console.log('==============================');
console.log('PARAMETERS SENT:');
console.log('  totalDue: 273900 (cents = $2,739.00 MXN)');
console.log('  creditBalance: 100000 (cents = $1,000.00 MXN)');
console.log('\nFUNCTION CALLED:');
console.log('  service.handleCreditBalance(273900, 100000)');
console.log('\nRETURN VALUE:');
const test5Result = service.handleCreditBalance(273900, 100000);
console.log(JSON.stringify(test5Result, null, 2));
console.log(`\nIN DOLLARS: amountDue=$${test5Result.amountDue/100}, creditUsed=$${test5Result.creditUsed/100}`);
console.log('\n---\n');

// TEST 6: DAYS LATE
console.log('TEST 6: calculateDaysLate()');
console.log('============================');
console.log('PARAMETERS SENT:');
console.log('  dueDate: "2025-08-01"');
console.log('  currentDate: "2025-08-15"');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateDaysLate("2025-08-01", "2025-08-15")');
console.log('\nRETURN VALUE:');
const test6Result = service.calculateDaysLate('2025-08-01', '2025-08-15');
console.log(`  ${test6Result} days`);
console.log('\n---\n');

// TEST 7: WATER CHARGES WITHOUT PENALTY
console.log('TEST 7: calculateWaterCharges() WITHOUT PENALTY');
console.log('=================================================');
console.log('PARAMETERS SENT:');
console.log('  consumption: 54.78 (m³)');
console.log('  config: {');
console.log('    ratePerM3: 5000 (cents = $50.00/m³)');
console.log('    penaltyRate: 0.05 (5%)');
console.log('    penaltyDays: 10');
console.log('  }');
console.log('  daysLate: 5 (within grace period)');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateWaterCharges(54.78, config, 5)');
console.log('\nRETURN VALUE:');
const config = { ratePerM3: 5000, penaltyRate: 0.05, penaltyDays: 10 };
const test7Result = service.calculateWaterCharges(54.78, config, 5);
console.log(JSON.stringify(test7Result, null, 2));
console.log(`\nIN DOLLARS: total=$${test7Result.total/100} MXN`);
console.log('\n---\n');

// TEST 8: WATER CHARGES WITH PENALTY
console.log('TEST 8: calculateWaterCharges() WITH PENALTY');
console.log('==============================================');
console.log('PARAMETERS SENT:');
console.log('  consumption: 54.78 (m³)');
console.log('  config: {');
console.log('    ratePerM3: 5000 (cents = $50.00/m³)');
console.log('    penaltyRate: 0.05 (5%)');
console.log('    penaltyDays: 10');
console.log('  }');
console.log('  daysLate: 15 (after grace period)');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateWaterCharges(54.78, config, 15)');
console.log('\nRETURN VALUE:');
const test8Result = service.calculateWaterCharges(54.78, config, 15);
console.log(JSON.stringify(test8Result, null, 2));
console.log(`\nIN DOLLARS: subtotal=$${test8Result.subtotal/100}, penalty=$${test8Result.penalty/100}, total=$${test8Result.total/100} MXN`);
console.log('\n---\n');

// TEST 9: NEGATIVE READING ERROR
console.log('TEST 9: calculateConsumption() with NEGATIVE READING');
console.log('======================================================');
console.log('PARAMETERS SENT:');
console.log('  currentReading: -10');
console.log('  previousReading: 100');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateConsumption(-10, 100)');
console.log('\nRETURN VALUE:');
try {
  service.calculateConsumption(-10, 100);
  console.log('  ERROR: Should have thrown an error!');
} catch (error) {
  console.log(`  THROWS ERROR: "${error.message}"`);
}
console.log('\n---\n');

// TEST 10: ZERO CONSUMPTION
console.log('TEST 10: calculateConsumption() with ZERO CONSUMPTION');
console.log('=======================================================');
console.log('PARAMETERS SENT:');
console.log('  currentReading: 1000');
console.log('  previousReading: 1000');
console.log('\nFUNCTION CALLED:');
console.log('  service.calculateConsumption(1000, 1000)');
console.log('\nRETURN VALUE:');
const test10Result = service.calculateConsumption(1000, 1000);
console.log(JSON.stringify(test10Result, null, 2));
console.log('\n---\n');

// TEST 11: EXCESS CREDIT
console.log('TEST 11: handleCreditBalance() with EXCESS CREDIT');
console.log('===================================================');
console.log('PARAMETERS SENT:');
console.log('  totalDue: 30000 (cents = $300.00 MXN)');
console.log('  creditBalance: 50000 (cents = $500.00 MXN)');
console.log('\nFUNCTION CALLED:');
console.log('  service.handleCreditBalance(30000, 50000)');
console.log('\nRETURN VALUE:');
const test11Result = service.handleCreditBalance(30000, 50000);
console.log(JSON.stringify(test11Result, null, 2));
console.log(`\nIN DOLLARS: amountDue=$${test11Result.amountDue/100}, creditRemaining=$${test11Result.creditRemaining/100}`);

console.log('\n================================================================================');
console.log('                           END OF DETAILED TEST REPORT                          ');
console.log('================================================================================');