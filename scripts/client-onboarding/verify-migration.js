#!/usr/bin/env node

/**
 * Verify Migration
 * 
 * Verifies that the migration completed successfully by:
 * - Comparing document counts
 * - Checking financial totals
 * - Validating data integrity
 * - Generating verification report
 * 
 * Usage:
 *   node verify-migration.js --client AVII
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    params[key] = value;
  }
  
  return params;
}

// Get latest migration directory for client
async function getLatestMigrationDir(clientId) {
  const latestLink = path.join(__dirname, 'migrations', `${clientId}-latest`);
  
  try {
    // Try to follow symlink
    const stats = await fs.lstat(latestLink);
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(latestLink);
      return target;
    }
  } catch (err) {
    // Symlink doesn't exist, find latest directory
  }
  
  // Find latest migration directory for this client
  const migrationsDir = path.join(__dirname, 'migrations');
  const entries = await fs.readdir(migrationsDir);
  
  const clientDirs = entries
    .filter(entry => entry.startsWith(`${clientId}-`) && !entry.endsWith('-latest'))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    throw new Error(`No migration found for client ${clientId}. Run init-migration.js first.`);
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

// Update metadata
async function updateMetadata(migrationDir, updates) {
  const metadataPath = path.join(migrationDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  // Deep merge updates
  if (updates.phases) {
    metadata.phases = { ...metadata.phases, ...updates.phases };
  }
  Object.assign(metadata, updates);
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

// Write log entry
async function writeLog(migrationDir, message, level = 'INFO') {
  const logPath = path.join(migrationDir, 'migration.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    await fs.writeFile(logPath, logEntry);
  }
}

// Analyze Production data (same as analyze-client.js but for prod)
async function analyzeProdData(db, clientId) {
  const analysis = {
    environment: 'prod',
    analyzed: new Date().toISOString(),
    clientExists: false,
    documentCounts: {},
    financialSummary: {},
    dataIntegrity: {},
    users: []
  };
  
  // Check if client exists
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    return analysis;
  }
  
  analysis.clientExists = true;
  
  // Count documents in each subcollection
  const subcollections = [
    'units', 'vendors', 'categories', 
    'paymentMethods', 'users', 'yearEndBalances',
    'auditLogs', 'importMetadata', 'transactions', 'config'
  ];
  
  for (const collection of subcollections) {
    const snapshot = await clientRef.collection(collection).get();
    analysis.documentCounts[collection] = snapshot.size;
  }
  
  // Analyze accounts from the client document
  const clientData = clientDoc.data();
  const accounts = clientData.accounts || [];
  let totalBalance = 0;
  const accountBalances = {};
  
  for (const account of accounts) {
    accountBalances[account.id] = {
      name: account.name,
      balance: account.balance || 0
    };
    totalBalance += account.balance || 0;
  }
  
  // Get transactions
  const transSnapshot = await clientRef.collection('transactions').get();
  let transactionCount = transSnapshot.size;
  let transactionTotal = 0;
  
  transSnapshot.forEach(transDoc => {
    const trans = transDoc.data();
    transactionTotal += Math.abs(trans.amount || 0);
  });
  
  analysis.documentCounts.accounts = accounts.length;
  analysis.financialSummary = {
    accountCount: accounts.length,
    accountBalances,
    totalBalance,
    transactionCount,
    transactionTotal
  };
  
  // Analyze units and dues
  const unitsSnapshot = await clientRef.collection('units').get();
  let duesCount = 0;
  let duesWithReferences = 0;
  
  for (const unitDoc of unitsSnapshot.docs) {
    const duesSnapshot = await unitDoc.ref.collection('dues').get();
    duesCount += duesSnapshot.size;
    
    duesSnapshot.forEach(duesDoc => {
      const dues = duesDoc.data();
      if (dues.payments && Array.isArray(dues.payments)) {
        dues.payments.forEach(payment => {
          if (payment.reference) {
            duesWithReferences++;
          }
        });
      }
    });
  }
  
  analysis.documentCounts['units/dues'] = duesCount;
  analysis.dataIntegrity = {
    duesWithReferences,
    totalDuesPayments: duesWithReferences
  };
  
  // Get user information from root-level users collection
  const usersSnapshot = await db.collection('users').get();
  usersSnapshot.forEach(userDoc => {
    const userData = userDoc.data();
    if (userData.clients && userData.clients.includes(clientId)) {
      analysis.users.push({
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        roles: userData.roles || [],
        unitAccess: userData.unitAccess || []
      });
    }
  });
  
  // Configuration
  analysis.configuration = {
    fiscalYearStartMonth: clientData.configuration?.fiscalYearStartMonth || 1,
    currency: clientData.configuration?.currency || 'USD',
    timezone: clientData.configuration?.timezone || 'UTC'
  };
  
  // Calculate total documents
  analysis.totalDocuments = Object.values(analysis.documentCounts)
    .reduce((sum, count) => sum + count, 0) + 1; // +1 for client doc
  
  return analysis;
}

// Compare analyses
function compareAnalyses(source, target) {
  const report = {
    timestamp: new Date().toISOString(),
    source: source.environment,
    target: target.environment,
    success: true,
    issues: [],
    documentComparison: {},
    financialComparison: {}
  };
  
  // Compare document counts
  const allCollections = new Set([
    ...Object.keys(source.documentCounts),
    ...Object.keys(target.documentCounts)
  ]);
  
  for (const collection of allCollections) {
    const sourceCount = source.documentCounts[collection] || 0;
    const targetCount = target.documentCounts[collection] || 0;
    
    report.documentComparison[collection] = {
      source: sourceCount,
      target: targetCount,
      match: sourceCount === targetCount
    };
    
    if (sourceCount !== targetCount) {
      report.issues.push(
        `Document count mismatch in ${collection}: source=${sourceCount}, target=${targetCount}`
      );
      report.success = false;
    }
  }
  
  // Compare total documents
  if (source.totalDocuments !== target.totalDocuments) {
    report.issues.push(
      `Total document count mismatch: source=${source.totalDocuments}, target=${target.totalDocuments}`
    );
    report.success = false;
  }
  
  // Compare financial data
  report.financialComparison = {
    accounts: {
      source: source.financialSummary.accountCount,
      target: target.financialSummary.accountCount,
      match: source.financialSummary.accountCount === target.financialSummary.accountCount
    },
    totalBalance: {
      source: source.financialSummary.totalBalance,
      target: target.financialSummary.totalBalance,
      match: source.financialSummary.totalBalance === target.financialSummary.totalBalance
    },
    transactions: {
      source: source.financialSummary.transactionCount,
      target: target.financialSummary.transactionCount,
      match: source.financialSummary.transactionCount === target.financialSummary.transactionCount
    }
  };
  
  if (!report.financialComparison.accounts.match) {
    report.issues.push(
      `Account count mismatch: source=${source.financialSummary.accountCount}, target=${target.financialSummary.accountCount}`
    );
    report.success = false;
  }
  
  if (!report.financialComparison.totalBalance.match) {
    report.issues.push(
      `Balance mismatch: source=$${(source.financialSummary.totalBalance / 100).toFixed(2)}, target=$${(target.financialSummary.totalBalance / 100).toFixed(2)}`
    );
    report.success = false;
  }
  
  // Compare configuration
  if (source.configuration.fiscalYearStartMonth !== target.configuration.fiscalYearStartMonth) {
    report.issues.push(
      `Fiscal year config mismatch: source=${source.configuration.fiscalYearStartMonth}, target=${target.configuration.fiscalYearStartMonth}`
    );
    report.success = false;
  }
  
  report.userCount = {
    source: source.users.length,
    target: target.users.length
  };
  
  return report;
}

// Generate report text
function generateReportText(report, clientId) {
  let text = '='.repeat(60) + '\n';
  text += 'MIGRATION VERIFICATION REPORT\n';
  text += '='.repeat(60) + '\n\n';
  
  text += `Client: ${clientId}\n`;
  text += `Timestamp: ${report.timestamp}\n`;
  text += `Source: ${report.source}\n`;
  text += `Target: ${report.target}\n`;
  text += `Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}\n\n`;
  
  text += 'DOCUMENT COMPARISON\n';
  text += '-'.repeat(40) + '\n';
  
  for (const [collection, comparison] of Object.entries(report.documentComparison)) {
    const status = comparison.match ? '✓' : '✗';
    text += `${status} ${collection}: ${comparison.source} → ${comparison.target}\n`;
  }
  
  text += '\nFINANCIAL COMPARISON\n';
  text += '-'.repeat(40) + '\n';
  
  const finStatus = (comp) => comp.match ? '✓' : '✗';
  text += `${finStatus(report.financialComparison.accounts)} Accounts: ${report.financialComparison.accounts.source} → ${report.financialComparison.accounts.target}\n`;
  text += `${finStatus(report.financialComparison.totalBalance)} Balance: $${(report.financialComparison.totalBalance.source / 100).toFixed(2)} → $${(report.financialComparison.totalBalance.target / 100).toFixed(2)}\n`;
  text += `${finStatus(report.financialComparison.transactions)} Transactions: ${report.financialComparison.transactions.source} → ${report.financialComparison.transactions.target}\n`;
  
  text += '\nUSER ACCESS\n';
  text += '-'.repeat(40) + '\n';
  text += `Users with access: ${report.userCount.source} → ${report.userCount.target}\n`;
  
  if (report.issues.length > 0) {
    text += '\nISSUES FOUND\n';
    text += '-'.repeat(40) + '\n';
    for (const issue of report.issues) {
      text += `• ${issue}\n`;
    }
  }
  
  text += '\n' + '='.repeat(60) + '\n';
  
  return text;
}

// Main verification function
async function main() {
  console.log('✅ Migration Verification Tool');
  console.log('==============================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node verify-migration.js --client <CLIENT_ID>');
    console.error('Example: node verify-migration.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Log start
    await writeLog(migrationDir, 'Verification phase started', 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        verify: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Load source analysis from checksums
    const checksumsPath = path.join(migrationDir, 'checksums.json');
    const checksums = JSON.parse(await fs.readFile(checksumsPath, 'utf-8'));
    const sourceAnalysis = checksums.source;
    
    console.log('\n📊 Analyzing Production data...');
    
    // Initialize Firebase for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { db } = await initializeFirebase();
    
    // Analyze Production data
    const targetAnalysis = await analyzeProdData(db, clientId);
    
    // Save target analysis to checksums
    checksums.target = targetAnalysis;
    await fs.writeFile(checksumsPath, JSON.stringify(checksums, null, 2));
    
    // Compare analyses
    console.log('\n🔍 Comparing source and target...');
    const report = compareAnalyses(sourceAnalysis, targetAnalysis);
    
    // Generate report text
    const reportText = generateReportText(report, clientId);
    
    // Save report
    const reportPath = path.join(migrationDir, 'verification-report.txt');
    await fs.writeFile(reportPath, reportText);
    console.log(`\n📄 Report saved to ${path.basename(reportPath)}`);
    
    // Display report
    console.log('\n' + reportText);
    
    // Log results
    const status = report.success ? 'SUCCESS' : 'FAILED';
    await writeLog(migrationDir, `Verification ${status}: ${report.issues.length} issues found`, report.success ? 'INFO' : 'ERROR');
    
    // Update metadata
    await updateMetadata(migrationDir, {
      phases: {
        verify: {
          status: report.success ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          success: report.success,
          issueCount: report.issues.length
        }
      },
      status: report.success ? 'completed' : 'failed',
      completed: report.success ? new Date().toISOString() : null
    });
    
    if (report.success) {
      console.log('🎉 Migration verified successfully!');
      console.log(`\n✅ Client ${clientId} has been successfully migrated to Production!`);
    } else {
      console.log(`\n⚠️  Migration verification found ${report.issues.length} issues.`);
      console.log('   Please review the report and investigate discrepancies.');
    }
    
    process.exit(report.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Verification failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          verify: {
            status: 'failed',
            timestamp: new Date().toISOString(),
            error: error.message
          }
        }
      });
    } catch (logError) {
      // Ignore logging errors
    }
    
    process.exit(1);
  }
}

// Run verification
main();