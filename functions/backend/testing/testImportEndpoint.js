import { createApiClient } from './apiClient.js';
import { tokenManager } from './tokenManager.js';

async function testImportEndpoint() {
  console.log('🧪 Testing Import Endpoint...');
  
  try {
    // Create API client (it handles token internally)
    const api = await createApiClient('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    
    // Test the import config endpoint
    console.log('\n📋 Testing GET /admin/import/MTC/config...');
    const response = await api.get('/admin/import/MTC/config');
    
    console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

// Run the test
testImportEndpoint();