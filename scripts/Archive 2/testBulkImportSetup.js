/**
 * Simple test script to verify the bulk import setup
 */

console.log('🔄 Testing bulk import dependencies...');

try {
  // Test fetch availability (should be available in Node.js 18+)
  if (typeof fetch === 'undefined') {
    console.error('❌ fetch is not available - Node.js version too old?');
    process.exit(1);
  } else {
    console.log('✅ fetch is available');
  }

  // Test date functions
  const testDate = new Date('2024-01-01');
  const dateStr = testDate.toISOString().split('T')[0];
  console.log('✅ Date formatting works:', dateStr);

  // Test dynamic import
  console.log('🔄 Testing Firebase import...');
  
  import('../backend/firebase.js')
    .then(firebaseModule => {
      console.log('✅ Firebase module imported successfully');
      console.log('Available functions:', Object.keys(firebaseModule));
      
      // Test initialization
      return firebaseModule.initializeFirebase();
    })
    .then(() => {
      console.log('✅ Firebase initialized successfully');
      console.log('🎉 All dependencies working - bulk import should work!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });

} catch (error) {
  console.error('❌ Setup test failed:', error.message);
  process.exit(1);
}
