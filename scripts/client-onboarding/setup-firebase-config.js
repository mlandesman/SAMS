/**
 * Setup Client Configuration
 * Creates the required config documents for MTC client:
 * - Activity menu configuration
 * - Email configuration
 * 
 * Run AFTER create-mtc-client.js
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';

const CLIENT_ID = 'MTC';

/**
 * Create activity menu configuration
 */
async function setupActivityConfig(db) {
  console.log('📋 Setting up activity menu configuration...');
  
  const defaultMenuItems = [
    { label: "Dashboard", activity: "Dashboard" },
    { label: "Transactions", activity: "Transactions" },
    { label: "HOA Dues", activity: "HOADues" },
    { label: "Projects", activity: "Projects" },
    { label: "Budgets", activity: "Budgets" },
    { label: "List Management", activity: "ListManagement" },
    { label: "Settings", activity: "Settings" }
  ];
  
  const activityConfig = {
    menu: defaultMenuItems,  // Frontend expects 'menu' not 'menuItems'
    updatedAt: getCurrentTimestamp(),
    updatedBy: 'setup-client-config'
  };
  
  await db.collection(`clients/${CLIENT_ID}/config`).doc('activities').set(activityConfig);
  console.log('✅ Activity menu configuration created');
  console.log(`   Menu items (${defaultMenuItems.length}): ${defaultMenuItems.map(m => m.label).join(', ')}`);
}

/**
 * Create email configuration
 */
async function setupEmailConfig(db) {
  console.log('\n📧 Setting up email configuration...');
  
  const emailConfig = {
    // Email settings
    fromEmail: 'marissa@mtcpropertiesmanagement.com',
    fromName: 'MTC Properties Management',
    replyTo: 'marissa@mtcpropertiesmanagement.com',
    ccList: [],
    
    // Receipt email template
    subject: 'MTC HOA - Payment Receipt',
    headerText: 'Thank you for your HOA payment!',
    footerText: 'If you have any questions about this receipt, please contact us.',
    
    // Signature
    signature: {
      name: 'Marissa Landesman',
      title: 'Property Manager',
      company: 'MTC Properties Management',
      phone: '+52 998 123 4567',
      email: 'marissa@mtcpropertiesmanagement.com',
      address: 'Playa del Carmen, Quintana Roo, Mexico'
    },
    
    // Features
    includeReceiptImage: true,
    includeSummaryReport: false,
    
    // Styling
    primaryColor: '#2C3E50',
    logoUrl: '',
    
    updated: getCurrentTimestamp()
  };
  
  await db.collection(`clients/${CLIENT_ID}/config`).doc('receiptEmail').set(emailConfig);
  console.log('✅ Email configuration created');
  console.log(`   From: ${emailConfig.fromName} <${emailConfig.fromEmail}>`);
  console.log(`   Subject: ${emailConfig.subject}`);
}

/**
 * Main setup function
 */
async function setupClientConfig() {
  console.log('🚀 Setting up MTC client configuration...\n');
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase();
    
    // Check if client exists
    const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
    if (!clientDoc.exists) {
      console.error('❌ Error: MTC client does not exist. Run create-mtc-client.js first.');
      process.exit(1);
    }
    
    // Setup configurations
    await setupActivityConfig(db);
    await setupEmailConfig(db);
    
    console.log('\n✨ Client configuration setup complete!');
    console.log('📍 Configuration stored at:');
    console.log(`   - clients/${CLIENT_ID}/config/activities`);
    console.log(`   - clients/${CLIENT_ID}/config/receiptEmail`);
    
  } catch (error) {
    console.error('❌ Error setting up client configuration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the setup
setupClientConfig();