/**
 * Migrate Email Templates Structure
 * Transform receiptEmail config to new emailTemplates nested structure
 * 
 * OLD: clients/{clientId}/config/receiptEmail/
 * NEW: clients/{clientId}/config/emailTemplates/
 *      ├── receipt/body, receipt/subject
 *      ├── signature, ccList, fromEmail, etc. (shared)
 */

import { getDb } from '../backend/firebase.js';

async function migrateEmailTemplatesStructure(clientId) {
  try {
    console.log(`🔄 Starting email templates migration for client: ${clientId}`);
    
    const db = await getDb();
    
    // Read current receiptEmail configuration
    console.log('📋 Reading current receiptEmail configuration...');
    const receiptEmailRef = db.doc(`clients/${clientId}/config/receiptEmail`);
    const receiptEmailDoc = await receiptEmailRef.get();
    
    if (!receiptEmailDoc.exists) {
      console.log(`⚠️ No receiptEmail config found for ${clientId}, skipping migration`);
      return;
    }
    
    const currentConfig = receiptEmailDoc.data();
    console.log('✅ Current receiptEmail configuration loaded');
    
    // Create new emailTemplates structure
    console.log('🏗️ Creating new emailTemplates structure...');
    const emailTemplatesRef = db.doc(`clients/${clientId}/config/emailTemplates`);
    
    // Extract template-specific data
    const receiptBody = currentConfig.body || '';
    const receiptSubject = currentConfig.subject || 'Payment Receipt';
    
    // Create new structured configuration
    const newEmailConfig = {
      // Template-specific nested data
      receipt: {
        body: receiptBody,
        subject: receiptSubject
      },
      
      // Shared configuration
      signature: currentConfig.signature || null,
      ccList: currentConfig.ccList || [],
      fromEmail: currentConfig.fromEmail || '',
      fromName: currentConfig.fromName || '',
      replyTo: currentConfig.replyTo || '',
      attachReceiptImage: currentConfig.attachReceiptImage || true,
      
      // Metadata
      migrated: true,
      migratedAt: new Date(),
      originalStructure: 'receiptEmail',
      
      // Keep original data for reference during transition
      _originalConfig: currentConfig
    };
    
    // Write new configuration
    await emailTemplatesRef.set(newEmailConfig);
    console.log('✅ New emailTemplates configuration created');
    
    console.log('');
    console.log('📧 Migration completed successfully for', clientId);
    console.log('');
    console.log('🗂️ New structure:');
    console.log(`   clients/${clientId}/config/emailTemplates/`);
    console.log('   ├── receipt/body (template HTML)');
    console.log('   ├── receipt/subject (email subject)');
    console.log('   ├── signature (shared)');
    console.log('   ├── ccList (shared)');
    console.log('   ├── fromEmail (shared)');
    console.log('   └── ... (other shared config)');
    console.log('');
    console.log('⚠️ IMPORTANT: Old receiptEmail config preserved for backward compatibility');
    console.log('   Remove it manually after confirming new structure works');
    
  } catch (error) {
    console.error(`❌ Error migrating email templates for ${clientId}:`, error);
    throw error;
  }
}

async function migrateAllClients() {
  try {
    console.log('🚀 Starting email templates migration for all clients...');
    
    const clients = ['MTC', 'AVII'];
    
    for (const clientId of clients) {
      await migrateEmailTemplatesStructure(clientId);
    }
    
    console.log('');
    console.log('🎉 All email template migrations completed successfully');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Update email service to use new structure');
    console.log('2. Test email delivery with new paths');
    console.log('3. Add new template types (waterBill, hoaDues) as needed');
    console.log('4. Remove old receiptEmail configs after verification');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateAllClients()
  .then(() => {
    console.log('✨ Email templates migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration operation failed:', error);
    process.exit(1);
  });