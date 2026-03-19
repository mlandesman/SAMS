/**
 * Nightly Scheduler - Unified Task Orchestrator
 * TASK-101: Runs at 3:00 AM Cancun time daily
 * 
 * Orchestrates:
 * - Backup (TASK-73) ✅ Ready
 * - Exchange Rate Download ✅ Ready
 * - Sync to Dev ✅ Ready
 * - Credit Auto-Pay Report Email (TASK-90 Phase 2) ✅ Monthly on the 25th
 * - Monthly Statement Generation (Sprint AUTO-STMT) ✅ Monthly on the 1st
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../backend/firebase.js';
import { runBackup } from '../backend/services/backupService.js';
import { getNow } from '../backend/services/DateService.js';
import { updateExchangeRates } from '../src/exchangeRatesUpdater.js';
import { syncLatestRatesToDev } from '../src/syncToDevDatabase.js';
import { runScheduledCreditAutoPayReports } from '../backend/controllers/creditAutoPayReportController.js';
import { generateMonthlyStatements } from '../backend/services/scheduledStatementService.js';

/**
 * Main nightly scheduler function
 * Runs at 3:00 AM America/Cancun every day
 */
export const nightlyScheduler = onSchedule({
  schedule: '0 3 * * *',  // 3:00 AM daily
  timeZone: 'America/Cancun',
  memory: '2GiB',
  timeoutSeconds: 900,  // 15 minutes max (monthly statement generation needs more time)
  retryCount: 1,
  secrets: ['GMAIL_APP_PASSWORD']
}, async (event) => {
  console.log('🌙 [NIGHTLY] Starting scheduled tasks');
  const startTime = Date.now();
  
  const results = {
    timestamp: getNow().toISOString(),
    tasks: {},
    errors: [],
    durationMs: 0
  };
  
  // ═══════════════════════════════════════════════════════════════
  // TASK 1: Backup
  // ═══════════════════════════════════════════════════════════════
  try {
    console.log('📦 [NIGHTLY] Running backup...');
    const backupResult = await runBackup('scheduled');
    results.tasks.backup = {
      status: 'success',
      backupId: backupResult.id,
      durationMs: backupResult.durationMs
    };
    console.log(`✅ [NIGHTLY] Backup complete: ${backupResult.id}`);
  } catch (error) {
    console.error('❌ [NIGHTLY] Backup failed:', error);
    results.tasks.backup = { status: 'failed', error: error.message };
    results.errors.push({ task: 'backup', error: error.message });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TASK 2: Exchange Rate Update
  // ═══════════════════════════════════════════════════════════════
  try {
    console.log('💱 [NIGHTLY] Updating exchange rates...');
    const rateResult = await updateExchangeRates();
    results.tasks.exchangeRate = { 
      status: 'success', 
      date: rateResult.date,
      rates: rateResult.rates 
    };
    console.log('✅ [NIGHTLY] Exchange rates updated successfully');
  } catch (error) {
    console.error('❌ [NIGHTLY] Exchange rate update failed:', error);
    results.tasks.exchangeRate = { status: 'failed', error: error.message };
    results.errors.push({ task: 'exchangeRate', error: error.message });
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK 3: Sync to Dev (The "Pull" to Dev environment)
  // ═══════════════════════════════════════════════════════════════
  try {
    console.log('🔄 [NIGHTLY] Syncing rates to development environment...');
    const syncResult = await syncLatestRatesToDev();
    results.tasks.syncToDev = { status: 'success', ...syncResult };
    console.log('✅ [NIGHTLY] Sync to Dev complete');
  } catch (error) {
    console.error('❌ [NIGHTLY] Sync to Dev failed:', error);
    // Note: We don't fail the whole run if sync to dev fails, but we log it
    results.tasks.syncToDev = { status: 'failed', error: error.message };
    results.errors.push({ task: 'syncToDev', error: error.message });
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK 4: Credit Auto-Pay Report Email (TASK-90 Phase 2)
  // Runs monthly on the 25th (Cancun time)
  // ═══════════════════════════════════════════════════════════════
  const nowCancun = getNow();
  const dayOfMonth = nowCancun.getDate();
  if (dayOfMonth === 25) {
    try {
      console.log('📧 [NIGHTLY] Sending monthly credit auto-pay reports (day 25)...');
      const reportResult = await runScheduledCreditAutoPayReports();
      results.tasks.creditAutoPayReport = {
        status: 'success',
        sent: reportResult.summary.sent,
        skipped: reportResult.summary.skipped,
        failed: reportResult.summary.failed
      };
      console.log(`✅ [NIGHTLY] Credit auto-pay reports complete: ${reportResult.summary.sent} sent, ${reportResult.summary.skipped} skipped`);
    } catch (error) {
      console.error('❌ [NIGHTLY] Credit auto-pay report failed:', error);
      results.tasks.creditAutoPayReport = { status: 'failed', error: error.message };
      results.errors.push({ task: 'creditAutoPayReport', error: error.message });
    }
  } else {
    results.tasks.creditAutoPayReport = {
      status: 'skipped',
      reason: 'Monthly task; only runs on day 25 (America/Cancun)',
      dayOfMonth
    };
    console.log(`⏭️ [NIGHTLY] Skipping credit auto-pay reports (day ${dayOfMonth}); runs on day 25 only.`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TASK 5: Monthly Statement Generation (Sprint AUTO-STMT)
  // Runs on the 1st of each month — generates prior month statements
  // for all clients, all units, both English and Spanish
  // ═══════════════════════════════════════════════════════════════
  if (dayOfMonth === 1) {
    try {
      console.log('📄 [NIGHTLY] Generating monthly statements (day 1)...');
      const stmtResult = await generateMonthlyStatements();
      results.tasks.monthlyStatements = {
        status: stmtResult.error ? 'partial_failure' : 'success',
        period: stmtResult.statementPeriod,
        clients: stmtResult.clients?.length || 0,
        totalUnits: stmtResult.totalUnits,
        generated: stmtResult.totalGenerated,
        replaced: stmtResult.totalReplaced,
        failed: stmtResult.totalFailed,
        durationMs: stmtResult.durationMs
      };
      console.log(`✅ [NIGHTLY] Monthly statements complete: ${stmtResult.totalGenerated} generated (${stmtResult.totalReplaced} replaced), ${stmtResult.totalFailed} failed`);
    } catch (error) {
      console.error('❌ [NIGHTLY] Monthly statement generation failed:', error);
      results.tasks.monthlyStatements = { status: 'failed', error: error.message };
      results.errors.push({ task: 'monthlyStatements', error: error.message });
    }
  } else {
    results.tasks.monthlyStatements = {
      status: 'skipped',
      reason: 'Monthly task; only runs on day 1 (America/Cancun)',
      dayOfMonth
    };
    console.log(`⏭️ [NIGHTLY] Skipping monthly statements (day ${dayOfMonth}); runs on day 1 only.`);
  }

  // ═══════════════════════════════════════════════════════════════
  // Log results to Firestore
  // ═══════════════════════════════════════════════════════════════
  results.durationMs = Date.now() - startTime;
  results.overallStatus = results.errors.length === 0 ? 'success' : 'partial_failure';
  
  const db = await getDb();
  const dateStr = getNow().toISOString().split('T')[0]; // YYYY-MM-DD
  
  await db.collection('system').doc('nightlyScheduler')
    .collection('runs').doc(dateStr)
    .set(results);
  
  console.log(`🌙 [NIGHTLY] Complete. Status: ${results.overallStatus}, Duration: ${results.durationMs}ms`);
  
  // If any errors, log them prominently (could add alerting here)
  if (results.errors.length > 0) {
    console.error('⚠️ [NIGHTLY] Errors occurred:', JSON.stringify(results.errors));
    // Future: Send alert email/Slack notification
  }
  
  return results;
});

