/**
 * Nightly Scheduler - Unified Task Orchestrator
 * TASK-101: Runs at 3:00 AM Cancun time daily
 * 
 * Orchestrates:
 * - Backup (TASK-73) ✅ Ready
 * - Auto-Pay from Credit (TASK-90) - TODO
 * - Exchange Rate Download - TODO
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../backend/firebase.js';
import { runBackup } from '../backend/services/backupService.js';
import { getNow } from '../backend/services/DateService.js';
import { updateExchangeRates } from '../src/exchangeRatesUpdater.js';
import { syncLatestRatesToDev } from '../src/syncToDevDatabase.js';

/**
 * Main nightly scheduler function
 * Runs at 3:00 AM America/Cancun every day
 */
export const nightlyScheduler = onSchedule({
  schedule: '0 3 * * *',  // 3:00 AM daily
  timeZone: 'America/Cancun',
  memory: '1GiB',
  timeoutSeconds: 540,  // 9 minutes max
  retryCount: 1
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
  // TASK 4: Auto-Pay from Credit (FUTURE - TASK-90)
  // ═══════════════════════════════════════════════════════════════
  // Uncomment when autoPayService is implemented:
  // try {
  //   console.log('💳 [NIGHTLY] Running auto-pay...');
  //   const autoPayResult = await autoPayService.run();
  //   results.tasks.autoPay = { status: 'success', ...autoPayResult };
  // } catch (error) {
  //   console.error('❌ [NIGHTLY] Auto-pay failed:', error);
  //   results.tasks.autoPay = { status: 'failed', error: error.message };
  //   results.errors.push({ task: 'autoPay', error: error.message });
  // }
  
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

