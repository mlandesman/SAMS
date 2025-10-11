/**
 * Test script to verify the external APIs work
 */

console.log('🔄 Testing external API connections...');

const BANXICO_TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';

// Test current rates (today)
async function testCurrentRates() {
  try {
    console.log('🌐 Testing Banxico current rates API...');
    const series = ['SF43718', 'SF60632', 'SF46410'];
    const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/oportuno?mediaType=json&token=${BANXICO_TOKEN}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Banxico API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Banxico current rates working');
    console.log('Series count:', data.bmx.series.length);
    
  } catch (error) {
    console.error('❌ Banxico current rates failed:', error.message);
  }
}

// Test historical rates (specific date)
async function testHistoricalRates() {
  try {
    console.log('🌐 Testing Banxico historical rates API...');
    const series = ['SF43718'];
    const testDate = '10/06/2025'; // June 10, 2025 (yesterday)
    const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${series.join(',')}/datos/${testDate}/${testDate}?mediaType=json&token=${BANXICO_TOKEN}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Banxico API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Banxico historical rates working');
    if (data.bmx.series.length > 0 && data.bmx.series[0].datos.length > 0) {
      console.log('Rate for', testDate, ':', data.bmx.series[0].datos[0].dato);
    } else {
      console.log('⚠️ No data for', testDate, '(might be weekend/holiday)');
    }
    
  } catch (error) {
    console.error('❌ Banxico historical rates failed:', error.message);
  }
}

// Test Colombian API
async function testColombianAPI() {
  try {
    console.log('🌐 Testing Colombian government API...');
    const url = 'https://www.datos.gov.co/resource/ceyp-9c7c.json?$order=vigenciadesde DESC&$limit=1';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Colombian API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Colombian API working');
    console.log('Current COP rate:', data[0].valor);
    
  } catch (error) {
    console.error('❌ Colombian API failed:', error.message);
  }
}

// Run all tests
async function runTests() {
  await testCurrentRates();
  await testHistoricalRates();
  await testColombianAPI();
  console.log('🎉 All API tests completed!');
}

runTests();
