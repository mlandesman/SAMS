/**
 * Simplified MTC Data Backup Script for Phase 2
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';

const CLIENT_ID = 'MTC';
const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

async function createBackup() {
  try {
    console.log('🚀 Starting MTC data backup...');
    
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create backup directory
    const backupPath = path.join(BACKUP_DIR, `MTC-backup-${TIMESTAMP}`);
    await fs.mkdir(backupPath, { recursive: true });
    console.log(`📁 Created backup directory: ${backupPath}`);
    
    // Collections to backup
    const collections = ['transactions', 'projects', 'units', 'vendors', 'categories', 'documents', 'paymentMethods'];
    const backupSummary = { collections: {}, timestamp: TIMESTAMP };
    
    // Backup client document
    console.log('📄 Backing up client document...');
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      const clientData = { id: clientDoc.id, data: clientDoc.data() };
      await fs.writeFile(path.join(backupPath, 'client-document.json'), JSON.stringify(clientData, null, 2));
      console.log('✅ Client document backed up');
      backupSummary.client = {
        exists: true,
        accounts: clientData.data.accounts?.length || 0
      };
    }
    
    // Backup each collection
    for (const collectionName of collections) {
      try {
        console.log(`📦 Backing up ${collectionName}...`);
        
        const collectionRef = db.collection('clients').doc(CLIENT_ID).collection(collectionName);
        const snapshot = await collectionRef.get();
        
        const documents = [];
        snapshot.forEach(doc => {
          documents.push({ id: doc.id, data: doc.data() });
        });
        
        await fs.writeFile(
          path.join(backupPath, `${collectionName}.json`), 
          JSON.stringify(documents, null, 2)
        );
        
        console.log(`✅ ${collectionName}: ${documents.length} documents`);
        backupSummary.collections[collectionName] = {
          documentCount: documents.length,
          backedUp: true
        };
      } catch (error) {
        console.warn(`⚠️ Failed to backup ${collectionName}:`, error.message);
        backupSummary.collections[collectionName] = {
          documentCount: 0,
          backedUp: false,
          error: error.message
        };
      }
    }
    
    // Save backup summary
    await fs.writeFile(path.join(backupPath, 'backup-summary.json'), JSON.stringify(backupSummary, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 BACKUP SUMMARY');
    console.log('='.repeat(50));
    console.log(`📁 Location: ${backupPath}`);
    console.log(`📄 Client: ${backupSummary.client?.exists ? 'Backed up' : 'Not found'}`);
    console.log(`🏦 Accounts: ${backupSummary.client?.accounts || 0}`);
    
    Object.entries(backupSummary.collections).forEach(([name, info]) => {
      const status = info.backedUp ? '✅' : '❌';
      console.log(`${status} ${name}: ${info.documentCount} docs`);
    });
    
    console.log('\n✅ Backup completed successfully!');
    console.log('🔄 Ready for purge operation');
    
    return {
      success: true,
      backupPath,
      summary: backupSummary
    };
    
  } catch (error) {
    console.error('💥 Backup failed:', error);
    throw error;
  }
}

// Execute
createBackup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });