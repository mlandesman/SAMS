/**
 * Email Configuration Controller
 * Manages client-specific email templates and settings
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

/**
 * Get email configuration for a client using emailTemplates structure
 * @param {string} clientId - Client ID
 * @param {string} templateType - Template type (e.g., 'receipt', 'waterBill', 'hoaDues')
 * @returns {object} Email configuration object with template-specific and shared data
 */
async function getEmailConfig(clientId, templateType = 'receipt') {
  try {
    const db = await getDb();
    
    // Get emailTemplates document
    const emailTemplatesRef = db.doc(`clients/${clientId}/config/emailTemplates`);
    const emailTemplatesDoc = await emailTemplatesRef.get();
    
    if (!emailTemplatesDoc.exists) {
      console.log(`No emailTemplates config found for client ${clientId}`);
      return {
        success: false,
        error: `Email configuration not found for client ${clientId}`
      };
    }
    
    const templatesConfig = emailTemplatesDoc.data();
    
    // Check if requested template type exists
    if (!templatesConfig[templateType]) {
      console.log(`Template type '${templateType}' not found for client ${clientId}`);
      return {
        success: false,
        error: `Template type '${templateType}' not found for client ${clientId}`
      };
    }
    
    // Combine template-specific data with shared config
    const emailConfig = {
      // Template-specific data (body, subject)
      body: templatesConfig[templateType].body,
      subject: templatesConfig[templateType].subject,
      
      // Shared configuration
      signature: templatesConfig.signature,
      ccList: templatesConfig.ccList || [],
      fromEmail: templatesConfig.fromEmail || '',
      fromName: templatesConfig.fromName || '',
      replyTo: templatesConfig.replyTo || '',
      attachReceiptImage: templatesConfig.attachReceiptImage !== false
    };
    
    return {
      success: true,
      data: emailConfig,
      structure: 'emailTemplates'
    };
    
  } catch (error) {
    console.error('❌ Error fetching email config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create or update email configuration for a client
 * @param {string} clientId - Client ID
 * @param {string} configType - Type of email config (e.g., 'receiptEmail')
 * @param {object} configData - Email configuration data
 * @returns {object} Result of the operation
 */
async function setEmailConfig(clientId, configType = 'receiptEmail', configData) {
  try {
    const db = await getDb();
    const configRef = db.doc(`clients/${clientId}/config/${configType}`);
    
    const dataWithTimestamp = {
      ...configData,
      updatedAt: getNow(),
      updatedBy: 'system' // TODO: Add actual user when auth is implemented
    };
    
    await configRef.set(dataWithTimestamp, { merge: true });
    
    await writeAuditLog({
      module: 'emailConfig',
      action: 'update',
      parentPath: `clients/${clientId}/config`,
      docId: configType,
      friendlyName: `Email Config: ${configType}`,
      notes: `Updated email configuration for ${clientId}`,
    });
    
    return {
      success: true,
      message: 'Email configuration updated successfully'
    };
  } catch (error) {
    console.error('❌ Error setting email config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize default email configuration for MTC client
 * @param {string} clientId - Client ID (e.g., 'MTC')
 * @returns {object} Result of the operation
 */
async function initializeMTCEmailConfig(clientId = 'MTC') {
  const defaultConfig = {
    subject: 'Marina Turquesa Payment Receipt for __UnitNumber__',
    body: `<!DOCTYPE html>
<html>
<head>
  <title>Payment Receipt</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .receipt-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Marina Turquesa Condominiums</h2>
      <h3>Payment Receipt</h3>
    </div>
    
    <p>Dear __OwnerName__,</p>
    
    <p>Thank you for your payment. Please find your receipt attached to this email.</p>
    
    <div class="receipt-info">
      <p><strong>Unit:</strong> __UnitNumber__</p>
      <p><strong>Amount:</strong> __Amount__</p>
      <p><strong>Date:</strong> __Date__</p>
      <p><strong>Transaction ID:</strong> __TransactionId__</p>
    </div>
    
    <p>If you have any questions about this payment or your account, please don't hesitate to contact us.</p>
    
    <p>Thank you!</p>
  </div>
  __Signature__
</body>
</html>`,
    signature: `
<div style="margin-top: 20px; font-family: Tahoma, Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin: 0;">
    <tr>
      <td style="padding: 0 16px 0 0; vertical-align: top;">
        <!-- Logo -->
        <img src="https://cdn.signaturehound.com/users/1i998hnkklfejv8/43fbac1f-010c-4cd0-b0f9-615220e29fd7.png" 
             alt="Marina Turquesa Logo" 
             width="100" 
             height="100" 
             style="display: block; border: 0; border-radius: 8px;">
      </td>
      
      <!-- Vertical divider -->
      <td style="padding: 0 16px; border-left: 4px solid #007bff; vertical-align: top;">
      </td>
      
      <td style="padding: 0; vertical-align: top;">
        <!-- Contact Information -->
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 3px;">
              <div style="font-size: 16px; font-weight: bold; color: #333; margin: 0; line-height: .9;">
                Michael y Sandra Landesman
              </div>
              <div style="font-size: 14px; color: #888; margin: 0; line-height: .9;">
                Administradores
              </div>
            </td>
          </tr>
          
          <!-- Email -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: middle;">
                    <img src="https://cdn.signaturehound.com/icons/email_default_00d2ff.png" 
                         alt="Email" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="mailto:ms@landesman.com" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      ms@landesman.com
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Phone/WhatsApp -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: middle;">
                    <img src="https://cdn.signaturehound.com/icons/mobile_default_00d2ff.png" 
                         alt="Phone" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: middle;">
                    <a href="tel:+529841780331" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      +52 98 41 78 03 31 WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Address -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding-right: 6px; vertical-align: top;">
                    <img src="https://cdn.signaturehound.com/icons/map_default_00d2ff.png" 
                         alt="Location" 
                         width="16" 
                         height="16" 
                         style="display: block; border: 0;">
                  </td>
                  <td style="vertical-align: top;">
                    <a href="https://goo.gl/maps/LZGN41nxDnVGqTV99" 
                       style="color: #007bff; text-decoration: none; font-size: 14px; line-height: .9;">
                      Caleta Yalkú 9, PH4D<br>
                      Puerto Aventuras, Solidaridad, QROO 77733
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <!-- Reduced spacer -->
  <div style="height: 15px;"></div>
</div>`,
    ccList: ['pm@sandyland.com.mx'],
    fromEmail: 'michael@sandyland.com.mx',
    fromName: 'Marina Turquesa Condominiums',
    replyTo: 'pm@sandyland.com.mx',
    attachReceiptImage: true,
    attachUnitReport: false, // For future implementation
    template: 'receipt', // Template type identifier
    active: true
  };
  
  return await setEmailConfig(clientId, 'receiptEmail', defaultConfig);
}

export {
  getEmailConfig,
  setEmailConfig,
  initializeMTCEmailConfig
};
