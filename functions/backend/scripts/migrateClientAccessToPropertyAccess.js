#!/usr/bin/env node

/**
 * Migration Script: clientAccess → propertyAccess
 * 
 * This script migrates all user documents in production from the old
 * 'clientAccess' field name to the new 'propertyAccess' field name.
 * 
 * Run with: NODE_ENV=production node migrateClientAccessToPropertyAccess.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const initFirebase = () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🔧 Running migration in ${env} environment`);
  
  let serviceAccountPath;
  if (env === 'production') {
    serviceAccountPath = join(__dirname, '../sams-production-serviceAccountKey.json');
  } else {
    serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
  }
  
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    console.log(`✅ Firebase initialized for project: ${serviceAccount.project_id}`);
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
};

// Main migration function
async function migrateUsers() {
  const db = initFirebase();
  
  console.log('\n📋 Starting user migration: clientAccess → propertyAccess\n');
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to check\n`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const userEmail = userData.email || 'unknown';
      
      try {
        // Check if user has clientAccess but not propertyAccess
        if (userData.clientAccess && !userData.propertyAccess) {
          console.log(`🔄 Migrating user: ${userEmail} (${userId})`);
          console.log(`   clientAccess keys: ${Object.keys(userData.clientAccess).join(', ')}`);
          
          // Prepare update - rename field
          const updates = {
            propertyAccess: userData.clientAccess,
            lastModifiedDate: new Date().toISOString(),
            lastModifiedBy: 'migration-script-clientAccess-to-propertyAccess'
          };
          
          // Update document
          await db.collection('users').doc(userId).update(updates);
          
          // Remove old field
          await db.collection('users').doc(userId).update({
            clientAccess: admin.firestore.FieldValue.delete()
          });
          
          console.log(`   ✅ Migrated successfully\n`);
          migrated++;
          
        } else if (userData.propertyAccess && userData.clientAccess) {
          // User has BOTH fields - remove the old clientAccess field
          console.log(`🧹 Cleaning user: ${userEmail} - removing duplicate clientAccess field`);
          console.log(`   Keeping propertyAccess: ${Object.keys(userData.propertyAccess).join(', ')}`);
          
          // Remove old field
          await db.collection('users').doc(userId).update({
            clientAccess: admin.firestore.FieldValue.delete(),
            lastModifiedDate: new Date().toISOString(),
            lastModifiedBy: 'migration-script-cleanup-duplicate-fields'
          });
          
          console.log(`   ✅ Cleaned successfully\n`);
          migrated++;
          
        } else if (userData.propertyAccess) {
          console.log(`⏭️  Skipping user: ${userEmail} - already has propertyAccess only`);
          skipped++;
          
        } else if (!userData.clientAccess && !userData.propertyAccess) {
          console.log(`⏭️  Skipping user: ${userEmail} - no access fields`);
          skipped++;
          
        } else {
          console.log(`⏭️  Skipping user: ${userEmail}`);
          skipped++;
        }
        
      } catch (error) {
        console.error(`❌ Error migrating user ${userEmail}:`, error.message);
        errors++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`⏭️  Skipped (already migrated or no access): ${skipped} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`📋 Total processed: ${usersSnapshot.size} users`);
    
    if (migrated > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   All users with clientAccess have been updated to use propertyAccess');
    } else {
      console.log('\n✅ No migration needed - all users already using propertyAccess');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Dry run mode
async function dryRun() {
  const db = initFirebase();
  
  console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to analyze\n`);
    
    let needsMigration = 0;
    let alreadyMigrated = 0;
    let noAccess = 0;
    let hasBoth = 0;
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userEmail = userData.email || 'unknown';
      
      if (userData.clientAccess && !userData.propertyAccess) {
        console.log(`🔄 NEEDS MIGRATION: ${userEmail}`);
        console.log(`   clientAccess: ${JSON.stringify(Object.keys(userData.clientAccess))}`);
        needsMigration++;
      } else if (userData.propertyAccess && userData.clientAccess) {
        console.log(`⚠️  HAS BOTH: ${userEmail}`);
        console.log(`   clientAccess: ${JSON.stringify(Object.keys(userData.clientAccess))}`);
        console.log(`   propertyAccess: ${JSON.stringify(Object.keys(userData.propertyAccess))}`);
        hasBoth++;
      } else if (userData.propertyAccess) {
        alreadyMigrated++;
      } else {
        noAccess++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Dry Run Analysis:');
    console.log('='.repeat(50));
    console.log(`🔄 Need migration (have clientAccess only): ${needsMigration}`);
    console.log(`✅ Already migrated (have propertyAccess): ${alreadyMigrated}`);
    console.log(`⚠️  Have BOTH fields: ${hasBoth}`);
    console.log(`⏭️  No access fields: ${noAccess}`);
    console.log(`📋 Total users: ${usersSnapshot.size}`);
    
    if (needsMigration > 0) {
      console.log('\n💡 Run without --dry-run to perform migration');
    } else {
      console.log('\n✅ No migration needed!');
    }
    
  } catch (error) {
    console.error('❌ Dry run failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Check command line arguments
const isDryRun = process.argv.includes('--dry-run');

// Confirm production run
if (process.env.NODE_ENV === 'production' && !isDryRun) {
  console.log('\n⚠️  WARNING: This will modify PRODUCTION user data!');
  console.log('   Run with --dry-run first to preview changes.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  setTimeout(() => {
    migrateUsers();
  }, 5000);
} else if (isDryRun) {
  dryRun();
} else {
  migrateUsers();
}