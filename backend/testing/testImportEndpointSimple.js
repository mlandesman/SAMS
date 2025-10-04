import axios from 'axios';
import { tokenManager } from './tokenManager.js';

async function testImportEndpointSimple() {
  console.log('🧪 Testing Import Endpoint with simple request...');
  
  try {
    // Get token
    const token = await tokenManager.getToken('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    
    // Test the import config endpoint
    console.log('\n📋 Testing GET /admin/import/MTC/config...');
    
    const response = await axios.get('http://localhost:5001/admin/import/MTC/config', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.url);
      console.error('Headers:', error.config?.headers);
    }
  }
}

// Run the test
testImportEndpointSimple();