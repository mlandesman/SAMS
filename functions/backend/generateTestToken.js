import admin from 'firebase-admin';

// The backend already has admin initialized, so just generate a custom token
async function generateTestToken() {
  const testUid = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
  
  try {
    const customToken = await admin.auth().createCustomToken(testUid);
    console.log('Custom token for testing:', customToken);
    return customToken;
  } catch (error) {
    console.error('Error creating custom token:', error);
    throw error;
  }
}

// Export for use in other scripts
export { generateTestToken };

// If run directly, generate and display the token
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTestToken()
    .then(token => {
      console.log('\n=== TEST TOKEN GENERATED ===');
      console.log('UID:', 'fjXv8gX1CYWBvOZ1CS27j96oRCT2');
      console.log('Token:', token);
      console.log('\nUse in Authorization header:');
      console.log(`Authorization: Bearer ${token}`);
      console.log('================================');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to generate token:', error);
      process.exit(1);
    });
}