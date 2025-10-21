import fetch from 'node-fetch';

const clientId = 'AVII';
const baseUrl = 'http://localhost:5001';

async function triggerPenaltyRecalc() {
  try {
    console.log(`🔄 Triggering penalty recalculation for ${clientId}...`);
    
    const response = await fetch(
      `${baseUrl}/water/clients/${clientId}/bills/recalculate-penalties`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Penalty recalculation completed successfully!');
      console.log(`📊 Results:`, result.data);
    } else {
      console.error('❌ Penalty recalculation failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

triggerPenaltyRecalc();
