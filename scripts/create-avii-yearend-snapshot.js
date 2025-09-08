#!/usr/bin/env node

/**
 * Create AVII Year-End Snapshot for FY 2025
 * Creates a year-end snapshot for June 30, 2025 (AVII's fiscal year end)
 * This is needed because AVII is currently in FY 2026 (started July 1, 2025)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../backend/utils/fiscalYearUtils.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function createAVIISnapshot() {
  try {
    const clientId = 'AVII';
    const year = '2025';  // FY 2025 ended June 30, 2025
    
    console.log(`📊 Creating year-end snapshot for ${clientId} FY ${year}...\n`);
    console.log(`ℹ️  AVII is currently in FY 2026 (started July 1, 2025)`);
    console.log(`ℹ️  Creating FY 2025 snapshot (ended June 30, 2025) for balance calculations\n`);
    
    // Get client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return;
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const accounts = clientData.accounts || [];
    
    if (accounts.length === 0) {
      console.error(`❌ No accounts found for ${clientId}`);
      return;
    }
    
    // Calculate fiscal year end date for FY 2025
    const { endDate } = getFiscalYearBounds(parseInt(year), fiscalYearStartMonth);
    const snapshotDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Fiscal Year Configuration:`);
    console.log(`   Client: ${clientId}`);
    console.log(`   FY Start Month: ${fiscalYearStartMonth} (July)`);
    console.log(`   FY ${year} End Date: ${snapshotDateStr}`);
    console.log(`   Current FY: 2026 (July 1, 2025 - June 30, 2026)`);
    console.log(`   Accounts: ${accounts.length}`);
    
    // Create snapshot with zero balances (since AVII started collecting data July 1, 2025)
    const snapshotAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: 0, // Zero balance as of June 30, 2025 (before data collection started)
      currency: account.currency || 'USD'
    }));
    
    const snapshotData = {
      accounts: snapshotAccounts,
      snapshotDate: snapshotDateStr,
      fiscalYear: parseInt(year),
      createdAt: new Date(),
      createdBy: 'create-avii-yearend-snapshot-script',
      clientId,
      metadata: {
        fiscalYearStartMonth,
        note: 'Initial FY 2025 year-end snapshot. AVII started collecting data July 1, 2025 (FY 2026).'
      }
    };
    
    // Save the snapshot
    const snapshotRef = db.collection('clients').doc(clientId).collection('yearEndBalances').doc(year);
    
    // Check if already exists
    const existing = await snapshotRef.get();
    if (existing.exists) {
      console.log(`⚠️  Snapshot for FY ${year} already exists. Updating...`);
      await snapshotRef.update({
        ...snapshotData,
        updatedAt: new Date(),
        updatedBy: 'create-avii-yearend-snapshot-script'
      });
      console.log(`✅ Updated year-end snapshot for FY ${year}`);
    } else {
      await snapshotRef.set(snapshotData);
      console.log(`✅ Created year-end snapshot for FY ${year}`);
    }
    
    console.log('\n📸 Snapshot Details:');
    console.log(`   Fiscal Year: ${year}`);
    console.log(`   End Date: ${snapshotDateStr}`);
    console.log(`   Accounts:`);
    snapshotAccounts.forEach((acc, i) => {
      console.log(`     ${i + 1}. ${acc.name} (${acc.id}): $${(acc.balance / 100).toFixed(2)}`);
    });
    
    console.log('\n✨ AVII year-end snapshot created successfully!');
    console.log(`💡 Balance recalculation will now:`);
    console.log(`   - Start from zero balance as of June 30, 2025`);
    console.log(`   - Include all transactions from July 1, 2025 onward`);
    console.log(`   - Calculate current FY 2026 balances correctly`);
    
  } catch (error) {
    console.error('❌ Error creating snapshot:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
createAVIISnapshot();