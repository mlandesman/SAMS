const admin = require('firebase-admin');
const WaterDataService = require('./backend/services/waterDataService');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey-prod.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://sams-hoa-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();

async function testAggregator() {
  console.log('🧪 Testing Water Data Aggregator...\n');
  
  const waterDataService = new WaterDataService(db);
  
  try {
    // Test with AVII client, FY 2026, Month 1 (August)
    console.log('📊 Fetching aggregated data for AVII FY2026...\n');
    const result = await waterDataService.buildYearData('AVII', 2026);
    
    console.log('\n✅ Aggregator returned successfully!\n');
    console.log('📋 Summary:');
    console.log(`   Total months: ${result.months.length}`);
    console.log(`   Car wash rate: $${result.carWashRate}`);
    console.log(`   Boat wash rate: $${result.boatWashRate}\n`);
    
    // Check first 3 months for timestamp data
    console.log('🔍 Checking timestamp data in first 3 months:\n');
    for (let i = 0; i < Math.min(3, result.months.length); i++) {
      const month = result.months[i];
      console.log(`Month ${i} (${month.monthName}):`);
      console.log(`  readingDate: ${month.readingDate}`);
      console.log(`  readingDate type: ${typeof month.readingDate}`);
      console.log(`  readingDate is Date: ${month.readingDate instanceof Date}`);
      console.log(`  priorReadingDate: ${month.priorReadingDate}`);
      console.log(`  priorReadingDate type: ${typeof month.priorReadingDate}`);
      console.log(`  priorReadingDate is Date: ${month.priorReadingDate instanceof Date}`);
      
      if (month.readingDate) {
        console.log(`  readingDate formatted: ${month.readingDate.toISOString ? month.readingDate.toISOString() : 'NOT A DATE OBJECT'}`);
      }
      if (month.priorReadingDate) {
        console.log(`  priorReadingDate formatted: ${month.priorReadingDate.toISOString ? month.priorReadingDate.toISOString() : 'NOT A DATE OBJECT'}`);
      }
      console.log('');
    }
    
    // Show full month 1 data structure
    console.log('\n📦 Full Month 1 data structure:');
    console.log(JSON.stringify(result.months[1], null, 2));
    
  } catch (error) {
    console.error('❌ Error testing aggregator:', error);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testAggregator();
