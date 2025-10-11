/**
 * Audit Logs Cleanup System for Client Deletion
 * 
 * Backs up and purges audit logs for specific client
 * Searches by parentPath pattern: "clients/{clientId}"
 * Will be integrated into complete client deletion process
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 3 Audit Cleanup
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';

const CLIENT_ID = 'MTC';
const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Search audit logs by parentPath pattern
 */
async function findClientAuditLogs(db, clientId) {
  console.log(`🔍 Searching audit logs for client: ${clientId}...\n`);
  
  const auditLogsRef = db.collection('auditLogs');
  const parentPathPattern = `clients/${clientId}`;
  
  try {
    // Query for exact match and prefix match
    console.log(`📊 Searching for parentPath starting with: "${parentPathPattern}"`);
    
    // Get all audit logs (since we need to filter by parentPath prefix)
    const snapshot = await auditLogsRef.get();
    
    console.log(`📄 Total audit logs in database: ${snapshot.size}`);
    
    const clientAuditLogs = [];
    let matchCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const parentPath = data.parentPath || '';
      
      // Check if parentPath starts with our client pattern
      if (parentPath.startsWith(parentPathPattern)) {
        clientAuditLogs.push({
          id: doc.id,
          data: data,
          parentPath: parentPath
        });
        matchCount++;
      }
    });
    
    console.log(`✅ Found ${matchCount} audit logs for ${clientId}`);
    
    // Group by action type for analysis
    const logsByAction = {};
    const logsByModule = {};
    
    clientAuditLogs.forEach(log => {
      const action = log.data.action || 'unknown';
      const module = log.data.module || 'unknown';
      
      logsByAction[action] = (logsByAction[action] || 0) + 1;
      logsByModule[module] = (logsByModule[module] || 0) + 1;
    });
    
    console.log('\n📊 Audit Log Analysis:');
    console.log('   By Action:');
    Object.entries(logsByAction).forEach(([action, count]) => {
      console.log(`      ${action}: ${count} logs`);
    });
    
    console.log('   By Module:');
    Object.entries(logsByModule).forEach(([module, count]) => {
      console.log(`      ${module}: ${count} logs`);
    });
    
    return {
      clientAuditLogs,
      totalLogs: snapshot.size,
      clientLogs: matchCount,
      logsByAction,
      logsByModule
    };
    
  } catch (error) {
    console.error('❌ Error searching audit logs:', error);
    throw error;
  }
}

/**
 * Backup audit logs to local storage
 */
async function backupAuditLogs(auditLogsData, backupPath) {
  console.log('\n📦 Backing up audit logs...');
  
  const { clientAuditLogs, logsByAction, logsByModule } = auditLogsData;
  
  if (clientAuditLogs.length === 0) {
    console.log('✅ No audit logs to backup');
    return;
  }
  
  // Create audit logs backup directory
  const auditBackupPath = path.join(backupPath, 'audit-logs');
  await fs.mkdir(auditBackupPath, { recursive: true });
  
  // Save all client audit logs
  await fs.writeFile(
    path.join(auditBackupPath, 'client-audit-logs.json'),
    JSON.stringify(clientAuditLogs, null, 2)
  );
  
  // Save analysis summary
  const auditSummary = {
    clientId: CLIENT_ID,
    timestamp: TIMESTAMP,
    totalLogsFound: clientAuditLogs.length,
    logsByAction,
    logsByModule,
    parentPathPattern: `clients/${CLIENT_ID}`,
    backupPath: auditBackupPath
  };
  
  await fs.writeFile(
    path.join(auditBackupPath, 'audit-summary.json'),
    JSON.stringify(auditSummary, null, 2)
  );
  
  // Create detailed logs by action
  for (const [action, count] of Object.entries(logsByAction)) {
    const actionLogs = clientAuditLogs.filter(log => (log.data.action || 'unknown') === action);
    await fs.writeFile(
      path.join(auditBackupPath, `logs-${action.replace(/[^a-zA-Z0-9]/g, '_')}.json`),
      JSON.stringify(actionLogs, null, 2)
    );
  }
  
  console.log(`✅ Backed up ${clientAuditLogs.length} audit logs`);
  console.log(`📁 Backup location: ${auditBackupPath}`);
  console.log(`📋 Created ${Object.keys(logsByAction).length} action-specific files`);
  
  return auditSummary;
}

/**
 * Delete client audit logs
 */
async function deleteClientAuditLogs(db, clientAuditLogs) {
  console.log('\n🗑️ Deleting client audit logs...');
  
  if (clientAuditLogs.length === 0) {
    console.log('✅ No audit logs to delete');
    return 0;
  }
  
  let deletedCount = 0;
  const batchSize = 500; // Firestore batch limit
  
  console.log(`📄 Deleting ${clientAuditLogs.length} audit logs in batches...`);
  
  // Delete in batches
  for (let i = 0; i < clientAuditLogs.length; i += batchSize) {
    const batch = db.batch();
    const batchLogs = clientAuditLogs.slice(i, i + batchSize);
    
    batchLogs.forEach(logEntry => {
      const docRef = db.collection('auditLogs').doc(logEntry.id);
      batch.delete(docRef);
    });
    
    await batch.commit();
    deletedCount += batchLogs.length;
    
    console.log(`   Deleted ${deletedCount}/${clientAuditLogs.length} audit logs`);
  }
  
  console.log(`✅ Successfully deleted ${deletedCount} audit logs`);
  return deletedCount;
}

