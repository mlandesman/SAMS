/**
 * Migrate Emails from Legacy Field to Owner Objects
 * 
 * Migrates email addresses from unit.emails array to unit.owners[].email fields
 * 
 * FROM: unit.emails = "email1@example.com;email2@example.com" (semicolon-separated for email "Send To:" fields)
 * TO:   unit.owners = [{name: "Owner 1", email: "email1@example.com"}, {name: "Owner 2", email: "email2@example.com"}]
 * 
 * Migration Logic:
 * - If unit has emails array or semicolon/comma-separated string:
 *   - Split on semicolons (primary) or commas (fallback)
 *   - Match emails to owners by index (first email to first owner, etc.)
 *   - Overwrite existing owner emails
 *   - Create new owner entries for extra emails
 * - After migration, remove the emails field
 * 
 * Date: December 16, 2025
 * Task: UI-UNIT-CONTACT-STRUCTURE-20251216
 */

import admin from 'firebase-admin';
import { normalizeOwners } from '../utils/unitContactUtils.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const stats = {
  clientsProcessed: 0,
  unitsScanned: 0,
  unitsMigrated: 0,
  emailsMigrated: 0,
  emailsRemoved: 0,
  errors: []
};

/**
 * Migrate emails from legacy field to owner objects for a single unit
 * Migrates ALL emails from legacy field to owner objects, overwriting existing emails if needed
 */
function migrateUnitEmails(unitData) {
  const emails = unitData.emails || [];
  // Split on semicolons (primary) or commas (fallback) - semicolons used for email "Send To:" fields
  const emailArray = Array.isArray(emails) 
    ? emails 
    : (typeof emails === 'string' 
        ? emails.split(/[;,]/).map(e => e.trim()).filter(e => e) 
        : []);
  
  if (emailArray.length === 0) {
    // No emails to migrate, but still remove emails field if it exists
    if (unitData.emails !== undefined) {
      return {
        emails: admin.firestore.FieldValue.delete()
      };
    }
    return null; // No emails field, nothing to do
  }
  
  // Normalize owners to new structure
  let normalizedOwners = normalizeOwners(unitData.owners || []);
  
  if (normalizedOwners.length === 0) {
    // No owners, but we have emails - create owner entries from emails
    console.log(`   Creating owner entries from emails (no existing owners)`);
    normalizedOwners = emailArray.map(email => ({
      name: '', // Empty name - will need to be filled in manually
      email: email
    }));
  } else {
    // Migrate emails to owners by index (overwrite existing emails)
    normalizedOwners = normalizedOwners.map((owner, index) => {
      // Assign email from legacy field (overwrites existing email if present)
      if (emailArray[index]) {
        return { ...owner, email: emailArray[index] };
      }
      return owner;
    });
    
    // If there are more emails than owners, add them as new owner entries
    if (emailArray.length > normalizedOwners.length) {
      const extraEmails = emailArray.slice(normalizedOwners.length);
      extraEmails.forEach(email => {
        normalizedOwners.push({
          name: '', // Empty name - will need to be filled in manually
          email: email
        });
      });
    }
  }
  
  // Prepare update object
  const updateData = {
    owners: normalizedOwners,
    emails: admin.firestore.FieldValue.delete() // Always remove emails field
  };
  
  return updateData;
}

/**
 * Initialize Firebase Admin SDK for the script
 */
function initializeFirebaseForScript(isProduction = false) {
  if (admin.apps.length > 0) {
    return admin.firestore(); // Already initialized
  }

  console.log('🔥 Initializing Firebase Admin SDK...');
  
  if (isProduction) {
    // Production - use Application Default Credentials (same as analyzeUnitEmails.js)
    admin.initializeApp({
      projectId: 'sams-sandyland-prod',
    });
    console.log('🔑 Connected to PRODUCTION (sams-sandyland-prod)');
  } else {
    // Dev - use dev project
    admin.initializeApp({
      projectId: 'sandyland-management-system',
    });
    console.log('🔑 Connected to DEV (sandyland-management-system)');
  }
  
  console.log('✅ Firebase Admin SDK initialized successfully');
  return admin.firestore();
}

