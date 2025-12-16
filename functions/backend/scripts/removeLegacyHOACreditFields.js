import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

const stats = {
  clientsProcessed: 0,
  unitsScanned: 0,
  duesDocumentsUpdated: 0,
  fieldsRemoved: 0,
  errors: []
};

async function removeLegacyFieldsForClient(clientId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧹 REMOVING LEGACY HOA CREDIT FIELDS - Client: ${clientId}`);
  console.log(`${'='.repeat(80)}\n`);

  const db = await getDb();
  stats.clientsProcessed++;

  try {
    const unitsRef = db.collection('clients').doc(clientId).collection('units');
    const unitsSnapshot = await unitsRef.get();

    if (unitsSnapshot.empty) {
      console.log('⚠️ No units found for this client');
      return;
    }

    let batch = db.batch();
    let batchOps = 0;

    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      if (unitId === 'creditBalances') {
        continue;
      }

      stats.unitsScanned++;
      const duesCollection = unitsRef.doc(unitId).collection('dues');
      const duesSnapshot = await duesCollection.get();

      if (duesSnapshot.empty) {
        continue;
      }

      for (const duesDoc of duesSnapshot.docs) {
        const data = duesDoc.data() || {};
        const hasLegacyCredit = Object.prototype.hasOwnProperty.call(data, 'creditBalance');
        const hasLegacyHistory = Object.prototype.hasOwnProperty.call(data, 'creditBalanceHistory');

        if (!hasLegacyCredit && !hasLegacyHistory) {
          continue;
        }

        console.log(`🗑️ Removing legacy credit fields → Unit ${unitId}, Dues ${duesDoc.id}`);

        batch.update(duesDoc.ref, {
          creditBalance: admin.firestore.FieldValue.delete(),
          creditBalanceHistory: admin.firestore.FieldValue.delete()
        });

        batchOps++;
        stats.duesDocumentsUpdated++;
        stats.fieldsRemoved += Number(hasLegacyCredit) + Number(hasLegacyHistory);

        if (batchOps >= 400) {
          await batch.commit();
          console.log('💾 Committed batch of 400 updates');
          batch = db.batch();
          batchOps = 0;
        }
      }
    }

    if (batchOps > 0) {
      await batch.commit();
      console.log(`💾 Committed final batch of ${batchOps} updates`);
    }

    console.log(`\n✅ Completed cleanup for client ${clientId}`);
  } catch (error) {
    console.error(`❌ Error cleaning legacy fields for client ${clientId}:`, error);
    stats.errors.push({ clientId, message: error.message });
  }
}

function printSummary() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 LEGACY HOA CREDIT FIELD CLEANUP SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`Clients processed: ${stats.clientsProcessed}`);
  console.log(`Units scanned: ${stats.unitsScanned}`);
  console.log(`Dues documents updated: ${stats.duesDocumentsUpdated}`);
  console.log(`Fields removed: ${stats.fieldsRemoved}`);
  console.log(`Errors: ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    console.log('Error details:');
    stats.errors.forEach(err => console.log(` - ${err.clientId}: ${err.message}`));
  }
  console.log(`${'='.repeat(80)}\n`);
}

async function run() {
  const clientIdArg = process.argv[2];

  if (clientIdArg && clientIdArg !== '--all') {
    await removeLegacyFieldsForClient(clientIdArg);
    printSummary();
    process.exit(0);
  }

  const db = await getDb();
  const clientsSnapshot = await db.collection('clients').get();

  for (const clientDoc of clientsSnapshot.docs) {
    await removeLegacyFieldsForClient(clientDoc.id);
  }

  printSummary();
  process.exit(0);
}

run().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
