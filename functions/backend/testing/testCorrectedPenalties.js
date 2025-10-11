import { waterDataService } from '../services/waterDataService.js';
import { waterPaymentsService } from '../services/waterPaymentsService.js';

async function testCorrectedPenalties() {
  try {
    console.log('🧪 Testing corrected penalty calculations...');
    
    // 1. Invalidate cache to force fresh calculation
    console.log('🔄 Invalidating cache...');
    waterDataService.invalidate('AVII');
    
    // 2. Get fresh aggregated data
    console.log('📊 Getting fresh aggregated data...');
    const yearData = await waterDataService.getYearData('AVII', 2026);
    
    // 3. Focus on Unit 203 calculations
    const julyData = yearData.months[0]; // July = month 0
    const augustData = yearData.months[1]; // August = month 1
    
    console.log('\n📋 Unit 203 July Bill:');
    const julyUnit = julyData.units['203'];
    if (julyUnit) {
      console.log(`  Monthly Amount: $${julyUnit.billAmount}`);
      console.log(`  Total Amount: $${julyUnit.totalAmount}`);
      console.log(`  Paid Amount: $${julyUnit.paidAmount}`);
      console.log(`  Unpaid Amount: $${julyUnit.unpaidAmount}`);
      console.log(`  Status: ${julyUnit.status}`);
    }
    
    console.log('\n📋 Unit 203 August Bill:');
    const augustUnit = augustData.units['203'];
    if (augustUnit) {
      console.log(`  Consumption: ${augustUnit.consumption} m³`);
      console.log(`  Monthly Amount (should be $${augustUnit.consumption * 50}): $${augustUnit.billAmount}`);
      console.log(`  Previous Balance: $${augustUnit.previousBalance}`);
      console.log(`  Penalty Amount: $${augustUnit.penaltyAmount}`);
      console.log(`  Total Amount: $${augustUnit.totalAmount}`);
      console.log(`  Paid Amount: $${augustUnit.paidAmount}`);
      console.log(`  Status: ${augustUnit.status}`);
    }
    
    // 4. Verify math
    if (augustUnit) {
      const expectedMonthlyCharge = augustUnit.consumption * 50;
      const actualMonthlyCharge = augustUnit.billAmount;
      
      console.log('\n🧮 Math Verification:');
      console.log(`  Expected monthly charge: ${augustUnit.consumption} × $50 = $${expectedMonthlyCharge}`);
      console.log(`  Actual monthly charge: $${actualMonthlyCharge}`);
      console.log(`  Match: ${expectedMonthlyCharge === actualMonthlyCharge ? '✅' : '❌'}`);
    }
    
    // 5. Test unpaid bills summary
    console.log('\n💰 Testing unpaid bills summary...');
    const unpaidSummary = await waterPaymentsService.getUnpaidBillsSummary('AVII', '203');
    console.log('Unpaid bills for Unit 203:', unpaidSummary);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCorrectedPenalties();