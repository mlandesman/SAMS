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
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import { generateStatementData } from '../services/statementHtmlService.js';
import { getStatementData } from '../services/statementDataService.js';
import { generatePdf } from '../services/pdfService.js';
import { generateStatementEmailHtml } from '../templates/statementEmailTemplate.js';
import { getResizedImage } from '../services/imageResizeService.js';
import crypto from 'crypto';
import axios from 'axios';
import { getApp } from '../firebase.js';

import { DateTime } from 'luxon';

// =============================================================================
// EMAIL TESTING/DEV OVERRIDE
// =============================================================================
// In non-production environments, ALL emails are automatically redirected to
// a test address. This prevents accidentally emailing real users from Dev.
//
// Production: Emails go to real recipients
// Dev/Test:   Emails always go to sandyland.sams@gmail.com
//
// Override with: EMAIL_TEST_OVERRIDE=other@email.com (optional)
// =============================================================================

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || 
                       process.env.FIRESTORE_ENV === 'prod' ||
                       process.env.GCLOUD_PROJECT === 'sams-sandyland-prod';

// In Dev, always redirect to test email (can be overridden via env var if needed)
const DEV_TEST_EMAIL = 'sandyland.sams@gmail.com';
const EMAIL_TEST_OVERRIDE = IS_PRODUCTION ? null : (process.env.EMAIL_TEST_OVERRIDE || DEV_TEST_EMAIL);

/**
 * Apply test email override for non-production environments
 * Keeps the original recipient name but swaps in the test email address
 * Example: "Sofia Zerbarini <szerbarini@gmail.com>" → "Sofia Zerbarini <test@sandyland.com>"
 * 
 * @param {string|string[]|object|object[]} originalTo - Original recipient(s)
 *        Can be: "email@example.com", "Name <email@example.com>", 
 *                { name: "Name", address: "email@example.com" }, or arrays of these
 * @returns {{ to: string|string[]|object|object[], wasOverridden: boolean }}
 */
