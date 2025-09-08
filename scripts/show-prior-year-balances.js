#!/usr/bin/env node

/**
 * Show Prior Year-End Balances for All Clients
 * Displays the account balances from each client's most recent year-end snapshot
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

/**
 * Determine which year's snapshot to use based on current date
 */
function determineSnapshotYear(currentDate, fiscalYearStartMonth) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let snapshotYear;
  
  if (fiscalYearStartMonth === 1) {
    // Calendar year - use previous year
    snapshotYear = currentYear - 1;
  } else {
    // Fiscal year
    if (currentMonth >= fiscalYearStartMonth) {
      // We're in the early part of fiscal year
      snapshotYear = currentYear;
    } else {
      // We're in the latter part of fiscal year
      snapshotYear = currentYear - 1;
    }
  }
  
  return snapshotYear;
}

/**
 * Format currency for display
 */
function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

async function showPriorYearBalances() {
  try {
    const today = new Date();
    console.log('📊 Prior Year-End Account Balances');
    console.log('=====================================');
    console.log(`📅 As of: ${today.toISOString().split('T')[0]}\n`);
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    const clients = [];
    
    clientsSnapshot.forEach(doc => {
      if (!doc.id.includes('_backup_')) {
        clients.push({ id: doc.id, data: doc.data() });
      }
    });
    
    // Process each client
    for (const client of clients) {
      const clientId = client.id;
      const clientData = client.data;
      
      console.log(`\n🏢 CLIENT: ${clientId}`);
      console.log('─'.repeat(50));
      
      try {
        // Get fiscal year configuration
        const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
        const fiscalYearType = fiscalYearStartMonth === 1 ? 'Calendar Year' : `Fiscal Year (starts month ${fiscalYearStartMonth})`;
        
        // Determine which snapshot year to use
        const snapshotYear = determineSnapshotYear(today, fiscalYearStartMonth);
        
        // Calculate the actual year-end date
        const { endDate } = getFiscalYearBounds(snapshotYear, fiscalYearStartMonth);
        const yearEndDate = endDate.toISOString().split('T')[0];
        
        console.log(`📅 Year Type: ${fiscalYearType}`);
        console.log(`📅 Prior Year-End: ${yearEndDate} (${snapshotYear})`);
        
        // Try to get the year-end snapshot
        const snapshotRef = db.collection('clients').doc(clientId).collection('yearEndBalances').doc(snapshotYear.toString());
        const snapshot = await snapshotRef.get();
        
        if (snapshot.exists) {
          const snapshotData = snapshot.data();
          const accounts = snapshotData.accounts || [];
          
          if (accounts.length > 0) {
            console.log(`\n💰 Account Balances at Year-End ${snapshotYear}:`);
            
            let totalBalance = 0;
            const accountDetails = [];
            
            // Collect and sort accounts
            accounts.forEach(account => {
              const balance = account.balance || 0;
              totalBalance += balance;
              accountDetails.push({
                name: account.name || 'Unnamed Account',
                id: account.id || 'no-id',
                balance: balance,
                currency: account.currency || 'USD'
              });
            });
            
            // Sort by name
            accountDetails.sort((a, b) => a.name.localeCompare(b.name));
            
            // Display accounts
            accountDetails.forEach((account, index) => {
              const prefix = `   ${index + 1}.`;
              // Use account ID to determine icon (since type field is forbidden)
              const typeIcon = account.id?.includes('bank') ? '🏦' : 
                              account.id?.includes('cash') ? '💵' : '📊';
              console.log(`${prefix} ${typeIcon} ${account.name}`);
              console.log(`      ID: ${account.id}`);
              console.log(`      Balance: ${formatCurrency(account.balance)}`);
            });
            
            console.log(`   ${'─'.repeat(40)}`);
            console.log(`   📊 TOTAL: ${formatCurrency(totalBalance)}`);
            
            // Show snapshot metadata
            if (snapshotData.createdAt || snapshotData.created) {
              const createdDate = snapshotData.createdAt || snapshotData.created;
              const dateStr = createdDate.toDate ? createdDate.toDate().toISOString() : createdDate;
              console.log(`\n   📝 Snapshot created: ${dateStr.split('T')[0]}`);
            }
            if (snapshotData.createdBy) {
              console.log(`   👤 Created by: ${snapshotData.createdBy}`);
            }
            
          } else {
            console.log(`\n⚠️  Snapshot exists but contains no accounts`);
          }
        } else {
          console.log(`\n❌ No year-end snapshot found for ${snapshotYear}`);
          console.log(`   Expected snapshot at: ${yearEndDate}`);
          
          // Check if any snapshots exist at all
          const allSnapshots = await db.collection('clients').doc(clientId).collection('yearEndBalances').get();
          if (!allSnapshots.empty) {
            console.log(`   Available snapshots: ${allSnapshots.docs.map(d => d.id).join(', ')}`);
          } else {
            console.log(`   No snapshots exist for this client`);
          }
        }
        
      } catch (error) {
        console.log(`\n❌ Error processing client: ${error.message}`);
      }
    }
    
    console.log('\n=====================================');
    console.log('✅ Report complete\n');
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the report
showPriorYearBalances();