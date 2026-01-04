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

/**
 * Create Gmail transporter for sending emails
 * @returns {object} Nodemailer transporter
 */
function createGmailTransporter() {
  const gmailUser = process.env.GMAIL_USER || 'michael@landesman.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  
  console.log('🔧 Gmail transporter config:');
  console.log('   User:', gmailUser);
  console.log('   Password set:', gmailPass ? `Yes (${gmailPass.length} chars)` : 'No');
  
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
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📧 CREDIT AUTO-PAY REPORT - ${clientId}`);
  console.log(`${'='.repeat(80)}\n`);
  
  try {
    // Generate report data
    console.log(`📊 Generating report data for ${clientId}...`);
    const reportData = await generateCreditAutoPayReportData(clientId);
    
    // Check if there are any units to report
    if (reportData.totals.unitCount === 0) {
      console.log(`ℹ️ No units with payable bills for ${clientId}, skipping email`);
      return {
        success: true,
        skipped: true,
        clientId,
        reason: 'No units with payable bills',
        unitCount: 0
      };
    }
    
    console.log(`✅ Report data generated: ${reportData.totals.unitCount} units, $${reportData.totals.totalWouldPay.toFixed(2)} would be paid`);
    
    // Generate HTML email
    console.log(`🎨 Generating HTML email...`);
    const htmlContent = generateCreditAutoPayEmailHTML(reportData);
    console.log(`✅ HTML generated (${htmlContent.length} characters)`);
    
    // Get recipients
    const recipients = await getCreditAutoPayEmailRecipients(clientId);
    
    if (recipients.length === 0) {
      console.warn(`⚠️ No email recipients found for ${clientId}`);
      return {
        success: false,
        error: 'No email recipients configured',
        clientId,
        unitCount: reportData.totals.unitCount
      };
    }
    
    console.log(`📬 Recipients: ${recipients.join(', ')}`);
    
    // Dry run mode - don't actually send
    if (isDryRun) {
      console.log(`\n🔍 DRY RUN MODE - Email not sent`);
      console.log(`   Would send to: ${recipients.join(', ')}`);
      console.log(`   Subject: Credit Auto-Pay Report - ${reportData.date}`);
      console.log(`   Units: ${reportData.totals.unitCount}`);
      console.log(`   Total Would Pay: $${reportData.totals.totalWouldPay.toFixed(2)}`);
      
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
    console.log(`📤 Sending email...`);
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
    
    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Recipients: ${recipients.join(', ')}`);
    
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
    console.error(`❌ Error sending credit auto-pay report for ${clientId}:`, error);
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
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📧 CREDIT AUTO-PAY REPORTS - ALL CLIENTS`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(80)}\n`);
  
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
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`   Total Clients: ${results.summary.total}`);
  console.log(`   Sent: ${results.summary.sent}`);
  console.log(`   Skipped: ${results.summary.skipped}`);
  console.log(`   Failed: ${results.summary.failed}`);
  console.log(`${'='.repeat(80)}\n`);
  
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
    
    console.log(`\n🎯 Manual trigger received:`);
    console.log(`   Client: ${client || 'ALL'}`);
    console.log(`   Dry Run: ${isDryRun}`);
    
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
    console.error('❌ Manual trigger error:', error);
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
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🌙 SCHEDULED CREDIT AUTO-PAY REPORTS`);
  console.log(`   Time: ${DateTime.now().setZone('America/Cancun').toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
  console.log(`${'='.repeat(80)}\n`);
  
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