function applyEmailOverride(originalTo) {
  // In production, never override - emails go to real recipients
  if (IS_PRODUCTION) {
    return { to: originalTo, wasOverridden: false };
  }
  
  // In Dev/Test, EMAIL_TEST_OVERRIDE is always set (defaults to sandyland.sams@gmail.com)
  console.log(`📧 DEV MODE: Emails redirected to ${EMAIL_TEST_OVERRIDE}`);
  
  /**
   * Extract name from various email formats
   */
  function extractName(recipient) {
    if (!recipient) return null;
    
    // Object format: { name: "Name", address: "email@example.com" }
    if (typeof recipient === 'object' && recipient.name) {
      return recipient.name;
    }
    
    // String format: "Name <email@example.com>"
    if (typeof recipient === 'string') {
      const match = recipient.match(/^([^<]+)\s*</);
      if (match) {
        return match[1].trim();
      }
      // Just an email address, no name
      return null;
    }
    
    return null;
  }
  
  /**
   * Convert a single recipient to test format
   */
  function convertRecipient(recipient) {
    const name = extractName(recipient);
    const originalEmail = typeof recipient === 'object' ? recipient.address : recipient;
    
    if (name) {
      // "Original Name <test@email.com>"
      return `${name} <${EMAIL_TEST_OVERRIDE}>`;
    } else {
      // No name, just use test email
      return EMAIL_TEST_OVERRIDE;
    }
  }
  
  // Handle arrays
  if (Array.isArray(originalTo)) {
    const converted = originalTo.map(convertRecipient);
    console.log(`📧 DEV: Email redirected - ${originalTo.length} recipient(s) → ${EMAIL_TEST_OVERRIDE}`);
    originalTo.forEach((orig, i) => {
      console.log(`   ${i + 1}. ${typeof orig === 'object' ? orig.address || orig.name : orig} → ${converted[i]}`);
    });
    return { to: converted, wasOverridden: true };
  }
  
  // Handle single recipient
  const converted = convertRecipient(originalTo);
  const originalStr = typeof originalTo === 'object' ? originalTo.address || originalTo.name : originalTo;
  console.log(`📧 DEV: Email redirected: ${originalStr} → ${converted}`);
  
  return { to: converted, wasOverridden: true };
}

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
    
    // Apply test email override for non-production environments
    const { to: finalRecipients, wasOverridden } = applyEmailOverride(recipientEmails);
    
    // Prepare email options
    const mailOptions = {
      from: {
        name: emailConfig.fromName || 'Marina Turquesa Condominiums',
        address: emailConfig.fromEmail || 'ms@landesman.com'
      },
      to: finalRecipients,
      cc: wasOverridden ? [] : (emailConfig.ccList || []),  // Skip CC in test mode
      subject: subject,
      html: htmlBody,
      replyTo: emailConfig.replyTo || emailConfig.fromEmail,
      attachments: attachments
    };
    
    console.log('📤 Sending email to:', {
      to: finalRecipients,
      cc: wasOverridden ? '(skipped in test mode)' : emailConfig.ccList,
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
    
    // Apply test email override for non-production environments
    const { to: finalRecipients, wasOverridden } = applyEmailOverride(recipientEmails);
    
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
      cc: wasOverridden ? [] : (emailConfig.ccList || []),  // Skip CC in test mode
      subject: processedSubject,
      html: processedBody,
      replyTo: emailConfig.replyTo || emailConfig.fromEmail
    };
    
    console.log('📤 Sending water bill email:', {
      to: finalRecipients,
      cc: wasOverridden ? '(skipped in test mode)' : emailConfig.ccList,
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


/**
 * Get email language preference for a unit
 * Checks owner[0]'s preferredLanguage from users collection
 * Falls back to client default language
 */
async function getUnitEmailLanguage(unit, clientId) {
  const db = await getDb();
  const owners = normalizeOwners(unit.owners);
  
  if (!owners.length || !owners[0].email) {
    // Fallback to client default
    const clientDoc = await db.collection('clients').doc(clientId).get();
    return clientDoc.data()?.configuration?.defaultLanguage || 'english';
  }
  
  // Look up owner[0] in users collection
  const userSnapshot = await db.collection('users')
    .where('email', '==', owners[0].email)
    .limit(1)
    .get();
  
  if (userSnapshot.empty) {
    // Fallback to client default
    const clientDoc = await db.collection('clients').doc(clientId).get();
    return clientDoc.data()?.configuration?.defaultLanguage || 'english';
  }
  
  const userData = userSnapshot.docs[0].data();
  // Canonical location is profile.preferredLanguage
  // Fall back to top-level for backwards compatibility with older user docs
  const preferredLang = userData.profile?.preferredLanguage || userData.preferredLanguage;
  return preferredLang === 'spanish' || preferredLang === 'es' ? 'spanish' : 'english';
}


/**
 * Generate PDF URLs for statement (both languages)
 * PDFs may already exist from preview/generate, so we construct URLs
 * In future, can generate on-demand if needed
 */

/**
 * Generate a secure download token for PDF access
 * Token expires after 30 days
 */
function generateDownloadToken(clientId, unitId, fiscalYear, language) {
  // crypto is imported at top of file
  const secret = process.env.DOWNLOAD_TOKEN_SECRET || 'sams-statement-download-secret-change-in-production';
  
  // Create payload
  const payload = {
    clientId,
    unitId,
    fiscalYear,
    language,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  };
  
  // Create token: base64(hmac-sha256(payload, secret))
  const payloadStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadStr);
  const signature = hmac.digest('base64url');
  
  // Combine payload and signature
  const token = Buffer.from(payloadStr).toString('base64url') + '.' + signature;
  
  return token;
}



function getStorageBucketName() {
  // Check GCLOUD_PROJECT first (always set in Cloud Functions), then fall back to NODE_ENV
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}


export async function generateAndUploadPdfs(clientId, unitId, fiscalYear, authToken = null) {
  const now = getNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const basePath = `clients/${clientId}/accountStatements/${fiscalYear}`;
  const fileNameEn = `${year}-${month}-${unitId}-EN.PDF`;
  const fileNameEs = `${year}-${month}-${unitId}-ES.PDF`;
  const storagePathEn = `${basePath}/${fileNameEn}`;
  const storagePathEs = `${basePath}/${fileNameEs}`;
  
  // Generate PDFs
  const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
  const api = axios.create({
    baseURL: baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    },
    timeout: 60000
  });
  
  // Get Firebase app and bucket
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  
  // Generate and upload English PDF
  const statementEn = await generateStatementData(api, clientId, unitId, {
    fiscalYear,
    language: 'english'
  });
  const pdfBufferEn = await generatePdf(statementEn.html);
  
  const fileEn = bucket.file(storagePathEn);
  await fileEn.save(pdfBufferEn, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        clientId,
        unitId,
        fiscalYear: fiscalYear.toString(),
        language: 'english',
        generatedAt: new Date().toISOString()
      }
    }
  });
  
  // Generate and upload Spanish PDF
  const statementEs = await generateStatementData(api, clientId, unitId, {
    fiscalYear,
    language: 'spanish'
  });
  const pdfBufferEs = await generatePdf(statementEs.html);
  
  const fileEs = bucket.file(storagePathEs);
  await fileEs.save(pdfBufferEs, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        clientId,
        unitId,
        fiscalYear: fiscalYear.toString(),
        language: 'spanish',
        generatedAt: new Date().toISOString()
      }
    }
  });
  
  // Make files publicly readable
  await fileEn.makePublic();
  await fileEs.makePublic();
  
  // Return public URLs directly (no signed URL needed since files are public)
  // This avoids the iam.serviceAccounts.signBlob permission requirement
  return {
    en: `https://storage.googleapis.com/${bucketName}/${storagePathEn}`,
    es: `https://storage.googleapis.com/${bucketName}/${storagePathEs}`
  };

}




/**
 * Get default statement email template if client doesn't have custom one
 */
function getDefaultStatementTemplate() {
  return {
    subject_en: 'Statement of Account - Unit __UnitNumber__ - FY __FiscalYearLabel__',
    subject_es: 'Estado de Cuenta - Unidad __UnitNumber__ - Año Fiscal __FiscalYearLabel__',
    body_en: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
    <p style="font-size: 11px; color: #666; margin: 0 0 15px 0; padding: 8px 12px; background: #f0f0f0; border-radius: 4px;">
      ℹ️ If this email doesn't display correctly, please download the PDF version below.
    </p>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p>Dear __OwnerName__,</p>
      <p>Please find below your Statement of Account for Fiscal Year __FiscalYearLabel__. This statement reflects all charges, payments, and your current balance as of __StatementDate__.</p>
      <p>Your current balance due is: <strong>__BalanceDue__</strong></p>
    </div>
    
    <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      __StatementHtml__
    </div>
    
    <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <a href="__PdfLinkEn__" style="display: inline-block; margin: 5px 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">📄 Download PDF (English)</a>
      <a href="__PdfLinkEs__" style="display: inline-block; margin: 5px 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">📄 Descargar PDF (Español)</a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p>If you have any questions about your statement, please don't hesitate to contact us.</p>
      <p>Best regards,</p>
      <p><strong>__ClientName__ Administrators</strong><br>
      Sandyland Properties<br>
      <a href="mailto:pm@sandyland.com.mx">pm@sandyland.com.mx</a></p>
    </div>
  </div>
</body>
</html>`,
    body_es: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
    <p style="font-size: 11px; color: #666; margin: 0 0 15px 0; padding: 8px 12px; background: #f0f0f0; border-radius: 4px;">
      ℹ️ Si este correo no se muestra correctamente, descargue la versión PDF a continuación.
    </p>
<div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <p>Estimado/a __OwnerName__,</p>
      <p>A continuación encontrará su Estado de Cuenta para el Año Fiscal __FiscalYearLabel__. Este estado refleja todos los cargos, pagos y su saldo actual al __StatementDate__.</p>
      <p>Su saldo pendiente es: <strong>__BalanceDue__</strong></p>
    </div>
    
    <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      __StatementHtml__
    </div>
    
    <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <a href="__PdfLinkEn__" style="display: inline-block; margin: 5px 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">📄 Download PDF (English)</a>
      <a href="__PdfLinkEs__" style="display: inline-block; margin: 5px 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">📄 Descargar PDF (Español)</a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p>Si tiene alguna pregunta sobre su estado de cuenta, no dude en contactarnos.</p>
      <p>Atentamente,</p>
      <p><strong>Administradores de __ClientName__</strong><br>
      Sandyland Properties<br>
      <a href="mailto:pm@sandyland.com.mx">pm@sandyland.com.mx</a></p>
    </div>
  </div>
</body>
</html>`
  };
}


