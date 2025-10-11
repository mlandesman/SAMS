#!/usr/bin/env node

/**
 * Migration Script: Convert User Document IDs from UID to Email
 * 
 * This script:
 * 1. Reads all user documents from Firestore
 * 2. Creates new documents with email as ID
 * 3. Copies all data to new documents
 * 4. Optionally deletes old documents
 * 
 * Benefits:
 * - Consistent document IDs across all environments
 * - No more UID mismatch issues during migrations
 * - Easier debugging and user lookup
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Configuration
const BATCH_SIZE = 500; // Firestore batch limit
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD = process.argv.includes('--delete-old');

// Initialize Firebase Admin based on environment
function initializeFirebase() {
  const env = process.env.NODE_ENV || 'production';
  
  if (env === 'development') {
    // Development credentials
    const serviceAccount = require('../backend/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
    console.log('🔧 Connected to DEVELOPMENT Firebase');
  } else {
    // Production credentials
    const serviceAccount = require('../backend/sams-production-serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sams-sandyland-prod'
    });
    console.log('🔧 Connected to PRODUCTION Firebase');
  }
}

// Sanitize email for use as document ID using base64URL encoding
function sanitizeEmailForDocId(email) {
  // Use base64URL encoding which is Firestore-safe and reversible
  // This preserves all original characters and can be decoded back
  const base64 = Buffer.from(email.toLowerCase()).toString('base64');
  // Convert to base64URL by replacing + with -, / with _, and removing =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Decode base64URL back to email
function unsanitizeDocId(docId) {
  // Add back padding if needed
  const padding = (4 - (docId.length % 4)) % 4;
  const base64 = docId
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + '='.repeat(padding);
  
  return Buffer.from(base64, 'base64').toString('utf8');
}

// Prompt for confirmation
async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function migrateUsers() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    const usersRef = db.collection('users');
    
    console.log('\n📊 Starting user document migration...\n');
    
    // Get all user documents
    const snapshot = await usersRef.get();
    console.log(`Found ${snapshot.size} user documents\n`);
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    const migrationPlan = [];
    const errors = [];
    
    // Analyze all documents
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const currentId = doc.id;
      const email = userData.email;
      
      if (!email) {
        errors.push({
          docId: currentId,
          error: 'No email field found'
        });
        continue;
      }
      
      const newId = sanitizeEmailForDocId(email);
      
      // Check if document with email ID already exists
      const existingDoc = await usersRef.doc(newId).get();
      
      migrationPlan.push({
        currentId,
        newId,
        email,
        userData,
        alreadyExists: existingDoc.exists,
        isEmailFormat: currentId === newId // Check if current ID already matches the email-based format
      });
    }
    
    // Display migration plan
    console.log('📋 Migration Plan:\n');
    console.log('Documents to migrate:');
    migrationPlan
      .filter(m => !m.alreadyExists && !m.isEmailFormat)
      .forEach(m => {
        console.log(`  ${m.email}: ${m.currentId} → ${m.newId}`);
      });
    
    console.log('\nAlready migrated (email-based IDs):');
    migrationPlan
      .filter(m => m.isEmailFormat || m.alreadyExists)
      .forEach(m => {
        console.log(`  ✓ ${m.email}`);
      });
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors found:');
      errors.forEach(e => {
        console.log(`  ${e.docId}: ${e.error}`);
      });
    }
    
    // Count documents to migrate
    const toMigrate = migrationPlan.filter(m => !m.alreadyExists && !m.isEmailFormat);
    
    if (toMigrate.length === 0) {
      console.log('\n✅ No documents need migration!');
      return;
    }
    
    console.log(`\n📊 Summary: ${toMigrate.length} documents will be migrated\n`);
    
    if (!DRY_RUN) {
      const proceed = await confirmAction('Proceed with migration?');
      if (!proceed) {
        console.log('❌ Migration cancelled');
        return;
      }
    }
    
    // Perform migration in batches
    if (!DRY_RUN) {
      console.log('\n🚀 Starting migration...\n');
      
      let migrated = 0;
      let batch = db.batch();
      let batchCount = 0;
      
      for (const migration of toMigrate) {
        // Create new document with email as ID
        const newDocRef = usersRef.doc(migration.newId);
        batch.set(newDocRef, {
          ...migration.userData,
          _migrated: {
            from: migration.currentId,
            at: admin.firestore.FieldValue.serverTimestamp(),
            method: 'email-docid-migration'
          }
        });
        
        batchCount++;
        
        // Commit batch when it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          migrated += batchCount;
          console.log(`  Migrated ${migrated}/${toMigrate.length} documents...`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        migrated += batchCount;
      }
      
      console.log(`\n✅ Successfully migrated ${migrated} documents\n`);
      
      // Delete old documents if requested
      if (DELETE_OLD) {
        const deleteConfirm = await confirmAction('Delete old UID-based documents?');
        if (deleteConfirm) {
          console.log('\n🗑️  Deleting old documents...\n');
          
          let deleted = 0;
          batch = db.batch();
          batchCount = 0;
          
          for (const migration of toMigrate) {
            const oldDocRef = usersRef.doc(migration.currentId);
            batch.delete(oldDocRef);
            batchCount++;
            
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              deleted += batchCount;
              console.log(`  Deleted ${deleted}/${toMigrate.length} documents...`);
              batch = db.batch();
              batchCount = 0;
            }
          }
          
          if (batchCount > 0) {
            await batch.commit();
            deleted += batchCount;
          }
          
          console.log(`\n✅ Deleted ${deleted} old documents\n`);
        }
      }
    }
    
    console.log('\n📋 Migration Summary:');
    console.log(`  Total users: ${snapshot.size}`);
    console.log(`  Migrated: ${toMigrate.length}`);
    console.log(`  Already using email IDs: ${migrationPlan.filter(m => m.isEmailFormat).length}`);
    console.log(`  Errors: ${errors.length}`);
    
    if (!DELETE_OLD && !DRY_RUN && toMigrate.length > 0) {
      console.log('\n💡 Tip: Run with --delete-old to remove old UID-based documents');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Script usage
function showUsage() {
  console.log(`
User Document ID Migration Script

This script migrates Firestore user documents from UID-based document IDs 
to email-based document IDs for consistent cross-environment deployments.

Usage:
  node migrate-to-email-docids.js [options]

Options:
  --dry-run     Show what would be migrated without making changes
  --delete-old  Delete old UID-based documents after migration

Environment:
  NODE_ENV=development  Use development Firebase project
  NODE_ENV=production   Use production Firebase project (default)

Examples:
  # Dry run in production
  node migrate-to-email-docids.js --dry-run
  
  # Migrate in development
  NODE_ENV=development node migrate-to-email-docids.js
  
  # Migrate and delete old documents
  node migrate-to-email-docids.js --delete-old
`);
}

// Main execution
if (process.argv.includes('--help')) {
  showUsage();
} else {
  console.log('🔄 User Document ID Migration Tool\n');
  migrateUsers().catch(console.error);
}