/**
 * Verify audit log cleanup
 */
async function verifyAuditCleanup(db, clientId) {
  console.log('\n🔍 Verifying audit log cleanup...');
  
  const auditLogsRef = db.collection('auditLogs');
  const parentPathPattern = `clients/${clientId}`;
  
  // Check for any remaining client audit logs
  const snapshot = await auditLogsRef.get();
  let remainingLogs = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const parentPath = data.parentPath || '';
    
    if (parentPath.startsWith(parentPathPattern)) {
      remainingLogs++;
      console.log(`⚠️ Remaining log: ${doc.id} - ${parentPath}`);
    }
  });
  
  if (remainingLogs === 0) {
    console.log(`✅ Verification passed: No ${clientId} audit logs remain`);
    return true;
  } else {
    console.log(`❌ Verification failed: ${remainingLogs} audit logs still exist`);
    return false;
  }
}

/**
 * Complete audit logs cleanup process
 */
async function performAuditLogsCleanup() {
  console.log('🚀 Starting Audit Logs Cleanup for Client Deletion...\n');
  
  const results = {
    timestamp: TIMESTAMP,
    clientId: CLIENT_ID,
    search: {
      totalAuditLogs: 0,
      clientAuditLogs: 0,
      logsByAction: {},
      logsByModule: {}
    },
    backup: {
      backupPath: null,
      filesCreated: 0
    },
    deletion: {
      logsDeleted: 0,
      success: false
    },
    verification: {
      passed: false,
      remainingLogs: 0
    }
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create backup directory
    const backupPath = path.join(BACKUP_DIR, `${CLIENT_ID}-AUDIT-CLEANUP-${TIMESTAMP}`);
    await fs.mkdir(backupPath, { recursive: true });
    results.backup.backupPath = backupPath;
    
    console.log(`📁 Backup directory: ${backupPath}\n`);
    
    // Step 1: Find client audit logs
    console.log('=== STEP 1: SEARCH AUDIT LOGS ===');
    const auditLogsData = await findClientAuditLogs(db, CLIENT_ID);
    
    results.search = {
      totalAuditLogs: auditLogsData.totalLogs,
      clientAuditLogs: auditLogsData.clientLogs,
      logsByAction: auditLogsData.logsByAction,
      logsByModule: auditLogsData.logsByModule
    };
    
    // Step 2: Backup audit logs
    console.log('\n=== STEP 2: BACKUP AUDIT LOGS ===');
    if (auditLogsData.clientAuditLogs.length > 0) {
      const backupSummary = await backupAuditLogs(auditLogsData, backupPath);
      results.backup.filesCreated = Object.keys(auditLogsData.logsByAction).length + 2; // action files + main + summary
    }
    
    // Step 3: Delete audit logs
    console.log('\n=== STEP 3: DELETE AUDIT LOGS ===');
    const deletedCount = await deleteClientAuditLogs(db, auditLogsData.clientAuditLogs);
    results.deletion.logsDeleted = deletedCount;
    results.deletion.success = deletedCount === auditLogsData.clientAuditLogs.length;
    
    // Step 4: Verify cleanup
    console.log('\n=== STEP 4: VERIFY CLEANUP ===');
    const verificationPassed = await verifyAuditCleanup(db, CLIENT_ID);
    results.verification.passed = verificationPassed;
    
    // Save results
    await fs.writeFile(
      path.join(backupPath, 'audit-cleanup-results.json'),
      JSON.stringify(results, null, 2)
    );
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 AUDIT LOGS CLEANUP SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log('');
    console.log('🔍 SEARCH RESULTS:');
    console.log(`   Total audit logs in database: ${results.search.totalAuditLogs}`);
    console.log(`   Client audit logs found: ${results.search.clientAuditLogs}`);
    console.log('');
    console.log('📦 BACKUP RESULTS:');
    console.log(`   Files created: ${results.backup.filesCreated}`);
    console.log(`   Backup location: ${results.backup.backupPath}`);
    console.log('');
    console.log('🗑️ DELETION RESULTS:');
    console.log(`   Logs deleted: ${results.deletion.logsDeleted}`);
    console.log(`   Deletion successful: ${results.deletion.success}`);
    console.log('');
    console.log('✅ VERIFICATION:');
    console.log(`   Cleanup verified: ${results.verification.passed}`);
    
    const overallSuccess = results.deletion.success && results.verification.passed;
    
    if (overallSuccess) {
      console.log('\n✅ AUDIT LOGS CLEANUP SUCCESSFUL!');
      console.log('🧹 All client audit logs backed up and removed');
    } else {
      console.log('\n⚠️ AUDIT LOGS CLEANUP COMPLETED WITH ISSUES');
      console.log('🔧 Manual verification recommended');
    }
    
    console.log('\n💡 FUTURE ENHANCEMENT:');
    console.log('   Recommend adding "clientId" field to audit logs');
    console.log('   This would enable more efficient queries by client');
    console.log('   Current method requires full collection scan');
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Audit logs cleanup failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performAuditLogsCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });