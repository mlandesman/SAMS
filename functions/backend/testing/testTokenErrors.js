import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

async function testTokenErrors() {
  console.log('🧪 Testing Token Error Differentiation\n');
  
  const testCases = [
    {
      name: 'Malformed Token',
      token: 'NotAValidToken123',
      expectedError: 'Invalid token format - not a valid Firebase token'
    },
    {
      name: 'Empty Token',
      token: '',
      expectedError: 'Invalid token format - not a valid Firebase token'
    },
    {
      name: 'JWT-like but not Firebase',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      expectedError: 'Invalid token format - not a valid Firebase token'
    },
    {
      name: 'No Bearer Prefix',
      token: null,
      skipBearer: true,
      expectedError: "Invalid authorization format - use 'Bearer YOUR_TOKEN'"
    },
    {
      name: 'No Authorization Header',
      token: null,
      skipHeader: true,
      expectedError: 'No valid authorization header'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`Token: ${testCase.token || '(none)'}`);
    
    try {
      const headers = {};
      
      if (!testCase.skipHeader) {
        if (testCase.skipBearer) {
          headers.Authorization = testCase.token || 'SomeTokenWithoutBearer';
        } else if (testCase.token !== null) {
          headers.Authorization = `Bearer ${testCase.token}`;
        }
      }
      
      const response = await axios.get(`${API_BASE_URL}/users/profile`, { headers });
      console.log('❌ Expected error but request succeeded');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        const receivedError = error.response.data.error;
        console.log(`Received: "${receivedError}"`);
        console.log(`Expected: "${testCase.expectedError}"`);
        
        if (receivedError === testCase.expectedError) {
          console.log('✅ PASS - Error message matches expected');
        } else {
          console.log('❌ FAIL - Error message does not match expected');
        }
      } else {
        console.log('❌ Unexpected error:', error.message);
        if (error.code === 'ECONNREFUSED') {
          console.log('   Make sure the backend server is running on port 5001');
        }
      }
    }
  }
  
  console.log('\n\n💡 Note: To test expired tokens and wrong project tokens, you need:');
  console.log('   - An actual expired Firebase token');
  console.log('   - A valid token from a different Firebase project');
  console.log('   These cannot be easily generated in automated tests.\n');
}

// Run the tests
testTokenErrors().catch(console.error);