/**
 * Send Statement of Account email to unit owners/managers
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} fiscalYear - Fiscal year
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} Result with success status
 */


/**
 * Send Statement of Account email to unit owners/managers
 */
export async function sendStatementEmail(clientId, unitId, fiscalYear, user, authToken = null, languageOverride = null, emailContent = null) {
  try {
    console.log(`📧 Sending statement email for ${clientId} Unit ${unitId} (FY ${fiscalYear})${languageOverride ? ` [override: ${languageOverride}]` : ''}`);
    
    const db = await getDb();
    
    // Get unit data
    const unitDoc = await db.collection('clients').doc(clientId)
      .collection('units').doc(unitId).get();
    
    if (!unitDoc.exists) {
      return { success: false, error: `Unit ${unitId} not found` };
    }
    
    const unit = { id: unitDoc.id, ...unitDoc.data() };
    
    // Extract recipients
    const owners = normalizeOwners(unit.owners);
    const managers = normalizeManagers(unit.managers);
    
    const toEmails = owners.filter(o => o.email).map(o => o.email);
    const ccEmails = managers.filter(m => m.email).map(m => m.email);
    
    if (toEmails.length === 0) {
      return { success: false, error: 'No owner email addresses found for this unit' };
    }
    
    // Get language: use override if provided (single email from Report View), 
    // otherwise look up user's preferred language (Email All)
    const language = languageOverride || await getUnitEmailLanguage(unit, clientId);
    
    // Get client info
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return { success: false, error: `Client ${clientId} not found` };
    }
    const clientData = clientDoc.data();
    const clientName = clientData.basicInfo?.fullName || clientData.name || clientId;
    const clientLogoUrl = clientData.branding?.logoUrl || '';
    
    // OPTIMIZATION: Use pre-calculated emailContent if available (from preview)
    // This skips expensive recalculation when data is already available
    let balanceDue, creditBalance, netAmount, bankName, bankAccount, bankClabe, beneficiary, reference;
    let brandColor, ownerNames, asOfDate;
    let pdfBuffer, pdfUrls, emailLogoUrl, statementResult;
    let statementMeta = null;
    
    if (emailContent) {
      // Use pre-calculated data (fast path - no recalculation)
      console.log(`⚡ Using pre-calculated emailContent (optimized path)`);
      balanceDue = emailContent.balanceDue || 0;
      creditBalance = emailContent.creditBalance || 0;
      netAmount = emailContent.netAmount || 0;
      bankName = emailContent.bankName || '';
      bankAccount = emailContent.bankAccount || '';
      bankClabe = emailContent.bankClabe || '';
      beneficiary = emailContent.beneficiary || '';
      reference = emailContent.reference || '';
      brandColor = emailContent.brandColor || '#1a365d';
      ownerNames = emailContent.ownerNames || 'Owner';
      
      // Format statement date
      const statementDate = DateTime.fromJSDate(getNow()).setZone('America/Cancun');
      const isSpanish = language === 'spanish' || language === 'es';
      asOfDate = isSpanish 
        ? statementDate.toFormat("d 'de' MMMM 'de' yyyy", { locale: 'es' })
        : statementDate.toFormat('MMMM d, yyyy');
      
      // Still need to generate PDF (but can use HTML from emailContent if available)
      // For now, we'll still generate it, but this could be further optimized
      const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
      const api = axios.create({
        baseURL: baseURL,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        timeout: 60000
      });
      
      // Generate statement HTML for PDF (still needed for attachment)
      statementResult = await generateStatementData(api, clientId, unitId, { 
        fiscalYear, 
        language
      });
      statementMeta = statementResult.meta;
      
      // Generate PDF buffer for attachment
      pdfBuffer = await generatePdf(statementResult.html, {
        footerMeta: {
          statementId: statementResult.meta?.statementId,
          generatedAt: statementResult.meta?.generatedAt,
          language: statementResult.meta?.language
        }
      });
      
      // Generate and upload PDFs to storage for download links (backup)
      pdfUrls = await generateAndUploadPdfs(clientId, unitId, fiscalYear, authToken);
      
      // Get email-sized logo (resize if needed)
      const logoUrl = emailContent.logoUrl || clientLogoUrl;
      emailLogoUrl = null;
      if (logoUrl && logoUrl.trim()) {
        try {
          if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
            try {
              emailLogoUrl = await getResizedImage(logoUrl, clientId, 'email');
              console.log(`✅ Logo resized for email: ${emailLogoUrl}`);
              if (!emailLogoUrl || !emailLogoUrl.startsWith('http')) {
                emailLogoUrl = logoUrl;
              }
            } catch (resizeError) {
              emailLogoUrl = logoUrl;
            }
          }
        } catch (error) {
          emailLogoUrl = null;
        }
      }
    } else {
      // Fallback: Full calculation (for bulk email or when emailContent not available)
      console.log(`🔄 Calculating statement data (full path)`);
      const baseURL = process.env.API_BASE_URL || 'http://localhost:5001';
      const api = axios.create({
        baseURL: baseURL,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        timeout: 60000
      });
      
      // Get statement data first (needed for credit balance)
      const statementData = await getStatementData(api, clientId, unitId, fiscalYear);
      
      // Generate statement HTML for PDF (use default format, not email format)
      statementResult = await generateStatementData(api, clientId, unitId, { 
        fiscalYear, 
        language
      });
      statementMeta = statementResult.meta;
      
      // Generate PDF buffer for attachment
      pdfBuffer = await generatePdf(statementResult.html, {
        footerMeta: {
          statementId: statementResult.meta?.statementId,
          generatedAt: statementResult.meta?.generatedAt,
          language: statementResult.meta?.language
        }
      });
      
      // Generate and upload PDFs to storage for download links (backup)
      pdfUrls = await generateAndUploadPdfs(clientId, unitId, fiscalYear, authToken);
      
      // Get email-sized logo (resize if needed)
      emailLogoUrl = null;
      if (clientLogoUrl && clientLogoUrl.trim()) {
        try {
          if (clientLogoUrl.startsWith('http://') || clientLogoUrl.startsWith('https://')) {
            try {
              emailLogoUrl = await getResizedImage(clientLogoUrl, clientId, 'email');
              console.log(`✅ Logo resized for email: ${emailLogoUrl}`);
              if (!emailLogoUrl || !emailLogoUrl.startsWith('http')) {
                emailLogoUrl = clientLogoUrl;
              }
            } catch (resizeError) {
              emailLogoUrl = clientLogoUrl;
            }
          }
        } catch (error) {
          emailLogoUrl = null;
        }
      }
      
      // Extract financial data
      balanceDue = statementResult.summary?.closingBalance || 0;
      creditBalance = statementData.creditInfo?.currentBalance || 0;
      netAmount = balanceDue - creditBalance;
      
      // Extract bank payment info from client config
      const bankDetails = clientData.feeStructure?.bankDetails || {};
      bankName = bankDetails.bankName || bankDetails.name || '';
      bankAccount = bankDetails.accountNumber || bankDetails.account || bankDetails.accountNo || bankDetails.cuenta || '';
      bankClabe = bankDetails.clabe || '';
      beneficiary = bankDetails.accountName || bankDetails.beneficiary || clientName;
      reference = bankDetails.reference || `Unit ${unitId}`;
      
      // Get brand color
      brandColor = clientData.branding?.brandColors?.primary || '#1a365d';
      
      // Format owner names
      ownerNames = owners.map(o => o.name).filter(Boolean).join(', ') || 'Owner';
      
      // Format statement date
      const statementDate = DateTime.fromJSDate(getNow()).setZone('America/Cancun');
      const isSpanish = language === 'spanish' || language === 'es';
      asOfDate = isSpanish 
        ? statementDate.toFormat("d 'de' MMMM 'de' yyyy", { locale: 'es' })
        : statementDate.toFormat('MMMM d, yyyy');
    }
    
    const isSpanish = language === 'spanish' || language === 'es';
    
    // Build email HTML using new notification-style template
    const emailHtml = generateStatementEmailHtml({
      unitNumber: unitId,
      ownerNames: ownerNames,
      fiscalYear: fiscalYear.toString(),
      asOfDate: asOfDate,
      balanceDue: balanceDue,
      creditBalance: creditBalance,
      netAmount: netAmount,
      bankName: bankName,
      bankAccount: bankAccount,
      bankClabe: bankClabe,
      beneficiary: beneficiary,
      reference: reference,
      logoUrl: emailLogoUrl,
      brandColor: brandColor,
      pdfDownloadUrlEn: pdfUrls.en || '',
      pdfDownloadUrlEs: pdfUrls.es || '',
      clientName: clientName,
      contactEmail: clientData.contactInfo?.primaryEmail || 'pm@sandyland.com.mx'
    }, isSpanish ? 'es' : 'en');
    
    // Build email subject
    const subject = isSpanish
      ? `Estado de Cuenta - Depto ${unitId} - Año Fiscal ${fiscalYear}`
      : `Statement of Account - Unit ${unitId} - Fiscal Year ${fiscalYear}`;
    
    // Apply test email override for non-production environments
    const { to: finalToEmails, wasOverridden } = applyEmailOverride(toEmails);
    
    // Send email with PDF attachment
    const transporter = createGmailTransporter();
    const info = await transporter.sendMail({
      from: { name: `${clientName} Administrators`, address: 'pm@sandyland.com.mx' },
      to: finalToEmails,
      cc: wasOverridden ? undefined : (ccEmails.length > 0 ? ccEmails : undefined),  // Skip CC in test mode
      subject: subject,
      html: emailHtml,
      replyTo: 'pm@sandyland.com.mx',
      attachments: [
        {
          filename: `Statement_${clientId}_${unitId}_FY${fiscalYear}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
          contentDisposition: 'inline',  // Allow Mac Mail to auto-render PDF
          cid: 'statement-pdf'  // Content-ID for inline reference (if needed)
        }
      ]
    });
    
    // Audit log
    await writeAuditLog({
      module: 'email',
      action: 'send_statement',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: `Statement email for Unit ${unitId}`,
      notes: `Sent to: ${toEmails.join(', ')}${wasOverridden ? ' (redirected to test)' : ''}. CC: ${ccEmails.join(', ') || 'none'}. Language: ${language}`,
      userId: user.uid
    });
    
    return { success: true, to: toEmails, cc: ccEmails, language, messageId: info.messageId, wasOverridden };
    
  } catch (error) {
    console.error('❌ Error sending statement email:', error);
    await writeAuditLog({
      module: 'email',
      action: 'send_statement_failed',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: `Failed Statement Email: Unit ${unitId}`,
      notes: `Failed: ${error.message}`,
      userId: user?.uid
    });
    return { success: false, error: error.message };
  }
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
