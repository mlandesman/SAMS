/**
 * Test script to verify exchange rate fallback logic
 * Tests the enhanced checkExchangeRates endpoint
 */

const API_BASE_URL = 'http://localhost:5001';

async function testExchangeRateFallback() {
  console.log('🧪 Testing Exchange Rate Fallback Logic\n');
  
  try {
    console.log('📊 Testing exchange rate endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/exchange-rates/check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Response received:');
    console.log(`   Date: ${result.date}`);
    console.log(`   Exists: ${result.exists}`);
    console.log(`   Current: ${result.current !== false ? 'Yes' : 'No'}`);
    console.log(`   Fallback: ${result.fallback ? 'Yes' : 'No'}`);
    
    if (result.requestedDate) {
      console.log(`   Requested Date: ${result.requestedDate}`);
    }
    
    if (result.data && result.data.rates) {
      console.log('\n💱 Rate Information:');
      const rates = result.data.rates;
      
      if (rates.MXN_USD) {
        const usdToMxn = rates.MXN_USD.originalRate || (1 / rates.MXN_USD.rate);
        console.log(`   USD to MXN: ${usdToMxn.toFixed(4)}`);
        console.log(`   Source: ${rates.MXN_USD.source}`);
      }
      
      if (rates.MXN_CAD) {
        const cadToMxn = rates.MXN_CAD.originalRate || (1 / rates.MXN_CAD.rate);
        console.log(`   CAD to MXN: ${cadToMxn.toFixed(4)}`);
      }
      
      if (rates.MXN_EUR) {
        const eurToMxn = rates.MXN_EUR.originalRate || (1 / rates.MXN_EUR.rate);
        console.log(`   EUR to MXN: ${eurToMxn.toFixed(4)}`);
      }
      
      if (rates.MXN_COP) {
        console.log(`   MXN to COP: ${rates.MXN_COP.rate.toFixed(4)}`);
      }
    }
    
    console.log('\n🔍 Analysis:');
    if (result.exists) {
      if (result.fallback) {
        console.log('✅ SUCCESS: Fallback logic working - returned most recent rate');
        console.log(`   Using rate from ${result.date} instead of today`);
      } else {
        console.log('✅ SUCCESS: Current rate available - no fallback needed');
      }
    } else {
      console.log('⚠️  WARNING: No exchange rates found at all');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure the backend server is running on port 5001');
    }
  }
}

// Run the test
testExchangeRateFallback();