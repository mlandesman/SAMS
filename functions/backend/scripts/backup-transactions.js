#!/usr/bin/env node

/**
 * TRANS-004: Backup All Transactions Before Cents Conversion Fix
 * 
 * Creates a complete backup of all transactions with metadata
 * to enable rollback if conversion fails
 */

import { getDb } from '../firebase.js';
import { writeFileSync } from 'fs';
import { writeAuditLog } from '../utils/auditLogger.js';

/**
 * Create comprehensive backup of all transactions
 */
async function backupTransactions(clientId = 'MTC') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `./backups/transactions_backup_${clientId}_${timestamp}.json`;
  
  console.log('💾 Starting Transaction Backup...');
  console.log(`Client: ${clientId}`);
  console.log(`Backup File: ${backupFile}`);
  console.log('=' .repeat(50));
  
  try {
    const db = await getDb();
    
    // Get all transactions
    console.log('📥 Fetching all transactions...');
    const snapshot = await db.collection(`clients/${clientId}/transactions`).get();
    
    console.log(`📊 Found ${snapshot.size} transactions to backup`);
    
    // Prepare backup data structure
    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        clientId: clientId,
        totalTransactions: snapshot.size,
        purpose: 'TRANS-004 Cents Conversion Fix',
        backupVersion: '1.0'
      },
      transactions: [],
      statistics: {
        amountRanges: {
          zero: 0,
          under100: 0,
          under1000: 0,
          under10000: 0,
          over10000: 0,
          over100000: 0,
          over1000000: 0
        },
        categories: {},
        totalAmount: 0
      }
    };
    
    // Process each transaction
    console.log('📋 Processing transactions...');
    let processedCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = Math.abs(data.amount || 0);
      const category = data.categoryName || data.category || 'Unknown';
      
      // Store complete transaction data
      backupData.transactions.push({
        id: doc.id,
        data: data,
        originalAmount: data.amount,
        backupTimestamp: new Date().toISOString()
      });
      
      // Update statistics
      backupData.statistics.totalAmount += (data.amount || 0);
      
      // Amount ranges
      if (amount === 0) {
        backupData.statistics.amountRanges.zero++;
      } else if (amount < 100) {
        backupData.statistics.amountRanges.under100++;
      } else if (amount < 1000) {
        backupData.statistics.amountRanges.under1000++;
      } else if (amount < 10000) {
        backupData.statistics.amountRanges.under10000++;
      } else if (amount < 100000) {
        backupData.statistics.amountRanges.over10000++;
      } else if (amount < 1000000) {
        backupData.statistics.amountRanges.over100000++;
      } else {
        backupData.statistics.amountRanges.over1000000++;
      }
      
      // Category tracking
      if (!backupData.statistics.categories[category]) {
        backupData.statistics.categories[category] = {
          count: 0,
          totalAmount: 0
        };
      }
      backupData.statistics.categories[category].count++;
      backupData.statistics.categories[category].totalAmount += (data.amount || 0);
      
      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`  Processed ${processedCount}/${snapshot.size} transactions...`);
      }
    });
    
    // Create backups directory if it doesn't exist
    const fs = await import('fs');
    if (!fs.existsSync('./backups')) {
      fs.mkdirSync('./backups', { recursive: true });
    }
    
    // Write backup file
    console.log('💾 Writing backup file...');
    writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    // Create backup summary
    const summaryFile = backupFile.replace('.json', '_summary.txt');
    const summary = generateBackupSummary(backupData);
    writeFileSync(summaryFile, summary);
    
    // Log to audit
    await writeAuditLog({
      module: 'transactionBackup',
      action: 'create_backup',
      parentPath: `clients/${clientId}`,
      docId: 'backup',
      friendlyName: 'Transaction Backup for TRANS-004',
      notes: `Backed up ${snapshot.size} transactions to ${backupFile}`
    });
    
    console.log('\n✅ BACKUP COMPLETED SUCCESSFULLY');
    console.log('=' .repeat(50));
    console.log(`📁 Backup File: ${backupFile}`);
    console.log(`📋 Summary File: ${summaryFile}`);
    console.log(`📊 Transactions Backed Up: ${snapshot.size}`);
    console.log(`💰 Total Amount: ${backupData.statistics.totalAmount.toLocaleString()}`);
    console.log(`🚨 Suspicious Transactions: ${backupData.statistics.amountRanges.under10000}`);
    
    return {
      backupFile,
      summaryFile,
      transactionCount: snapshot.size,
      metadata: backupData.metadata
    };
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Generate human-readable backup summary
 */
function generateBackupSummary(backupData) {
  const { metadata, statistics } = backupData;
  
  return `
TRANSACTION BACKUP SUMMARY
==========================

Backup Information:
- Date: ${metadata.backupDate}
- Client: ${metadata.clientId}
- Purpose: ${metadata.purpose}
- Total Transactions: ${metadata.totalTransactions}

Amount Distribution:
- Zero: ${statistics.amountRanges.zero}
- Under 100: ${statistics.amountRanges.under100}
- Under 1,000: ${statistics.amountRanges.under1000}
- Under 10,000: ${statistics.amountRanges.under10000} (SUSPICIOUS)
- 10,000-100,000: ${statistics.amountRanges.over10000}
- 100,000-1,000,000: ${statistics.amountRanges.over100000}
- Over 1,000,000: ${statistics.amountRanges.over1000000}

Categories (Top 10):
${Object.entries(statistics.categories)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 10)
  .map(([cat, stats]) => `- ${cat}: ${stats.count} transactions`)
  .join('\n')}

Financial Summary:
- Total Amount: ${statistics.totalAmount.toLocaleString()}
- Suspicious Transactions: ${statistics.amountRanges.under10000}

This backup contains complete transaction data including:
- All original field values
- Transaction metadata
- Backup timestamps
- Statistical analysis

Use this backup to restore data if the conversion process fails.
`;
}

// Execute backup if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const clientId = process.argv[2] || 'MTC';
  backupTransactions(clientId).catch(console.error);
}

export { backupTransactions };