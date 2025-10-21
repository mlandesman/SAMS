import testHarness from './backend/testing/testHarness.js';

const clientId = 'AVII';

async function triggerPenaltyRecalc() {
  try {
    console.log(`🔄 Triggering penalty recalculation for ${clientId}...`);
    
    // Create authenticated API client
    const apiClient = await testHarness.createApiClient();
    
    // Call the recalculate penalties endpoint
    const response = await apiClient.post(
      `/water/clients/${clientId}/bills/recalculate-penalties`,
      {}
    );
    
    if (response.data.success) {
      console.log('✅ Penalty recalculation completed successfully!');
      console.log(`📊 Results:`, response.data.data);
      console.log(`   Processed: ${response.data.data.processedBills} bills`);
      console.log(`   Updated: ${response.data.data.updatedBills} bills`);
      console.log(`   Total penalties: $${response.data.data.totalPenaltiesUpdated}`);
    } else {
      console.error('❌ Penalty recalculation failed:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

triggerPenaltyRecalc();

