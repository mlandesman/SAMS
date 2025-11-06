import { unifiedPaymentWrapper } from '../services/unifiedPaymentWrapper.js';

const result = await unifiedPaymentWrapper.previewUnifiedPayment('AVII', '106', 20000);

console.log('\n=== UNIT 106 VERIFICATION ===');
console.log('Water Bills Paid:', result.water.billsPaid.length);
console.log('Water Total:', result.water.totalPaid);
console.log('\nWater Bills Detail:');
result.water.billsAffected.forEach(b => {
  console.log(`  ${b.billPeriod}: Base $${b.basePaid.toFixed(2)} + Penalty $${b.penaltyPaid.toFixed(2)} = Total $${b.totalPaid.toFixed(2)}`);
});

const expectedTotal = 606.38 + 472.50 + 650.00;
console.log(`\nExpected Total: $${expectedTotal.toFixed(2)}`);
console.log(`Actual Total: $${result.water.totalPaid.toFixed(2)}`);
console.log('Match:', Math.abs(result.water.totalPaid - expectedTotal) < 1 ? '✅ CORRECT' : '❌ WRONG');

console.log('\n=== HOA VERIFICATION ===');
console.log('HOA Bills Paid:', result.hoa.billsPaid.length);
console.log('HOA Total:', result.hoa.totalPaid);

