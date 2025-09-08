#!/usr/bin/env node

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';

// Initialize Firebase
const { db } = await initializeFirebase();

async function fixAVIIConfig() {
  try {
    console.log('🔧 Fixing AVII client configuration...');
    
    const clientRef = db.collection('clients').doc('AVII');
    
    // Verify client exists
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
      throw new Error('AVII client not found');
    }
    
    // Create activities config
    console.log('📋 Creating activities configuration...');
    const activitiesRef = clientRef.collection('config').doc('activities');
    await activitiesRef.set({
      menu: [
        { label: 'Dashboard', activity: 'Dashboard' },
        { label: 'Transactions', activity: 'Transactions' },
        { label: 'HOA Dues', activity: 'HOADues' },
        { label: 'Projects', activity: 'Projects' },
        { label: 'Budgets', activity: 'Budgets' },
        { label: 'List Management', activity: 'ListManagement' },
        { label: 'Settings', activity: 'Settings' }
      ],
      updatedAt: getCurrentTimestamp(),
      updatedBy: 'fix-avii-config'
    });
    console.log('  ✅ Activities config created');
    
    // Create receiptEmail config
    console.log('📧 Creating receipt email configuration...');
    const receiptEmailRef = clientRef.collection('config').doc('receiptEmail');
    await receiptEmailRef.set({
      ccList: ['accounting@sandyland.com.mx'],
      footerText: 'If you have any questions about this receipt, please contact us.',
      fromEmail: 'hoa@sandyland.com.mx',
      fromName: 'Aventuras Villas II HOA',
      headerText: 'Thank you for your payment!',
      includeReceiptImage: true,
      includeSummaryReport: true,
      logoUrl: '',
      primaryColor: '#2C3E50',
      replyTo: 'pm@sandyland.com.mx',
      signature: {
        address: 'Puerto Aventuras, Quintana Roo, México',
        company: 'Sandyland Properties',
        email: 'pm@sandyland.com.mx',
        name: 'Sandra Landesman',
        phone: '+52 994 238 8224',
        title: 'Property Manager'
      },
      subject: 'AVII Payment Receipt',
      updated: getCurrentTimestamp()
    });
    console.log('  ✅ Receipt email config created');
    
    console.log('\n✅ AVII configuration fixed successfully!');
    console.log('\n📱 The HOA Dues and Units List menus should now appear in the UI.');
    
  } catch (error) {
    console.error('❌ Error fixing AVII config:', error);
    process.exit(1);
  }
}

// Run the fix
fixAVIIConfig()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });