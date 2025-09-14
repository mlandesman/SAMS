/**
 * Email Service for Digital Receipt
 * Handles sending email receipts using client-specific templates
 */

import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfigController.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getDb } from '../firebase.js';

/**
 * Create Gmail transporter for sending emails
 * @returns {object} Nodemailer transporter
 */
function createGmailTransporter() {
  // Using Gmail SMTP with App Password
  const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  console.log('🔧 Creating Gmail transporter with user:', gmailUser);
  console.log('🔧 App password length:', gmailPass ? gmailPass.length : 'NOT SET');
  
  if (!gmailPass) {
    throw new Error('GMAIL_APP_PASSWORD environment variable not set');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });
}

/**
 * Process email template with receipt data
 * @param {string} template - HTML template string
 * @param {object} receiptData - Receipt data for template substitution
 * @returns {string} Processed HTML template
 */
function processEmailTemplate(template, receiptData) {
  // PROPER ERROR HANDLING: Template should be required
  if (!template) {
    throw new Error('Email template body is missing from client configuration. Please configure email templates in Firebase console under clients/[clientId]/email/receiptEmail');
  }

  let processedTemplate = template;
  
  // Replace template variables
  const replacements = {
    '__OwnerName__': receiptData.receivedFrom || 'Valued Customer',
    '__UnitNumber__': receiptData.unitId || receiptData.unitNumber || 'N/A',
    '__Amount__': receiptData.formattedAmount || 'N/A',
    '__Date__': receiptData.date || 'N/A',
    '__TransactionId__': receiptData.receiptNumber || 'N/A',
    '__Category__': receiptData.category || 'Payment',
    '__PaymentMethod__': receiptData.paymentMethod || 'N/A',
    '__Notes__': receiptData.notes || '',
    '__ClientLogoUrl__': receiptData.clientLogoUrl || '',
    '__ClientName__': receiptData.clientName || 'Client Name'
  };
  
  // Apply all replacements
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder, 'g');
    processedTemplate = processedTemplate.replace(regex, String(value || ''));
  });
  
  return processedTemplate;
}

/**
 * Send digital receipt email
 * @param {string} clientId - Client ID
 * @param {object} receiptData - Receipt data
 * @param {Blob} receiptImageBlob - Receipt image as blob
 * @returns {object} Result of email sending operation
 */
