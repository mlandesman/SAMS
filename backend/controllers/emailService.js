/**
 * Email Service for Digital Receipt
 * Handles sending email receipts using client-specific templates
 */

import nodemailer from 'nodemailer';
import { getEmailConfig } from './emailConfigController.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getDb } from '../firebase.js';
import { buildWaterBillTemplateVariables } from '../templates/waterBills/templateVariables.js';
import { getNow } from '../services/DateService.js';

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
 * Process water bill template with variables using Handlebars-style syntax
 * @param {string} template - HTML template string with Handlebars syntax
 * @param {object} variables - Template variables from buildWaterBillTemplateVariables
 * @returns {string} Processed HTML template
 */
function processWaterBillTemplate(template, variables) {
  if (!template) {
    throw new Error('Water bill template is required');
  }
  
  if (!variables) {
    throw new Error('Template variables are required');
  }

  let processedTemplate = template;
  
  // Replace all template variables (using double underscore format)
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = key; // Variables already have __ format
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    processedTemplate = processedTemplate.replace(regex, String(value || ''));
  });
  
  // Handle Handlebars-style conditionals for basic cases
  // {{#if condition}} ... {{/if}}
  processedTemplate = processedTemplate.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
    const conditionValue = variables[`__${condition}__`] || variables[condition];
    return conditionValue ? content : '';
  });
  
  // {{#if condition}} ... {{else}} ... {{/if}}
  processedTemplate = processedTemplate.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
    const conditionValue = variables[`__${condition}__`] || variables[condition];
    return conditionValue ? ifContent : elseContent;
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
    date: getNow().toLocaleDateString('es-MX'),
    receiptNumber: 'TEST-' + Date.now(),
    category: 'Test Payment',
    paymentMethod: 'Test Method',
    notes: 'This is a test email',
    ownerEmails: [testEmail]
  };
  
  return await sendReceiptEmail(clientId, testReceiptData, null);
}

/**
 * Send water bill email with bilingual template support
 * @param {string} clientId - Client ID (e.g., 'AVII')
 * @param {string} unitNumber - Unit number (e.g., '101')
 * @param {string} billingPeriod - Billing period (e.g., '2026-00')
 * @param {string} userLanguage - User's preferred language ('en' or 'es')
 * @param {string[]} recipientEmails - Email addresses to send to
 * @param {object} options - Optional parameters for testing
 * @returns {object} Result of email sending operation
 */
