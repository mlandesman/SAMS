/**
 * Temporary PROD script: create yearEndBalances/2025 for MTC if missing.
 * Uses ADC against sams-sandyland-prod. Do not commit.
 */
import admin from 'firebase-admin';
import { getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { pesosToCentavos } from '../../shared/utils/currencyUtils.js';

const clientId = 'MTC';
const closingYear = 2025;

function initProdAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'sams-sandyland-prod'
    });
  }
  return admin.firestore();
}

async function main() {
  console.log('🌎 PROD create yearEndBalances start');
  const db = initProdAdmin();

  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  if (!clientDoc.exists) throw new Error('Client not found');
  const clientData = clientDoc.data();
  const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;

  const { endDate } = getFiscalYearBounds(closingYear, fiscalYearStartMonth);
  const snapshotDate = endDate.toISOString().split('T')[0];

  const yearEndRef = db.doc(`clients/${clientId}/yearEndBalances/${closingYear}`);
  const existing = await yearEndRef.get();
  if (existing.exists) {
    console.log(`⚠️ yearEndBalances/${closingYear} already exists; skipping.`);
    return;
  }

  const accounts = (clientData.accounts || [])
    .filter(acc => acc.active !== false)
    .map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: pesosToCentavos(acc.balance || 0)
    }));

  const payload = {
    fiscalYear: closingYear,
    date: snapshotDate,
    accounts,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: 'automation@sams',
    clientId
  };

  await yearEndRef.set(payload);
  console.log(`✅ Created yearEndBalances/${closingYear} with ${accounts.length} accounts`);
}

main().then(() => {
  console.log('🎉 Done');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

