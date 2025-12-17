/**
 * Migrate Unit Contact Structure
 * 
 * Purpose: Restructure unit owner/manager data from legacy format to new format
 * 
 * BEFORE (Legacy):
 *   emails: ["jeff@example.com;manager@example.com"]  // concatenated strings
 *   owners: ["Jeff Ische"]                            // just names
 *   managers: [{name, email}] or []                   // mixed or empty
 * 
 * AFTER (New):
 *   owners: [{name: "Jeff Ische", email: "jeff@example.com"}]
 *   managers: [{name: "Manager Name", email: "manager@example.com"}]
 *   (emails field DELETED)
 * 
 * Usage:
 *   DRY RUN:  node backend/scripts/migrateUnitContactStructure.js --prod
 *   EXECUTE:  node backend/scripts/migrateUnitContactStructure.js --prod --execute
 */

import admin from 'firebase-admin';

// Determine environment
const ENV = process.argv.includes('--prod') ? 'prod' : 'dev';
const DRY_RUN = !process.argv.includes('--execute');

// Initialize Firebase with ADC
function initFirebase() {
  if (ENV === 'prod') {
    admin.initializeApp({
      projectId: 'sams-sandyland-prod',
    });
    console.log('🔥 Connected to PRODUCTION');
  } else {
    admin.initializeApp({
      projectId: 'sandyland-management-system',
    });
    console.log('🔥 Connected to DEV');
  }
  return admin.firestore();
}

const db = initFirebase();

// Special case overrides - emails that should be managers, not owners
const MANAGER_EMAIL_OVERRIDES = {
  'MTC:PH3C': ['michelekinnon67@gmail.com']  // Michele Kinnon is manager here, owner of 1B
};

// Manager name lookup for override emails
const MANAGER_NAMES = {
  'michelekinnon67@gmail.com': 'Michele Kinnon'
};

/**
 * Parse concatenated email string into array of emails
 */
function parseEmailString(emailStr) {
  if (!emailStr) return [];
  return String(emailStr).split(/[;,]/).map(e => e.trim().toLowerCase()).filter(e => e);
}

/**
 * Get all emails from the emails field (handles array of concatenated strings)
 */
function extractAllEmails(emailsField) {
  if (!emailsField) return [];
  
  const allEmails = [];
  
  if (Array.isArray(emailsField)) {
    emailsField.forEach(entry => {
      allEmails.push(...parseEmailString(entry));
    });
  } else {
    allEmails.push(...parseEmailString(emailsField));
  }
  
  return allEmails;
}

/**
 * Get owner names from owners field
 */
function extractOwnerNames(ownersField) {
  if (!ownersField) return [];
  
  if (Array.isArray(ownersField)) {
    return ownersField.map(o => String(o).trim()).filter(o => o);
  }
  
  return [String(ownersField).trim()].filter(o => o);
}

/**
 * Process a single unit and return the migration updates
 */
function processUnit(clientId, unitId, unitData) {
  const result = {
    clientId,
    unitId,
    changes: [],
    newOwners: [],
    newManagers: [],
    warnings: []
  };

  // Extract current data
  const allEmails = extractAllEmails(unitData.emails);
  const ownerNames = extractOwnerNames(unitData.owners);
  const currentManagers = unitData.managers || [];

  // Get manager emails (already structured correctly from previous migration)
  const managerEmails = new Set();
  currentManagers.forEach(m => {
    if (typeof m === 'object' && m.email) {
      managerEmails.add(m.email.toLowerCase());
    } else if (typeof m === 'string') {
      managerEmails.add(m.toLowerCase());
    }
  });

  // Check for override emails that should be managers
  const unitKey = `${clientId}:${unitId}`;
  const overrideManagerEmails = MANAGER_EMAIL_OVERRIDES[unitKey] || [];
  
  // Add override managers to the managers list
  overrideManagerEmails.forEach(email => {
    const emailLower = email.toLowerCase();
    if (!managerEmails.has(emailLower)) {
      managerEmails.add(emailLower);
      // Add to currentManagers so they get included in newManagers
      const name = MANAGER_NAMES[emailLower] || '❓ Unknown Manager';
      currentManagers.push({ name, email: emailLower });
    }
  });

  // Owner emails are emails NOT in manager list
  const ownerEmails = allEmails.filter(e => !managerEmails.has(e));

  // Build new owners array
  if (ownerNames.length > 0 && ownerEmails.length > 0) {
    // Match by position
    for (let i = 0; i < Math.max(ownerNames.length, ownerEmails.length); i++) {
      const name = ownerNames[i] || '❓ Unknown Owner';
      const email = ownerEmails[i] || null;
      
      if (email) {
        result.newOwners.push({ name, email });
      } else if (name !== '❓ Unknown Owner') {
        result.warnings.push(`Owner "${name}" has no email`);
        result.newOwners.push({ name, email: '' });
      }
    }
  } else if (ownerNames.length > 0) {
    // Have names but no emails
    result.warnings.push('Has owner names but no owner emails');
    ownerNames.forEach(name => {
      result.newOwners.push({ name, email: '' });
    });
  } else if (ownerEmails.length > 0) {
    // Have emails but no names
    result.warnings.push('Has owner emails but no owner names');
    ownerEmails.forEach(email => {
      result.newOwners.push({ name: '❓ Unknown', email });
    });
  }

  // Build new managers array (already structured, just ensure format)
  currentManagers.forEach(m => {
    if (typeof m === 'object' && m.name && m.email) {
      result.newManagers.push({ name: m.name, email: m.email });
    } else if (typeof m === 'string') {
      result.warnings.push(`Manager "${m}" is just a string, needs name`);
      result.newManagers.push({ name: '❓ Unknown', email: m });
    }
  });

  // Determine changes
  const oldOwnersStr = JSON.stringify(unitData.owners || []);
  const newOwnersStr = JSON.stringify(result.newOwners);
  
  if (oldOwnersStr !== newOwnersStr) {
    result.changes.push('owners restructured');
  }
  
  if (unitData.emails) {
    result.changes.push('emails field to be deleted');
  }

  return result;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  MIGRATE UNIT CONTACT STRUCTURE');
  console.log('═'.repeat(80));
  console.log(`Environment: ${ENV.toUpperCase()}`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (making changes)'}`);
  console.log('');
  console.log('This migration will:');
  console.log('  1. Convert owners[] from [name] to [{name, email}]');
  console.log('  2. Ensure managers[] has [{name, email}] format');
  console.log('  3. DELETE the emails field');
  console.log('');

  const allResults = [];
  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;

  try {
    // Get all clients
    const clientsSnap = await db.collection('clients').get();
    console.log(`Found ${clientsSnap.size} clients\n`);

    for (const clientDoc of clientsSnap.docs) {
      const clientId = clientDoc.id;
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📁 Client: ${clientId}`);
      console.log('─'.repeat(60));

      // Get all units
      const unitsSnap = await db.collection('clients').doc(clientId)
        .collection('units').get();

      for (const unitDoc of unitsSnap.docs) {
        const unitId = unitDoc.id;
        const unitData = unitDoc.data();

        console.log(`\n  📍 Unit ${unitId}`);

        // Process the unit
        const result = processUnit(clientId, unitId, unitData);
        allResults.push(result);

        // Show current state
        console.log(`     Current emails: ${JSON.stringify(unitData.emails || '(none)')}`);
        console.log(`     Current owners: ${JSON.stringify(unitData.owners || '(none)')}`);
        console.log(`     Current managers: ${JSON.stringify(unitData.managers || '(none)')}`);

        // Show new state
        console.log(`     New owners: ${JSON.stringify(result.newOwners)}`);
        console.log(`     New managers: ${JSON.stringify(result.newManagers)}`);

        // Show warnings
        if (result.warnings.length > 0) {
          result.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
        }

        // Show changes
        if (result.changes.length === 0) {
          console.log('     ✓ No changes needed');
          skipCount++;
          continue;
        }

        console.log(`     Changes: ${result.changes.join(', ')}`);

        // Apply changes
        if (DRY_RUN) {
          console.log('     [DRY RUN] Would update');
          successCount++;
        } else {
          try {
            const unitRef = db.collection('clients').doc(clientId)
              .collection('units').doc(unitId);

            await unitRef.update({
              owners: result.newOwners,
              managers: result.newManagers,
              emails: admin.firestore.FieldValue.delete(),
              updated: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log('     ✅ Updated');
            successCount++;
          } catch (error) {
            console.log(`     ❌ Error: ${error.message}`);
            errorCount++;
          }
        }
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('═'.repeat(80));
    console.log(`  Total units processed: ${allResults.length}`);
    console.log(`  Updated: ${successCount}`);
    console.log(`  Skipped (no changes): ${skipCount}`);
    console.log(`  Errors: ${errorCount}`);
    
    // Warnings summary
    const allWarnings = allResults.flatMap(r => r.warnings.map(w => `${r.clientId}:${r.unitId} - ${w}`));
    if (allWarnings.length > 0) {
      console.log(`\n  ⚠️  Warnings (${allWarnings.length}):`);
      allWarnings.forEach(w => console.log(`     ${w}`));
    }

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN COMPLETE - No changes made');
      console.log('   Run with --execute to apply changes');
    } else {
      console.log('\n⚡ MIGRATION COMPLETE');
    }
    console.log('');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
