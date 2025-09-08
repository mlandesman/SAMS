#!/usr/bin/env node

/**
 * Production ExchangeRates Backup Script
 * 
 * Purpose: Backs up ONLY the exchangeRates collection from production
 * This preserves the correct production exchange rate data
 * 
 * Usage: node scripts/backup-production-exchangerates.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// CRITICAL: Update this to your production service account
const PRODUCTION_SERVICE_ACCOUNT = path.join(__dirname, '../firebase-keys/sams-production-firebase-adminsdk.json');
const PRODUCTION_PROJECT_ID = 'sams-production'; // Update with actual production project ID

// Initialize production Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(PRODUCTION_SERVICE_ACCOUNT),
    projectId: PRODUCTION_PROJECT_ID
  });
}

const db = admin.firestore();

async function backupExchangeRates() {
  console.log('🔵 Starting production exchangeRates backup...');
  console.log(`📊 Project: ${PRODUCTION_PROJECT_ID}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Create backup directory
    const backupDir = path.join(__dirname, '../backups/production');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `exchangeRates-backup-${timestamp}.json`);
    
    // Fetch all exchange rates
    console.log('📥 Fetching exchangeRates from production...');
    const exchangeRatesSnapshot = await db.collection('exchangeRates').get();
    
    if (exchangeRatesSnapshot.empty) {
      console.log('⚠️  WARNING: No exchange rates found in production!');
      return;
    }
    
    const exchangeRates = [];
    let rateCount = 0;
    
    exchangeRatesSnapshot.forEach(doc => {
      exchangeRates.push({
        id: doc.id,
        data: doc.data()
      });
      rateCount++;
    });
    
    console.log(`✅ Found ${rateCount} exchange rate documents`);
    
    // Create backup object
    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        project: PRODUCTION_PROJECT_ID,
        collection: 'exchangeRates',
        documentCount: rateCount,
        backupType: 'exchangeRates-only',
        critical: true,
        warning: 'DO NOT OVERWRITE THESE IN PRODUCTION - CORRECT DATA'
      },
      data: {
        exchangeRates: exchangeRates
      }
    };
    
    // Write backup file
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup saved to: ${backupFile}`);
    
    // Create a latest symlink for easy access
    const latestFile = path.join(backupDir, 'exchangeRates-latest.json');
    try {
      await fs.unlink(latestFile);
    } catch (e) {
      // Ignore if doesn't exist
    }
    await fs.symlink(path.basename(backupFile), latestFile);
    
    // Display sample of backed up data
    console.log('\n📊 Sample of backed up exchange rates:');
    exchangeRates.slice(0, 3).forEach(rate => {
      console.log(`  - ${rate.id}: ${JSON.stringify(rate.data).substring(0, 100)}...`);
    });
    
    console.log('\n✅ Exchange rates backup completed successfully!');
    console.log('🔒 This data is protected and will NOT be overwritten during migration');
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Verify we're really backing up production
async function verifyProduction() {
  console.log('\n🔍 Verifying production environment...');
  
  if (!PRODUCTION_PROJECT_ID.includes('production') && !PRODUCTION_PROJECT_ID.includes('prod')) {
    console.error('❌ ERROR: This doesn\'t look like a production project ID!');
    console.error(`   Project ID: ${PRODUCTION_PROJECT_ID}`);
    console.error('   Please verify the configuration.');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question('Continue anyway? (yes/no): ', (answer) => {
        readline.close();
        if (answer.toLowerCase() !== 'yes') {
          console.log('Backup cancelled.');
          process.exit(0);
        }
        resolve();
      });
    });
  }
}

// Main execution
(async () => {
  try {
    console.log('🚀 Production Exchange Rates Backup Tool');
    console.log('=====================================\n');
    
    await verifyProduction();
    await backupExchangeRates();
    
    console.log('\n📋 Next steps:');
    console.log('1. Verify the backup file contains correct exchange rates');
    console.log('2. Keep this backup safe during migration');
    console.log('3. Use this to restore if production rates are accidentally modified');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();