async function sendWaterBillEmail(clientId, unitNumber, billingPeriod, userLanguage = 'en', recipientEmails = [], options = {}) {
  try {
    console.log(`💧 Sending water bill email for ${clientId} Unit ${unitNumber} (${billingPeriod}) in ${userLanguage}`);
    
    if (!recipientEmails || recipientEmails.length === 0) {
      throw new Error('Recipient email addresses are required');
    }
    
    // Get Firestore database
    const db = await getDb();
    
    // Fetch required Firebase documents
    console.log('📋 Fetching Firebase documents...');
    const [billDoc, readingsDoc, clientDoc, waterConfigDoc] = await Promise.all([
      db.collection('clients').doc(clientId).collection('projects').doc('waterBills')
        .collection('bills').doc(billingPeriod).get(),
      db.collection('clients').doc(clientId).collection('projects').doc('waterBills')
        .collection('readings').doc(billingPeriod).get(),
      db.collection('clients').doc(clientId).get(),
      db.collection('clients').doc(clientId).collection('config').doc('waterBills').get()
    ]);
    
    // Validate documents exist
    if (!billDoc.exists) {
      throw new Error(`Bill document not found: clients/${clientId}/projects/waterBills/bills/${billingPeriod}`);
    }
    if (!readingsDoc.exists) {
      throw new Error(`Readings document not found: clients/${clientId}/projects/waterBills/readings/${billingPeriod}`);
    }
    if (!clientDoc.exists) {
      throw new Error(`Client document not found: clients/${clientId}`);
    }
    if (!waterConfigDoc.exists) {
      throw new Error(`Water bill config not found: clients/${clientId}/config/waterBills`);
    }
    
    const billDocument = billDoc.data();
    const readingsDocument = readingsDoc.data();
    const clientConfig = clientDoc.data();
    const waterBillConfig = waterConfigDoc.data();
    
    console.log('✅ All Firebase documents loaded successfully');
    
    // Fetch email templates from Firebase
    const emailTemplateDoc = await db.collection('clients').doc(clientId)
      .collection('config').doc('emailTemplates').get();
    
    if (!emailTemplateDoc.exists) {
      throw new Error(`Email templates not found: clients/${clientId}/config/emailTemplates`);
    }
    
    const emailTemplates = emailTemplateDoc.data();
    const waterBillTemplates = emailTemplates.waterBill;
    
    if (!waterBillTemplates) {
      throw new Error('Water bill email templates not configured in Firebase');
    }
    
    // Select language-specific templates
    const templateLang = userLanguage === 'es' ? 'es' : 'en';
    const bodyTemplate = waterBillTemplates[`body_${templateLang}`];
    const subjectTemplate = waterBillTemplates[`subject_${templateLang}`];
    
    if (!bodyTemplate) {
      throw new Error(`Water bill body template not found for language: ${templateLang}`);
    }
    if (!subjectTemplate) {
      throw new Error(`Water bill subject template not found for language: ${templateLang}`);
    }
    
    console.log(`📧 Using ${templateLang} templates (body: ${bodyTemplate.length} chars)`);
    
    // Build template variables using GAAP-compliant system
    const templateVariables = await buildWaterBillTemplateVariables(
      billDocument,
      readingsDocument, 
      clientConfig,
      waterBillConfig,
      unitNumber,
      userLanguage
    );
    
    console.log('🔧 Template variables built successfully:', {
      unitNumber: templateVariables.__UnitNumber__,
      consumption: templateVariables.__WaterConsumption__,
      totalDue: templateVariables.__TotalAmountDue__,
      status: templateVariables.__PaymentStatus__
    });
    
    // Process templates with variables
    const processedSubject = processWaterBillTemplate(subjectTemplate, templateVariables);
    const processedBody = processWaterBillTemplate(bodyTemplate, templateVariables);
    
    // TEST MODE: Override emails for testing
    let finalRecipients = recipientEmails;
    const testEmailOverride = process.env.TEST_EMAIL_OVERRIDE;
    if (testEmailOverride) {
      console.log('🧪 TEST MODE: Overriding recipient emails to:', testEmailOverride);
      finalRecipients = [testEmailOverride];
    }
    
    // Create email transporter
    const transporter = createGmailTransporter();
    
    // Get client email configuration for sender info
    const emailConfigResult = await getEmailConfig(clientId, 'waterBill');
    let emailConfig = {};
    
    if (emailConfigResult.success) {
      emailConfig = emailConfigResult.data;
    } else {
      // Fallback configuration
      console.log('⚠️ No specific water bill email config found, using defaults');
      emailConfig = {
        fromName: clientConfig.basicInfo?.displayName || 'Property Management',
        fromEmail: 'ms@landesman.com',
        replyTo: 'ms@landesman.com'
      };
    }
    
    // Prepare email options
    const mailOptions = {
      from: {
        name: emailConfig.fromName || clientConfig.basicInfo?.displayName || 'Property Management',
        address: emailConfig.fromEmail || 'ms@landesman.com'
      },
      to: finalRecipients,
      cc: emailConfig.ccList || [],
      subject: processedSubject,
      html: processedBody,
      replyTo: emailConfig.replyTo || emailConfig.fromEmail
    };
    
    console.log('📤 Sending water bill email:', {
      to: finalRecipients,
      cc: emailConfig.ccList,
      subject: processedSubject,
      language: templateLang
    });
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Water bill email sent successfully:', info.messageId);
    
    // Log audit trail
    await writeAuditLog({
      module: 'water_bills',
      action: 'send_bill_email',
      parentPath: `clients/${clientId}/projects/waterBills`,
      docId: `${billingPeriod}-${unitNumber}`,
      friendlyName: `Water Bill Email: Unit ${unitNumber} - ${billingPeriod}`,
      notes: `Sent water bill email in ${templateLang} to ${finalRecipients.join(', ')} for Unit ${unitNumber}`,
    });
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: finalRecipients,
      cc: emailConfig.ccList,
      language: templateLang,
      unitNumber: unitNumber,
      billingPeriod: billingPeriod
    };
    
  } catch (error) {
    console.error('❌ Error sending water bill email:', error);
    
    // Log error to audit trail
    await writeAuditLog({
      module: 'water_bills',
      action: 'send_bill_email_failed',
      parentPath: `clients/${clientId}/projects/waterBills`,
      docId: `${billingPeriod}-${unitNumber}`,
      friendlyName: `Failed Water Bill Email: Unit ${unitNumber} - ${billingPeriod}`,
      notes: `Failed to send water bill email: ${error.message}`,
    });
    
    return {
      success: false,
      error: error.message,
      unitNumber: unitNumber,
      billingPeriod: billingPeriod
    };
  }
}

/**
 * Test water bill email with real AVII data
 * @param {string} unitNumber - Unit number to test (e.g., '101', '103', '106', '203', '204')
 * @param {string} userLanguage - Language to test ('en' or 'es')
 * @param {string} testEmail - Email address to send test to
 * @returns {object} Result of test email operation
 */
async function testWaterBillEmail(unitNumber = '101', userLanguage = 'en', testEmail = 'michael@landesman.com') {
  console.log(`🧪 Testing water bill email for AVII Unit ${unitNumber} in ${userLanguage}`);
  
  return await sendWaterBillEmail(
    'AVII',           // Client ID
    unitNumber,       // Unit number
    '2026-00',        // July 2025 billing period
    userLanguage,     // Language
    [testEmail],      // Test recipient
    { isTest: true }  // Test mode
  );
}

export {
  sendReceiptEmail,
  sendWaterBillEmail,
  testWaterBillEmail,
  testEmailConfig,
  createGmailTransporter,
  processEmailTemplate,
  processWaterBillTemplate
};