/**
 * Migrate emails for all units in a client
 */
async function migrateClientUnits(clientId, options = {}) {
  const { dryRun = false, isProduction = false } = options;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📧 MIGRATING EMAILS TO OWNER OBJECTS - Client: ${clientId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(80)}\n`);

  const db = initializeFirebaseForScript(isProduction);
  stats.clientsProcessed++;

  try {
    const unitsRef = db.collection('clients').doc(clientId).collection('units');
    const unitsSnapshot = await unitsRef.get();

    if (unitsSnapshot.empty) {
      console.log('⚠️  No units found for this client');
      return;
    }

    let batch = db.batch();
    let batchOps = 0;

    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      if (unitId === 'creditBalances') {
        continue; // Skip creditBalances document
      }

      stats.unitsScanned++;
      const unitData = unitDoc.data() || {};
      
      // Migrate emails to owner objects (or remove emails field if it exists)
      const updateData = migrateUnitEmails(unitData);
      
      if (!updateData) {
        continue; // No migration needed (no emails field)
      }
      
      console.log(`📧 Migrating emails → Unit ${unitId}`);
      console.log(`   Emails found: ${Array.isArray(unitData.emails) ? unitData.emails.join(', ') : unitData.emails}`);
      console.log(`   Owners before: ${JSON.stringify(unitData.owners || [])}`);
      console.log(`   Owners after: ${JSON.stringify(updateData.owners)}`);
      
      if (!dryRun) {
        batch.update(unitDoc.ref, updateData);
        batchOps++;
        stats.unitsMigrated++;
        stats.emailsMigrated += Array.isArray(unitData.emails) ? unitData.emails.length : 1;
        stats.emailsRemoved++;
        
        if (batchOps >= 400) {
          await batch.commit();
          console.log('💾 Committed batch of 400 updates');
          batch = db.batch();
          batchOps = 0;
        }
      } else {
        console.log('   [DRY RUN] Would update unit');
        stats.unitsMigrated++;
        stats.emailsMigrated += Array.isArray(unitData.emails) ? unitData.emails.length : 1;
        stats.emailsRemoved++;
      }
    }

    if (!dryRun && batchOps > 0) {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchOps} updates`);
    }

    console.log(`\n✅ Completed migration for client ${clientId}`);
  } catch (error) {
    console.error(`❌ Error migrating client ${clientId}:`, error);
    stats.errors.push({ clientId, error: error.message });
  }
}

/**
 * Main migration function
 */
async function migrateEmailsToOwnerObjects(options = {}) {
  const { clients = ['MTC', 'AVII'], dryRun = true, isProduction = false } = options;
  
  console.log('\n🚀 Starting Email Migration to Owner Objects');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be saved)'}`);
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEV'}`);
  console.log(`Clients: ${clients.join(', ')}\n`);

  for (const clientId of clients) {
    try {
      await migrateClientUnits(clientId, { dryRun, isProduction });
    } catch (error) {
      console.error(`❌ Failed to process client ${clientId}:`, error);
      stats.errors.push({ clientId, error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Clients Processed: ${stats.clientsProcessed}`);
  console.log(`Units Scanned: ${stats.unitsScanned}`);
  console.log(`Units Migrated: ${stats.unitsMigrated}`);
  console.log(`Emails Migrated: ${stats.emailsMigrated}`);
  console.log(`Emails Fields Removed: ${stats.emailsRemoved}`);
  console.log(`Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.clientId}: ${err.error}`);
    });
  }
  
  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
    console.log('   Run with dryRun=false to apply changes');
  } else {
    console.log('\n✅ Migration completed successfully!');
  }
  
  console.log('='.repeat(80) + '\n');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const isProduction = args.includes('--prod');
  const clients = args.includes('--client') 
    ? [args[args.indexOf('--client') + 1]]
    : ['MTC', 'AVII'];
  
  migrateEmailsToOwnerObjects({ clients, dryRun, isProduction })
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateEmailsToOwnerObjects;
