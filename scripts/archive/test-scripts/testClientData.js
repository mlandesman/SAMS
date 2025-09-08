// Test script to check client data structure
// First create a fetch implementation for Node.js
import fetch from 'node-fetch';
global.fetch = fetch;

async function getClient(clientId) {
  try {
    const response = await fetch(`http://localhost:5001/api/clients/${clientId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting client:', error);
    throw error;
  }
}

async function testClientData() {
  try {
    // Test client retrieval for MTC
    console.log('Testing client retrieval for MTC...');
    const client = await getClient('MTC');
    
    console.log('Client data structure:');
    console.log(JSON.stringify(client, null, 2));
    
    console.log('\nChecking for client.id property:');
    console.log('client.id =', client.id);
    console.log('Type of client.id =', typeof client.id);
    
    return true;
  } catch (error) {
    console.error('Error testing client data:', error);
    return false;
  }
}

// Execute the test
testClientData()
  .then(success => {
    if (success) {
      console.log('\n✅ Client data test completed successfully');
    } else {
      console.log('\n❌ Client data test failed');
    }
  })
  .catch(error => {
    console.error('Unhandled error during test:', error);
    process.exit(1);
  });
