import { createApiClient } from './apiClient.js';

async function testHOAPaymentFix() {
  console.log('🧪 Testing HOA Payment Fix for date issue...\n');
  
  try {
    const api = await createApiClient();
    
    // Test payload matching what frontend sends
    const paymentData = {
      paymentData: {
        date: "2025-08-09",
        amount: 5000,
        method: "cash",
        accountId: "cash-001",
        accountType: "cash",
        checkNumber: null,
        notes: "Test payment",
        description: "HOA Dues payment for Unit 101 - Aug 2025",
        scheduledAmount: 4400,
        creditBalanceAdded: 600,
        newCreditBalance: 600,
        creditUsed: 0,
        creditRepairAmount: 0
      },
      distribution: [{
        month: 8,
        existingAmount: 0,
        newAmount: 4400,
        amountToAdd: 4400
      }]
    };
    
    console.log('📤 Sending payment data:', JSON.stringify(paymentData, null, 2));
    
    const response = await api.post(
      '/api/clients/AVII/hoadues/payment/101/2025',
      paymentData
    );
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Payment recorded successfully!');
      console.log('📊 Response:', response.data);
      return { success: true, data: response.data };
    } else {
      console.log('❌ Unexpected status:', response.status);
      return { success: false, status: response.status };
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return { success: false, error: error.message };
  }
}

// Run the test
testHOAPaymentFix().then(result => {
  console.log('\n📊 Test Result:', result.success ? 'PASSED' : 'FAILED');
  process.exit(result.success ? 0 : 1);
});