/**
 * Initialize Email Configuration for MTC Client
 * Run this script to set up the default email templates and settings
 */

import { initializeMTCEmailConfig } from '../controllers/emailConfigController.js';
import { initializeFirebase } from '../firebase.js';

async function initializeEmailConfig() {
  try {
    console.log('🔧 Initializing Firebase...');
    await initializeFirebase();
    
    console.log('📧 Setting up email configuration for MTC client...');
    const result = await initializeMTCEmailConfig('MTC');
    
    if (result.success) {
      console.log('✅ Email configuration initialized successfully!');
      console.log('📋 Configuration stored at: /clients/MTC/config/receiptEmail');
      console.log('🔧 You can now customize the email templates in Firestore');
    } else {
      console.error('❌ Failed to initialize email configuration:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
  
  process.exit(0);
}

// Run the initialization
initializeEmailConfig();
