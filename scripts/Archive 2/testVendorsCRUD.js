/**
 * Test Vendors CRUD Operations
 * 
 * This script tests the complete vendors CRUD functionality including:
 * - Create vendor
 * - List vendors
 * - Update vendor  
 * - Delete vendor
 */

const API_BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'MTC';

async function testVendorsCRUD() {
  console.log('🧪 Testing Vendors CRUD Operations');
  console.log('=====================================\n');

  try {
    // Test 1: Create a new vendor
    console.log('1️⃣ Testing CREATE vendor...');
    const newVendor = {
      name: 'Test Vendor Inc.',
      category: 'Services',
      contactName: 'John Doe',
      phone: '+52 998 123 4567',
      email: 'john@testvendor.com',
      notes: 'Created via API test',
      status: 'active'
    };

    const createResponse = await fetch(`${API_BASE_URL}/api/clients/${CLIENT_ID}/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(newVendor)
    });

    const createResult = await createResponse.json();
    console.log('Create Response:', createResult);

    if (!createResult.success) {
      throw new Error(`Create failed: ${createResult.error}`);
    }

    const vendorId = createResult.data.id;
    console.log(`✅ Vendor created with ID: ${vendorId}\n`);

    // Test 2: List all vendors
    console.log('2️⃣ Testing LIST vendors...');
    const listResponse = await fetch(`${API_BASE_URL}/api/clients/${CLIENT_ID}/vendors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const listResult = await listResponse.json();
    console.log('List Response:', listResult);

    if (!listResult.success) {
      throw new Error(`List failed: ${listResult.error}`);
    }

    console.log(`✅ Found ${listResult.count} vendors\n`);

    // Test 3: Update the vendor
    console.log('3️⃣ Testing UPDATE vendor...');
    const updateData = {
      name: 'Updated Test Vendor Inc.',
      category: 'Updated Services',
      notes: 'Updated via API test'
    };

    const updateResponse = await fetch(`${API_BASE_URL}/api/clients/${CLIENT_ID}/vendors/${vendorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });

    const updateResult = await updateResponse.json();
    console.log('Update Response:', updateResult);

    if (!updateResult.success) {
      throw new Error(`Update failed: ${updateResult.error}`);
    }

    console.log('✅ Vendor updated successfully\n');

    // Test 4: Delete the vendor
    console.log('4️⃣ Testing DELETE vendor...');
    const deleteResponse = await fetch(`${API_BASE_URL}/api/clients/${CLIENT_ID}/vendors/${vendorId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const deleteResult = await deleteResponse.json();
    console.log('Delete Response:', deleteResult);

    if (!deleteResult.success) {
      throw new Error(`Delete failed: ${deleteResult.error}`);
    }

    console.log('✅ Vendor deleted successfully\n');

    // Test 5: Verify deletion by listing again
    console.log('5️⃣ Testing LIST after deletion...');
    const finalListResponse = await fetch(`${API_BASE_URL}/api/clients/${CLIENT_ID}/vendors`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const finalListResult = await finalListResponse.json();
    console.log('Final List Response:', finalListResult);

    if (!finalListResult.success) {
      throw new Error(`Final list failed: ${finalListResult.error}`);
    }

    console.log(`✅ Final count: ${finalListResult.count} vendors\n`);

    console.log('🎉 ALL TESTS PASSED! Vendors CRUD system is working correctly.');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
  }
}

// Run the tests
testVendorsCRUD();
