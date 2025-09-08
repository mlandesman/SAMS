#!/usr/bin/env node

/**
 * Analyze Client Data (Dynamic)
 * 
 * Dynamically discovers and analyzes ALL subcollections for a client
 * No hardcoded collection names - adapts to each client's structure
 * 
 * Usage:
 *   node analyze-client-dynamic.js --client AVII --env dev
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

// Recursively count documents in subcollections
async function countNestedDocuments(docRef) {
  let count = 0;
  const subcollections = await docRef.listCollections();
  
  for (const subcoll of subcollections) {
    const snapshot = await subcoll.get();
    count += snapshot.size;
    
    // Recursively count nested subcollections
    for (const doc of snapshot.docs) {
      count += await countNestedDocuments(doc.ref);
    }
  }
  
  return count;
}

// Analyze client data dynamically
async function analyzeClientData(db, clientId, environment) {
  const analysis = {
    environment,
    analyzed: new Date().toISOString(),
    clientExists: false,
    documentCounts: {},
    financialSummary: {},
    dataIntegrity: {},
    users: [],
    discoveredCollections: []
  };
  
  console.log(`\n📊 Analyzing client ${clientId} in ${environment} (dynamic discovery)...`);
  
  // Check if client exists
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.log('⚠️  Client does not exist in this environment');
    return analysis;
  }
  
  analysis.clientExists = true;
  console.log('✅ Client found');
  console.log('\n🔍 Discovering subcollections...');
  
  // Dynamically discover all subcollections
  const subcollections = await clientRef.listCollections();
  
  for (const subcollection of subcollections) {
    const collectionName = subcollection.id;
    const snapshot = await subcollection.get();
    analysis.documentCounts[collectionName] = snapshot.size;
    analysis.discoveredCollections.push(collectionName);
    console.log(`   ${collectionName}: ${snapshot.size} documents`);
    
    // Count nested subcollections (like dues under units)
    if (collectionName === 'units') {
      let duesCount = 0;
      for (const unitDoc of snapshot.docs) {
        const unitSubcollections = await unitDoc.ref.listCollections();
        for (const unitSubcoll of unitSubcollections) {
          const unitSubSnapshot = await unitSubcoll.get();
          duesCount += unitSubSnapshot.size;
        }
      }
      if (duesCount > 0) {
        analysis.documentCounts['units/dues'] = duesCount;
        console.log(`     └─ dues: ${duesCount} nested documents`);
      }
    }
  }
  
  // Analyze accounts from the client document (accounts is an array field)
  const clientData = clientDoc.data();
  const accounts = clientData.accounts || [];
  let totalBalance = 0;
  const accountBalances = {};
  
  // Process accounts array
  for (const account of accounts) {
    accountBalances[account.id] = {
      name: account.name,
      balance: account.balance || 0
    };
    totalBalance += account.balance || 0;
  }
  
  // Get transactions if they exist
  let transactionCount = 0;
  let transactionTotal = 0;
  
  if (analysis.documentCounts.transactions) {
    const transSnapshot = await clientRef.collection('transactions').get();
    transactionCount = transSnapshot.size;
    
    // Sum transaction amounts
    transSnapshot.forEach(transDoc => {
      const trans = transDoc.data();
      transactionTotal += Math.abs(trans.amount || 0);
    });
  }
  
  analysis.documentCounts.accounts = accounts.length;
  analysis.financialSummary = {
    accountCount: accounts.length,
    accountBalances,
    totalBalance,
    transactionCount,
    transactionTotal
  };
  
  // Analyze units and dues if they exist
  if (analysis.documentCounts.units) {
    const unitsSnapshot = await clientRef.collection('units').get();
    let duesWithReferences = 0;
    
    for (const unitDoc of unitsSnapshot.docs) {
      // Dynamically check for dues subcollection
      const unitSubcollections = await unitDoc.ref.listCollections();
      for (const subcoll of unitSubcollections) {
        if (subcoll.id === 'dues') {
          const duesSnapshot = await subcoll.get();
          
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
      }
    }
    
    analysis.dataIntegrity = {
      duesWithReferences,
      totalDuesPayments: duesWithReferences
    };
  }
  
  // Get user information if users subcollection exists
  if (analysis.documentCounts.users) {
    const usersSnapshot = await clientRef.collection('users').get();
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      analysis.users.push({
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        roles: userData.roles || [],
        unitAccess: userData.unitAccess || []
      });
    });
  }
  
  // Check fiscal year consistency
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

// Main analysis function
async function main() {
  console.log('🔍 Dynamic Client Data Analysis Tool');
  console.log('====================================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client || !params.env) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node analyze-client-dynamic.js --client <CLIENT_ID> --env <ENVIRONMENT>');
    console.error('Example: node analyze-client-dynamic.js --client AVII --env dev');
    process.exit(1);
  }
  
  const { client: clientId, env: environment } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Log start
    await writeLog(migrationDir, 'Analysis phase started (dynamic)', 'INFO');
    await writeLog(migrationDir, `Analyzing ${clientId} in ${environment} with dynamic discovery`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        analyze: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Initialize Firebase
    process.env.FIRESTORE_ENV = environment;
    const { db } = await initializeFirebase();
    
    // Analyze client data
    const analysis = await analyzeClientData(db, clientId, environment);
    
    // Save checksums
    const checksumsPath = path.join(migrationDir, 'checksums.json');
    let existingChecksums = {};
    try {
      existingChecksums = JSON.parse(await fs.readFile(checksumsPath, 'utf-8'));
    } catch (err) {
      // File might not exist yet
    }
    
    const updatedChecksums = {
      ...existingChecksums,
      source: analysis
    };
    
    await fs.writeFile(checksumsPath, JSON.stringify(updatedChecksums, null, 2));
    console.log('\n✅ Saved analysis to checksums.json');
    
    // Log results
    await writeLog(migrationDir, `Analysis complete: ${analysis.totalDocuments} total documents`, 'INFO');
    await writeLog(migrationDir, `Discovered collections: ${analysis.discoveredCollections.join(', ')}`, 'INFO');
    await writeLog(migrationDir, `Financial summary: ${analysis.financialSummary.accountCount} accounts, ${analysis.financialSummary.transactionCount} transactions`, 'INFO');
    await writeLog(migrationDir, `Users found: ${analysis.users.length}`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        analyze: {
          status: 'completed',
          timestamp: new Date().toISOString(),
          collections: analysis.discoveredCollections
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Analysis Summary');
    console.log('='.repeat(50));
    
    if (!analysis.clientExists) {
      console.log('⚠️  Client does not exist in this environment');
      console.log('   Nothing to migrate');
    } else {
      console.log(`✅ Client: ${clientId}`);
      console.log(`✅ Environment: ${environment}`);
      console.log(`✅ Total documents: ${analysis.totalDocuments}`);
      console.log('\n🔍 Discovered collections:');
      analysis.discoveredCollections.forEach(coll => {
        console.log(`   - ${coll}`);
      });
      console.log('\n📁 Document counts:');
      Object.entries(analysis.documentCounts).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      console.log('\n💰 Financial summary:');
      console.log(`   Accounts: ${analysis.financialSummary.accountCount}`);
      console.log(`   Total balance: $${(analysis.financialSummary.totalBalance / 100).toFixed(2)}`)
      console.log(`   Transactions: ${analysis.financialSummary.transactionCount}`);
      console.log(`\n👥 Users: ${analysis.users.length}`);
      console.log('\n⚙️  Configuration:');
      console.log(`   Fiscal year starts: Month ${analysis.configuration.fiscalYearStartMonth}`);
      console.log(`   Currency: ${analysis.configuration.currency}`);
      console.log(`   Timezone: ${analysis.configuration.timezone}`);
    }
    
    console.log('\n📋 Next step:');
    console.log(`   Run: backup-prod-client.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Analysis failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          analyze: {
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

// Run analysis
main();