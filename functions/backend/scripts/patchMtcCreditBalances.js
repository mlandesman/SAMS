/**
 * Patch MTC creditBalances with corrected 2024 prepayments.
 *
 * For each listed unit, add (or replace) a starting_balance entry dated 2024-12-31
 * with the provided MXN amount (converted to centavos). If a starting_balance
 * already exists, the amounts are summed.
 *
 * Usage:
 *   NODE_ENV=production node functions/backend/scripts/patchMtcCreditBalances.js
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

const UNIT_START_AMOUNTS = {
  '1A': 15000,   // Jan-Mar 2025; HSBC
  '1C': 26400,   // Jan-Jun 2025; DolarApp
  '2C': 13188,   // Jan-Mar 2025; Wise
  'PH1A': 36000, // Jan-Jun 2025; DolarApp
  'PH2B': 16900, // Prepay Jan-Mar 2025 with rate increase
  'PH4D': 34800  // Jan-Jun 2025; DolarApp
};

const START_DATE = new Date(Date.UTC(2024, 11, 31, 0, 0, 0)); // 2024-12-31 UTC

function pesosToCentavos(p) {
  if (!p || isNaN(p)) return 0;
  return Math.round(Number(p) * 100);
}

async function patchMtcCredits() {
  console.log('🔄 Patching MTC creditBalances starting balances...');
  const db = await getDb();
  const ref = db.doc('clients/MTC/units/creditBalances');
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error('creditBalances document not found for MTC');
  }
  const data = snap.data() || {};

  let updated = 0;
  for (const [unitId, pesos] of Object.entries(UNIT_START_AMOUNTS)) {
    const unit = data[unitId] || {};
    const history = Array.isArray(unit.history) ? [...unit.history] : [];

    // Sum existing starting_balance amounts, if any
    const existingStart = history
      .filter(h => h.type === 'starting_balance' && typeof h.amount === 'number')
      .reduce((sum, h) => sum + h.amount, 0);

    const newAmount = pesosToCentavos(pesos);
    const combinedAmount = existingStart + newAmount;

    // Remove prior starting_balance entries; replace with one combined entry
    const filteredHistory = history.filter(h => h.type !== 'starting_balance');
    filteredHistory.unshift({
      id: `starting_balance_${unitId}_${Date.now()}`,
      type: 'starting_balance',
      amount: combinedAmount,
      timestamp: admin.firestore.Timestamp.fromDate(START_DATE),
      transactionId: null,
      description: 'Starting credit balance from prior period',
      notes: `Patched prepayment ${pesos} MXN on 2024-12-31`
    });

    data[unitId] = {
      ...unit,
      history: filteredHistory,
      creditBalance: combinedAmount,
      lastChange: {
        historyIndex: filteredHistory.length - 1,
        year: '2024',
        timestamp: new Date().toISOString()
      }
    };

    console.log(`  ✅ ${unitId}: set starting_balance to ${combinedAmount / 100} MXN (was ${existingStart / 100} MXN)`);
    updated++;
  }

  await ref.set(data);
  console.log(`\n✅ Updated ${updated} units in clients/MTC/units/creditBalances`);
}

patchMtcCredits().catch(err => {
  console.error('❌ Patch failed:', err);
  process.exit(1);
});

