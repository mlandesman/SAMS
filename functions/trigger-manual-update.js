const { initializeApp, cert } = require('firebase-admin/app');
const { getFunctions } = require('firebase-admin/functions');

// Initialize admin app
const serviceAccount = require('../backend/sandyland-system-firebase-adminsdk.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'sams-sandyland-prod'
});

async function triggerManualUpdate() {
  try {
    console.log('Triggering manual exchange rate update...');
    
    const functions = getFunctions();
    
    // Get the function reference
    const manualUpdateFunction = functions.taskQueue('manualExchangeRatesUpdate', {
      retryConfig: {
        maxAttempts: 3,
        minBackoffSeconds: 2
      }
    });
    
    // Calculate date range for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const options = {
      mode: 'range',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      fillGaps: true
    };
    
    console.log('Requesting update with options:', options);
    
    // Enqueue the function
    await manualUpdateFunction.enqueue(options);
    
    console.log('Manual update triggered successfully');
    
  } catch (error) {
    console.error('Failed to trigger manual update:', error);
    process.exit(1);
  }
}

triggerManualUpdate();