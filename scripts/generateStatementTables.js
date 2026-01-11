#!/usr/bin/env node
/**
 * Generate Statement Tables for Review
 * 
 * Creates markdown tables showing statement data for all units in each client.
 * Format matches the user's expected statement format with running balance
 * and notes column showing credit flow.
 * 
 * Output: One markdown file per client in test-results/
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
const serviceAccountPath = join(__dirname, '../backend/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// Import statement data service
const { getStatementData } = await import('../functions/backend/services/statementDataService.js');

// Import API client for statement service
import { createApiClient } from '../backend/testing/apiClient.js';

/**
 * Format currency as peso string
 */
function formatPesos(amount) {
  if (amount === null || amount === undefined) return '';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format date as readable string in America/Cancun timezone
 */
function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    timeZone: 'America/Cancun'
  });
}

/**
 * Generate credit flow note for a transaction
 */
function getCreditFlowNote(item, prevBalance) {
  const notes = [];
  
  // Opening balance
  if (item.description === 'Opening Balance' || item.description === 'Saldo Inicial') {
    if (item.balance < 0) {
      notes.push('Credit Available');
    } else if (item.balance > 0) {
      notes.push('Balance Carried Forward');
    }
    return notes.join('. ');
  }
  
  // Track credit consumption (when balance goes from negative to positive)
  if (prevBalance < 0 && item.balance > 0 && item.charge > 0) {
    const creditUsed = Math.abs(prevBalance);
    notes.push(`Used ${formatPesos(creditUsed)} from credit balance`);
  } else if (prevBalance < 0 && item.balance < 0 && item.charge > 0) {
    // Partial credit consumption
    const creditUsed = item.charge;
    notes.push(`Used ${formatPesos(creditUsed)} from credit balance`);
  }
  
  // Track credit creation (when payment creates credit)
  if (item.payment > 0 && item.balance < 0 && prevBalance >= 0) {
    const creditCreated = Math.abs(item.balance);
    notes.push(`Added ${formatPesos(creditCreated)} to credit balance`);
  } else if (item.payment > 0 && item.balance < 0 && prevBalance < 0) {
    const creditAdded = Math.abs(item.balance) - Math.abs(prevBalance);
    if (creditAdded > 0) {
      notes.push(`Added ${formatPesos(creditAdded)} to credit balance`);
    }
  }
  
  return notes.join('. ');
}

/**
 * Generate markdown table for a unit
 */
function generateUnitTable(clientId, unitId, data) {
  const lines = [];
  
  lines.push(`## ${clientId} Unit ${unitId}`);
  lines.push('');
  lines.push('| Date | Description | Charge | Payment | Balance | Notes |');
  lines.push('| ---- | ----------- | -----: | ------: | ------: | ----- |');
  
  // Add opening balance row
  const openingBalance = data.summary?.openingBalance || 0;
  lines.push(`| | Opening Balance | | | ${formatPesos(openingBalance)} | ${openingBalance < 0 ? 'Credit Available' : openingBalance > 0 ? 'Balance Carried Forward' : ''} |`);
  
  // Track previous balance for credit flow notes
  let prevBalance = openingBalance;
  
  // Add all line items
  for (const item of data.lineItems || []) {
    const date = formatDate(item.date);
    const desc = item.description || '';
    const charge = item.charge > 0 ? formatPesos(item.charge) : '';
    const payment = item.payment > 0 ? formatPesos(item.payment) : '';
    const balance = formatPesos(item.balance);
    const notes = getCreditFlowNote(item, prevBalance);
    
    lines.push(`| ${date} | ${desc} | ${charge} | ${payment} | ${balance} | ${notes} |`);
    
    prevBalance = item.balance;
  }
  
  lines.push('');
  
  // Add summary
  const closingBalance = data.summary?.closingBalance || 0;
  if (closingBalance > 0) {
    lines.push(`### Balance Due: ${formatPesos(closingBalance)}`);
  } else if (closingBalance < 0) {
    lines.push(`### Credit Balance: ${formatPesos(Math.abs(closingBalance))}`);
  } else {
    lines.push(`### NO PAYMENT NEEDED`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get all units for a client
 */
async function getClientUnits(clientId) {
  const unitsSnapshot = await db.collection('clients').doc(clientId)
    .collection('units').get();
  
  const units = [];
  for (const doc of unitsSnapshot.docs) {
    // Skip creditBalances documents (current and archived)
    if (doc.id === 'creditBalances' || doc.id.startsWith('creditBalances_')) continue;
    units.push(doc.id);
  }
  
  return units.sort((a, b) => {
    // Sort numerically if possible
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(70));
  console.log('📊 GENERATING STATEMENT TABLES FOR REVIEW');
  console.log('='.repeat(70));
  
  // Create API client for statement service
  const api = await createApiClient();
  
  // Define clients and their fiscal years to process
  // MTC uses calendar year (Jan-Dec), fiscal 2025 is closed, need to run both 2025 and 2026
  // AVII uses July-June fiscal year
  const clientConfigs = [
    { clientId: 'AVII', fiscalYear: 2026, label: 'Fiscal 2026 (Jul 2025 - Jun 2026)' },
    { clientId: 'MTC', fiscalYear: 2025, label: 'Fiscal 2025 (Jan-Dec 2025)' },
    { clientId: 'MTC', fiscalYear: 2026, label: 'Fiscal 2026 (Jan-Dec 2026)' }
  ];
  
  for (const config of clientConfigs) {
    const { clientId, fiscalYear, label } = config;
    console.log(`\n📁 Processing ${clientId} ${label}...`);
    
    const units = await getClientUnits(clientId);
    console.log(`   Found ${units.length} units`);
    
    const outputLines = [];
    outputLines.push(`# ${clientId} Statement Review - ${label}`);
    outputLines.push('');
    outputLines.push(`Generated: ${new Date().toISOString()}`);
    outputLines.push('');
    outputLines.push('This file shows the running balance for each unit.');
    outputLines.push('Credit is consumed IMPLICITLY - when charges push a negative balance positive.');
    outputLines.push('No separate "Credit Applied" lines are needed.');
    outputLines.push('');
    outputLines.push('---');
    outputLines.push('');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const unitId of units) {
      try {
        console.log(`   Processing unit ${unitId}...`);
        
        // Get statement data for the specified fiscal year
        const data = await getStatementData(api, clientId, unitId, fiscalYear);
        
        if (!data || !data.lineItems) {
          console.log(`   ⚠️  No data for unit ${unitId}`);
          outputLines.push(`## ${clientId} Unit ${unitId}`);
          outputLines.push('');
          outputLines.push('*No statement data available*');
          outputLines.push('');
          outputLines.push('---');
          outputLines.push('');
          continue;
        }
        
        const tableMarkdown = generateUnitTable(clientId, unitId, data);
        outputLines.push(tableMarkdown);
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ Error for unit ${unitId}: ${error.message}`);
        outputLines.push(`## ${clientId} Unit ${unitId}`);
        outputLines.push('');
        outputLines.push(`*Error: ${error.message}*`);
        outputLines.push('');
        outputLines.push('---');
        outputLines.push('');
        errorCount++;
      }
    }
    
    // Write output file
    const outputPath = join(__dirname, `../test-results/${clientId}_${fiscalYear}_Statement_Review.md`);
    fs.writeFileSync(outputPath, outputLines.join('\n'));
    
    console.log(`   ✅ Written to ${outputPath}`);
    console.log(`   📊 ${successCount} units processed, ${errorCount} errors`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ DONE - Review files in test-results/');
  console.log('='.repeat(70));
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
