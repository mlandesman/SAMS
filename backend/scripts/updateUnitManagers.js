/**
 * Update Unit Managers Script
 * 
 * Purpose: Add managers to the managers array for specific units
 * 
 * Usage:
 *   DRY RUN:  node backend/scripts/updateUnitManagers.js --prod
 *   EXECUTE:  node backend/scripts/updateUnitManagers.js --prod --execute
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

// Managers to add - from the user's table
const managersToAdd = [
  { clientId: 'AVII', unitId: '101', name: 'Ramiro de Lisarreta', email: 'rl@massive.ag' },
  { clientId: 'AVII', unitId: '105', name: 'Georgina Lara', email: 'realestatemaya@gmail.com' },
  { clientId: 'AVII', unitId: '201', name: 'Craig Verbeck', email: 'athomerivieramaya@gmail.com' },
  { clientId: 'AVII', unitId: '202', name: 'Nancy Violette', email: 'nancy@centralmainedrywall.com' },
  { clientId: 'AVII', unitId: '202', name: 'Salim Greyeb', email: 'salimgrayebd@gmail.com' },
  { clientId: 'AVII', unitId: '204', name: 'Margarita Marin Ballesteros', email: 'salespuertoaventuras@gmail.com' },
];

async function main() {
  console.log('═'.repeat(70));
  console.log('  UPDATE UNIT MANAGERS');
  console.log('═'.repeat(70));
  console.log(`Environment: ${ENV.toUpperCase()}`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (making changes)'}`);
  console.log('');

  // Group managers by unit
  const unitManagersMap = new Map();
  managersToAdd.forEach(m => {
    const key = `${m.clientId}:${m.unitId}`;
    if (!unitManagersMap.has(key)) {
      unitManagersMap.set(key, { clientId: m.clientId, unitId: m.unitId, managers: [] });
    }
    unitManagersMap.get(key).managers.push({ name: m.name, email: m.email });
  });

  let successCount = 0;
  let errorCount = 0;

  for (const [key, data] of unitManagersMap) {
    const { clientId, unitId, managers } = data;
    console.log(`\n📍 ${clientId}:${unitId}`);
    
    try {
      const unitRef = db.collection('clients').doc(clientId)
        .collection('units').doc(unitId);
      
      const unitDoc = await unitRef.get();
      if (!unitDoc.exists) {
        console.log(`  ❌ Unit not found!`);
        errorCount++;
        continue;
      }

      const currentData = unitDoc.data();
      const currentManagers = currentData.managers || [];
      
      console.log(`  Current managers: ${currentManagers.length > 0 ? JSON.stringify(currentManagers) : '(none)'}`);
      
      // Build new managers array
      const newManagers = [...currentManagers];
      managers.forEach(m => {
        // Check if already exists (by email)
        const exists = newManagers.some(existing => 
          (typeof existing === 'object' && existing.email === m.email) ||
          (typeof existing === 'string' && existing === m.email)
        );
        if (!exists) {
          newManagers.push({ name: m.name, email: m.email });
          console.log(`  ➕ Adding: ${m.name} (${m.email})`);
        } else {
          console.log(`  ⏭️  Already exists: ${m.email}`);
        }
      });

      if (newManagers.length === currentManagers.length) {
        console.log(`  ✓ No changes needed`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update managers to: ${JSON.stringify(newManagers)}`);
      } else {
        await unitRef.update({ 
          managers: newManagers,
          updated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✅ Updated managers array`);
      }
      successCount++;

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  SUMMARY');
  console.log('═'.repeat(70));
  console.log(`  Units processed: ${unitManagersMap.size}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN COMPLETE - No changes made');
    console.log('   Run with --execute to apply changes');
  } else {
    console.log('\n⚡ CHANGES APPLIED');
  }
  console.log('');
}

main().catch(console.error);
