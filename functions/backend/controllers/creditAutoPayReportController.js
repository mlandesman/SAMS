/**
 * Credit Auto-Pay Report Controller
 * Handles manual and scheduled execution of credit auto-pay email reports
 * TASK-90 Phase 2
 */

import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { DateTime } from 'luxon';
import { 
  generateCreditAutoPayReportData, 
  generateCreditAutoPayEmailHTML,
  getCreditAutoPayEmailRecipients 
} from '../services/creditAutoPayReportService.js';
import nodemailer from 'nodemailer';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

/**
 * Create Gmail transporter for sending emails
 * @returns {object} Nodemailer transporter
 */
function createGmailTransporter() {
  const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  logDebug('🔧 Gmail transporter config:');
  logDebug('   User:', gmailUser);
  logDebug('   Password set:', gmailPass ? `Yes (${gmailPass.length} chars)` : 'No');
  
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
 * Send credit auto-pay report email for a specific client
 * @param {string} clientId - Client ID (e.g., 'MTC', 'AVII')
 * @param {boolean} isDryRun - If true, generate report but don't send email
 * @returns {Promise<Object>} Result object with success status
 */
export async function sendCreditAutoPayReport(clientId, isDryRun = false) {
  logDebug(`\n${'='.repeat(80)}`);
  logDebug(`📧 CREDIT AUTO-PAY REPORT - ${clientId}`);
  logDebug(`${'='.repeat(80)}\n`);
  
  try {
    // Generate report data
    logDebug(`📊 Generating report data for ${clientId}...`);
    const reportData = await generateCreditAutoPayReportData(clientId);
    
    // Check if there are any units to report
    if (reportData.totals.unitCount === 0) {
      logDebug(`ℹ️ No units with payable bills for ${clientId}, skipping email`);
      return {
        success: true,
        skipped: true,
        clientId,
        reason: 'No units with payable bills',
        unitCount: 0
      };
    }
    
    logDebug(`✅ Report data generated: ${reportData.totals.unitCount} units, $${reportData.totals.totalWouldPay.toFixed(2)} would be paid`);
    
    // Generate HTML email
    logDebug(`🎨 Generating HTML email...`);
    const htmlContent = generateCreditAutoPayEmailHTML(reportData);
    logDebug(`✅ HTML generated (${htmlContent.length} characters)`);
    
    // Get recipients
    const recipients = await getCreditAutoPayEmailRecipients(clientId);
    
    if (recipients.length === 0) {
      logWarn(`⚠️ No email recipients found for ${clientId}`);
      return {
        success: false,
        error: 'No email recipients configured',
        clientId,
        unitCount: reportData.totals.unitCount
      };
    }
    
    logDebug(`📬 Recipients: ${recipients.join(', ')}`);
    
    // Dry run mode - don't actually send
    if (isDryRun) {
      logDebug(`\n🔍 DRY RUN MODE - Email not sent`);
      logDebug(`   Would send to: ${recipients.join(', ')}`);
      logDebug(`   Subject: Credit Auto-Pay Report - ${reportData.date}`);
      logDebug(`   Units: ${reportData.totals.unitCount}`);
      logDebug(`   Total Would Pay: $${reportData.totals.totalWouldPay.toFixed(2)}`);
      
      return {
        success: true,
        dryRun: true,
        clientId,
        recipients,
        unitCount: reportData.totals.unitCount,
        totalWouldPay: reportData.totals.totalWouldPay,
        htmlPreview: htmlContent.substring(0, 500) + '...'
      };
    }
    
    // Send email
    logDebug(`📤 Sending email...`);
    const transporter = createGmailTransporter();
    
    // Get client name from report data
    const clientName = reportData.clients[0]?.clientName || clientId;
    
    const mailOptions = {
      from: {
        name: 'Sandyland Properties',
        address: 'pm@sandyland.com.mx'
      },
      to: recipients,
      subject: `Credit Auto-Pay Report - ${clientName} - ${reportData.date}`,
      html: htmlContent,
      replyTo: 'pm@sandyland.com.mx'
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    logDebug(`✅ Email sent successfully!`);
    logDebug(`   Message ID: ${info.messageId}`);
    logDebug(`   Recipients: ${recipients.join(', ')}`);
    
    // Log to Firestore
    const db = await getDb();
    await db.collection('system').doc('creditAutoPayReports')
      .collection('sent').add({
        clientId,
        timestamp: getNow().toISOString(),
        recipients,
        unitCount: reportData.totals.unitCount,
        totalWouldPay: reportData.totals.totalWouldPay,
        totalPenalties: reportData.totals.totalPenalties,
        messageId: info.messageId,
        triggeredBy: 'manual' // Will be 'scheduled' when called from nightly scheduler
      });
    
    return {
      success: true,
      clientId,
      messageId: info.messageId,
      recipients,
      unitCount: reportData.totals.unitCount,
      totalWouldPay: reportData.totals.totalWouldPay
    };
    
  } catch (error) {
    logError(`❌ Error sending credit auto-pay report for ${clientId}:`, error);
    return {
      success: false,
      error: error.message,
      clientId
    };
  }
}

/**
 * Send credit auto-pay reports for all clients
 * @param {boolean} isDryRun - If true, generate reports but don't send emails
 * @returns {Promise<Object>} Results for all clients
 */
export async function sendAllCreditAutoPayReports(isDryRun = false) {
  logDebug(`\n${'='.repeat(80)}`);
  logDebug(`📧 CREDIT AUTO-PAY REPORTS - ALL CLIENTS`);
  logDebug(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  logDebug(`${'='.repeat(80)}\n`);
  
  const clients = ['MTC', 'AVII'];
  const results = {
    timestamp: getNow().toISOString(),
    clients: {},
    summary: {
      total: clients.length,
      sent: 0,
      skipped: 0,
      failed: 0
    }
  };
  
  for (const clientId of clients) {
    const result = await sendCreditAutoPayReport(clientId, isDryRun);
    results.clients[clientId] = result;
    
    if (result.success) {
      if (result.skipped) {
        results.summary.skipped++;
      } else {
        results.summary.sent++;
      }
    } else {
      results.summary.failed++;
    }
  }
  
  logDebug(`\n${'='.repeat(80)}`);
  logDebug(`📊 SUMMARY`);
  logDebug(`${'='.repeat(80)}`);
  logDebug(`   Total Clients: ${results.summary.total}`);
  logDebug(`   Sent: ${results.summary.sent}`);
  logDebug(`   Skipped: ${results.summary.skipped}`);
  logDebug(`   Failed: ${results.summary.failed}`);
  logDebug(`${'='.repeat(80)}\n`);
  
  return results;
}

/**
 * Express route handler for manual trigger
 * GET /api/reports/credit-auto-pay/send?client=MTC&dryRun=true
 */
export async function handleManualTrigger(req, res) {
  try {
    const { client, dryRun } = req.query;
    const isDryRun = dryRun === 'true';
    
    logDebug(`\n🎯 Manual trigger received:`);
    logDebug(`   Client: ${client || 'ALL'}`);
    logDebug(`   Dry Run: ${isDryRun}`);
    
    let result;
    
    if (client) {
      // Send for specific client
      result = await sendCreditAutoPayReport(client, isDryRun);
    } else {
      // Send for all clients
      result = await sendAllCreditAutoPayReports(isDryRun);
    }
    
    res.json({
      success: true,
      dryRun: isDryRun,
      result
    });
    
  } catch (error) {
    logError('❌ Manual trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Scheduled function handler (called from nightly scheduler)
 * @returns {Promise<Object>} Results for all clients
 */
export async function runScheduledCreditAutoPayReports() {
  logDebug(`\n${'='.repeat(80)}`);
  logDebug(`🌙 SCHEDULED CREDIT AUTO-PAY REPORTS`);
  logDebug(`   Time: ${DateTime.now().setZone('America/Cancun').toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
  logDebug(`${'='.repeat(80)}\n`);
  
  const results = await sendAllCreditAutoPayReports(false); // Live mode
  
  // Log to Firestore for scheduler tracking
  const db = await getDb();
  const dateStr = getNow().toISOString().split('T')[0]; // YYYY-MM-DD
  
  await db.collection('system').doc('creditAutoPayReports')
    .collection('scheduled').doc(dateStr)
    .set({
      ...results,
      triggeredBy: 'scheduled'
    });
  
  return results;
}
