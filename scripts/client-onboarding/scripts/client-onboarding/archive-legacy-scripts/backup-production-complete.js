#!/usr/bin/env node

/**
 * Complete Production Backup Script
 * 
 * Purpose: Creates a complete backup of ALL production data before migration
 * This is a safety measure to enable full rollback if needed
 * 
 * Usage: node scripts/backup-production-complete.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Production Firebase configuration
const PROD_SERVICE_ACCOUNT = path.join(__dirname, '../firebase-keys/sams-production-firebase-adminsdk.json');
const PROD_PROJECT_ID = 'sams-production';

// Initialize Firebase Admin for production
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(PROD_SERVICE_ACCOUNT),
    projectId: PROD_PROJECT_ID
  });
}

const db = admin.firestore();

// Recursive function to get all collections
async function getAllCollections(parentPath = null) {
  const collections = [];
  
  try {
    let collectionRefs;
    
    if (parentPath) {
      const docRef = db.doc(parentPath);
      collectionRefs = await docRef.listCollections();
    } else {
      collectionRefs = await db.listCollections();
    }
    
    for (const collRef of collectionRefs) {
      const collectionPath = parentPath ? `${parentPath}/${collRef.id}` : collRef.id;
      collections.push(collectionPath);
      
      const snapshot = await collRef.get();
      
      for (const doc of snapshot.docs) {
        const docPath = `${collectionPath}/${doc.id}`;
        const subCollections = await getAllCollections(docPath);
        collections.push(...subCollections);
      }
    }
  } catch (error) {
    console.error(`Error listing collections at ${parentPath}:`, error);
  }
  
  return collections;
}

// Backup a single collection
async function backupCollection(collectionPath) {
  const parts = collectionPath.split('/');
  let collectionRef;
  
  if (parts.length === 1) {
    collectionRef = db.collection(collectionPath);
  } else {
    collectionRef = db.doc(parts.slice(0, -1).join('/')).collection(parts[parts.length - 1]);
  }
  
  const snapshot = await collectionRef.get();
  const documents = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  return documents;
}

// Backup Firebase Auth users
async function backupAuthUsers() {
  console.log('👥 Backing up Firebase Auth users...');
  
  const auth = admin.auth();
  const users = [];
  let nextPageToken;
  
  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    
    listResult.users.forEach(user => {
      users.push({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
        customClaims: user.customClaims,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        }
      });
    });
    
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);
  
  console.log(`✅ Backed up ${users.length} auth users`);
  return users;
}

// Main backup function
async function backupProduction() {
  console.log('🔵 Starting complete production backup...');
  console.log(`📊 Project: ${PROD_PROJECT_ID}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
  
  try {
    // Create backup directory
    const backupDir = path.join(__dirname, '../backups/production');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `complete-backup-${timestamp}.json`);
    
    // Get all collections
    console.log('🔍 Discovering all collections...');
    const allCollections = await getAllCollections();
    console.log(`✅ Found ${allCollections.length} collections\n`);
    
    // Backup data
    const backupData = {
      metadata: {
        timestamp: new Date().toISOString(),
        project: PROD_PROJECT_ID,
        backupType: 'complete-production-backup',
        totalCollections: allCollections.length,
        critical: true,
        purpose: 'Pre-migration safety backup'
      },
      collections: {},
      authUsers: []
    };
    
    let totalDocuments = 0;
    
    // Backup each collection
    for (const collectionPath of allCollections) {
      process.stdout.write(`📥 Backing up ${collectionPath}...`);
      
      try {
        const documents = await backupCollection(collectionPath);
        
        if (documents.length > 0) {
          backupData.collections[collectionPath] = documents;
          totalDocuments += documents.length;
          console.log(` ✅ ${documents.length} documents`);
        } else {
          console.log(' ⚠️  Empty');
        }
      } catch (error) {
        console.log(` ❌ Error: ${error.message}`);
      }
    }
    
    // Backup Auth users
    backupData.authUsers = await backupAuthUsers();
    
    // Update metadata
    backupData.metadata.totalDocuments = totalDocuments;
    backupData.metadata.totalAuthUsers = backupData.authUsers.length;
    
    // Write backup file
    console.log(`\n💾 Writing backup file...`);
    await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
    
    // Create summary
    const summaryFile = path.join(backupDir, `backup-summary-${timestamp}.txt`);
    const summary = `Production Backup Summary
========================
Timestamp: ${new Date().toISOString()}
Project: ${PROD_PROJECT_ID}
Backup Type: Complete Production Backup
Purpose: Pre-migration safety backup

Statistics:
- Total Collections: ${allCollections.length}
- Total Documents: ${totalDocuments}
- Total Auth Users: ${backupData.authUsers.length}
- Backup File: ${backupFile}

Important Collections:
${Object.keys(backupData.collections)
  .filter(c => ['clients', 'users', 'exchangeRates', 'config'].includes(c.split('/')[0]))
  .map(c => `  - ${c}: ${backupData.collections[c].length} documents`)
  .join('\n')}

Exchange Rates Status:
${backupData.collections.exchangeRates ? 
  `✅ Backed up ${backupData.collections.exchangeRates.length} exchange rate documents` : 
  '⚠️  No exchange rates found'}

Restore Command:
node scripts/restore-production-backup.js --file "${path.basename(backupFile)}"

⚠️  CRITICAL: This backup contains production data including exchange rates.
Keep this file secure and use only for emergency rollback.
`;
    
    await fs.writeFile(summaryFile, summary);
    
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📁 Backup file: ${backupFile}`);
    console.log(`📋 Summary: ${summaryFile}`);
    console.log(`📊 Total documents: ${totalDocuments}`);
    console.log(`👥 Total auth users: ${backupData.authUsers.length}`);
    
    // Special handling for exchange rates
    if (backupData.collections.exchangeRates) {
      console.log(`\n💱 Exchange Rates: ${backupData.collections.exchangeRates.length} documents backed up`);
      console.log('   These are CRITICAL - production has the correct data');
    }
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error);
    process.exit(1);
  }
}

// Verify production environment
async function verifyProduction() {
  console.log('🔍 Verifying production environment...\n');
  
  if (!PROD_PROJECT_ID.includes('production') && !PROD_PROJECT_ID.includes('prod')) {
    console.error('❌ ERROR: This doesn\'t look like a production project!');
    console.error(`   Project ID: ${PROD_PROJECT_ID}`);
    
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
    console.log('🚀 Complete Production Backup Tool');
    console.log('=================================\n');
    
    await verifyProduction();
    await backupProduction();
    
    console.log('\n📋 Next steps:');
    console.log('1. Verify backup completeness');
    console.log('2. Store backup file securely');
    console.log('3. Proceed with migration');
    console.log('4. Keep backup available for emergency rollback');
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('This backup contains ALL production data including exchange rates.');
    console.log('Use this ONLY for emergency rollback if migration fails.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();