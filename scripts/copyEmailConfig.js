/**
 * Copy Email Configuration from MTC to AVII
 * Creates AVII email config based on MTC template
 */

import { getDb } from '../backend/firebase.js';

async function copyEmailConfigToAVII() {
  try {
    console.log('🔄 Starting email config copy from MTC to AVII...');
    
    const db = await getDb();
    
    // Get MTC email configuration
    console.log('📋 Reading MTC email configuration...');
    const mtcEmailRef = db.doc('clients/MTC/config/receiptEmail');
    const mtcEmailDoc = await mtcEmailRef.get();
    
    if (!mtcEmailDoc.exists) {
      throw new Error('MTC email configuration not found');
    }
    
    const mtcEmailConfig = mtcEmailDoc.data();
    console.log('✅ MTC email configuration loaded successfully');
    
    // Create AVII email configuration (copy of MTC)
    console.log('📝 Creating AVII email configuration...');
    const aviiEmailRef = db.doc('clients/AVII/config/receiptEmail');
    
    // Copy the configuration
    await aviiEmailRef.set(mtcEmailConfig);
    
    console.log('✅ AVII email configuration created successfully');
    console.log('');
    console.log('📧 AVII email config copied from MTC');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Go to Firebase Console');
    console.log('2. Navigate to clients/AVII/config/receiptEmail');
    console.log('3. Update the following fields for AVII:');
    console.log('   - subject: Update client name references');
    console.log('   - fromName: Change to AVII-appropriate name');
    console.log('   - fromEmail: Update if different');
    console.log('   - ccList: Update for AVII contacts');
    console.log('   - signature.HTML: Update contact info for AVII');
    console.log('4. Update body template __ClientName__ references if needed');
    console.log('');
    console.log('💡 The template will automatically use AVII client data');
    console.log('   (logo, name) when emails are sent for AVII transactions');
    
  } catch (error) {
    console.error('❌ Error copying email config:', error);
    throw error;
  }
}

// Run the copy operation
copyEmailConfigToAVII()
  .then(() => {
    console.log('🎉 Email configuration copy completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Copy operation failed:', error);
    process.exit(1);
  });