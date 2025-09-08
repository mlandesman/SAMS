#!/usr/bin/env node

/**
 * Create default accounts for MTC
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { writeAuditLog } from './utils/audit-logger.js';

async function createAccounts() {
  const { db } = await initializeFirebase('dev');
  const clientId = 'MTC';
  
  console.log('🏦 Creating default accounts...\n');
  
  const accounts = [
    {
      id: 'bank-001',
      name: 'MTC Bank Account',
      type: 'bank',
      currency: 'USD',
      balance: 0,
      isActive: true
    },
    {
      id: 'cash-001',
      name: 'Petty Cash',
      type: 'cash', 
      currency: 'USD',
      balance: 0,
      isActive: true
    }
  ];
  
  for (const account of accounts) {
    const docRef = db.collection(`clients/${clientId}/accounts`).doc(account.id);
    const existing = await docRef.get();
    
    if (existing.exists) {
      console.log(`⚠️ Account ${account.id} already exists`);
      continue;
    }
    
    const accountDoc = {
      ...account,
      updated: getCurrentTimestamp(),
      balanceUpdated: getCurrentTimestamp()
    };
    
    await docRef.set(accountDoc);
    
    await writeAuditLog(db, {
      module: 'scriptImporter',
      action: 'CREATE',
      collection: `clients/${clientId}/accounts`,
      documentId: account.id,
      userId: 'import-script',
      changes: { created: accountDoc }
    });
    
    console.log(`✅ Created account: ${account.name}`);
  }
  
  console.log('\n✅ Accounts setup complete!');
}

createAccounts().catch(console.error);