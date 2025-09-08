/**
 * Email Service for Digital Receipt
 * Handles sending email receipts using client-specific templates
 */

import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfigController.js';
import { writeAuditLog } from '../utils/auditLogger.js';

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
  let processedTemplate = template;
  
  // Replace template variables
  const replacements = {
    '__OwnerName__': receiptData.receivedFrom || 'Valued Customer',
    '__UnitNumber__': receiptData.unitNumber || 'N/A',
    '__Amount__': receiptData.formattedAmount || 'N/A',
    '__Date__': receiptData.date || 'N/A',
    '__TransactionId__': receiptData.receiptNumber || 'N/A',
    '__Category__': receiptData.category || 'Payment',
    '__PaymentMethod__': receiptData.paymentMethod || 'N/A',
    '__Notes__': receiptData.notes || ''
  };
  
  // Apply all replacements
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder, 'g');
    processedTemplate = processedTemplate.replace(regex, value);
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
async function sendReceiptEmail(clientId, receiptData, receiptImageBlob) {
  try {
    console.log(`📧 Sending receipt email for client: ${clientId}`);
    
    // Get client email configuration
    const emailConfigResult = await getEmailConfig(clientId, 'receiptEmail');
    
    if (!emailConfigResult.success) {
      throw new Error(`Email configuration not found for client ${clientId}`);
    }
    
    const emailConfig = emailConfigResult.data;
    console.log('📋 Loaded email configuration:', {
      fromEmail: emailConfig.fromEmail,
      ccList: emailConfig.ccList,
      hasSignature: !!emailConfig.signature
    });
    
    // Validate recipient emails
    const recipientEmails = receiptData.ownerEmails || [];
    if (recipientEmails.length === 0) {
      throw new Error('No recipient email addresses found');
    }
    
    // Process email subject
    let subject = emailConfig.subject || 'Payment Receipt';
    subject = subject.replace('__UnitNumber__', receiptData.unitNumber || 'N/A');
    
    // Process email body with signature
    let htmlBody = processEmailTemplate(emailConfig.body, {
      ...receiptData,
      formattedAmount: receiptData.amount ? `MX$ ${receiptData.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'N/A'
    });
    
    // Add signature to body
    if (emailConfig.signature) {
      htmlBody = htmlBody.replace('__Signature__', emailConfig.signature);
    } else {
      htmlBody = htmlBody.replace('__Signature__', '');
    }
    
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
