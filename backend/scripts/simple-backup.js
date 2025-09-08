#!/usr/bin/env node

/**
 * Simple transaction backup for TRANS-004
 */

import { getDb } from '../firebase.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

async function simpleBackup() {
  console.log('💾 Creating Transaction Backup...');
  
  try {
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
    console.log(`📊 Found ${snapshot.size} transactions`);
    
    const backup = {
      backupDate: new Date().toISOString(),
      clientId: 'MTC',
      totalCount: snapshot.size,
      transactions: []
    };
    
    snapshot.forEach(doc => {
      backup.transactions.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Create directory
    if (!existsSync('./backups')) {
      mkdirSync('./backups', { recursive: true });
    }
    
    const filename = `./backups/mtc_transactions_backup_${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(filename, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup saved: ${filename}`);
    console.log(`📊 Backed up ${backup.totalCount} transactions`);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Backup error:', error);
  }
}

simpleBackup();