async function sendReceiptEmail(clientId, receiptData, receiptImageBlob, clientData = null) {
  try {
    console.log(`📧 Sending receipt email for client: ${clientId}`);
    
    // Get client email configuration using new template structure
    const emailConfigResult = await getEmailConfig(clientId, 'receipt');
    
    if (!emailConfigResult.success) {
      throw new Error(`Email configuration not found for client ${clientId}`);
    }
    
    const emailConfig = emailConfigResult.data;
    console.log('📋 Loaded email configuration:', {
      fromEmail: emailConfig.fromEmail,
      ccList: emailConfig.ccList,
      hasSignature: !!emailConfig.signature
    });
    
    // Use client data passed from frontend (same data that works for logo display)
    let clientLogoUrl = '';
    let clientName = 'Client Name';
    
    if (clientData) {
      console.log('🎨 Using client data from frontend:', clientData);
      clientLogoUrl = clientData.logoUrl || '';
      clientName = clientData.name || 'Client Name';
    } else {
      console.log('⚠️ No client data provided, falling back to Firestore lookup');
      // Fallback to Firestore if no client data provided
      const db = await getDb();
      const clientDoc = await db.collection('clients').doc(clientId).get();
      const clientConfig = clientDoc.exists ? clientDoc.data() : {};
      clientLogoUrl = clientConfig.logoUrl || '';
      clientName = clientConfig.name || clientConfig.basicInfo?.fullName || 'Client Name';
    }
    
    console.log('🎨 Final client branding:', {
      clientName: clientName,
      clientLogoUrl: clientLogoUrl,
      hasLogo: !!clientLogoUrl
    });
    
    // Validate recipient emails
    let recipientEmails = receiptData.ownerEmails || [];
    if (recipientEmails.length === 0) {
      throw new Error('No recipient email addresses found');
    }
    
    // TEST MODE: Override emails for testing (add TEST_EMAIL_OVERRIDE to .env)
    const testEmailOverride = process.env.TEST_EMAIL_OVERRIDE;
    if (testEmailOverride) {
      console.log('🧪 TEST MODE: Overriding recipient emails to:', testEmailOverride);
      recipientEmails = [testEmailOverride];
    }
    
    // Process email subject
    let subject = emailConfig.subject || 'Payment Receipt';
    subject = subject.replace('__UnitNumber__', receiptData.unitId || receiptData.unitNumber || 'N/A');
    
    // Process email body with signature
    console.log('📧 BEFORE template processing:');
    console.log('📧 Template body length:', emailConfig.body?.length);
    console.log('📧 Client logo URL:', clientLogoUrl);
    console.log('📧 Client name:', clientName);
    console.log('📧 Template contains __ClientLogoUrl__:', emailConfig.body?.includes('__ClientLogoUrl__'));
    
    let htmlBody = processEmailTemplate(emailConfig.body, {
      ...receiptData,
      formattedAmount: receiptData.amount ? `MX$ ${receiptData.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'N/A',
      clientLogoUrl: clientLogoUrl,
      clientName: clientName
    });
    
    console.log('📧 AFTER template processing:');
    console.log('📧 Processed body length:', htmlBody?.length);
    console.log('📧 Contains actual logo URL:', htmlBody?.includes(clientLogoUrl));
    console.log('📧 Still contains __ClientLogoUrl__:', htmlBody?.includes('__ClientLogoUrl__'));
    console.log('📧 Still contains __ClientName__:', htmlBody?.includes('__ClientName__'));
    
    // Add signature to body - check for new HTML field in signature object
    let signatureHtml = '';
    if (emailConfig.signature) {
      if (typeof emailConfig.signature === 'object' && emailConfig.signature.HTML) {
        // Use new structured signature with HTML field
        signatureHtml = emailConfig.signature.HTML;
      } else if (typeof emailConfig.signature === 'string') {
        // Fallback to old string-based signature
        signatureHtml = emailConfig.signature;
      }
    }
    htmlBody = htmlBody.replace('__Signature__', signatureHtml);
    
    // Create email transporter
    const transporter = createGmailTransporter();
    
    // Prepare email attachments
    const attachments = [];
    if (receiptImageBlob && emailConfig.attachReceiptImage) {
      attachments.push({
        filename: `Receipt_${receiptData.unitNumber}_${receiptData.receiptNumber}.png`,
        content: receiptImageBlob,
        contentType: 'image/png'
      });
    }
    
    // Prepare email options
    const mailOptions = {
      from: {
        name: emailConfig.fromName || 'Marina Turquesa Condominiums',
        address: emailConfig.fromEmail || 'ms@landesman.com'
      },
      to: recipientEmails,
      cc: emailConfig.ccList || [],
      subject: subject,
      html: htmlBody,
      replyTo: emailConfig.replyTo || emailConfig.fromEmail,
      attachments: attachments
    };
    
    console.log('📤 Sending email to:', {
      to: recipientEmails,
      cc: emailConfig.ccList,
      subject: subject,
      attachmentCount: attachments.length
    });
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', info.messageId);
    
    // Log audit trail
    await writeAuditLog({
      module: 'email',
      action: 'send_receipt',
      parentPath: `clients/${clientId}`,
      docId: receiptData.receiptNumber,
      friendlyName: `Receipt Email: ${receiptData.unitNumber}`,
      notes: `Sent receipt email to ${recipientEmails.join(', ')} for unit ${receiptData.unitNumber}`,
    });
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: recipientEmails,
      cc: emailConfig.ccList
    };
    
  } catch (error) {
    console.error('❌ Error sending receipt email:', error);
    
    // Log error to audit trail
    await writeAuditLog({
      module: 'email',
      action: 'send_receipt_failed',
      parentPath: `clients/${clientId}`,
      docId: receiptData.receiptNumber || 'unknown',
      friendlyName: `Failed Receipt Email: ${receiptData.unitNumber || 'unknown'}`,
      notes: `Failed to send receipt email: ${error.message}`,
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test email configuration for a client
 * @param {string} clientId - Client ID
 * @param {string} testEmail - Email address to send test to
 * @returns {object} Result of test email operation
 */
async function testEmailConfig(clientId, testEmail) {
  const testReceiptData = {
    receivedFrom: 'Test Owner',
    unitNumber: 'TEST-01',
    amount: 2500.00,
    date: new Date().toLocaleDateString('es-MX'),
    receiptNumber: 'TEST-' + Date.now(),
    category: 'Test Payment',
    paymentMethod: 'Test Method',
    notes: 'This is a test email',
    ownerEmails: [testEmail]
  };
  
  return await sendReceiptEmail(clientId, testReceiptData, null);
}

export {
  sendReceiptEmail,
  testEmailConfig,
  createGmailTransporter,
  processEmailTemplate
};
