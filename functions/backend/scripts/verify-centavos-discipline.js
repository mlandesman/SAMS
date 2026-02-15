/**
 * Verification Script: Centavos Discipline Check
 *
 * READ-ONLY — Does NOT modify any Firestore data
 *
 * Checks:
 * 1. All transaction amounts are integers
 * 2. All allocation amounts are integers
 * 3. All credit balance amounts are integers
 * 4. Flags any suspiciously small amounts for manual review
 *
 * Usage: node functions/backend/scripts/verify-centavos-discipline.js
 * Run from project root, or: cd functions/backend && node scripts/verify-centavos-discipline.js
 *
 * Connects to Dev Firestore (serviceAccountKey.json). Set NODE_ENV=production to avoid.
 */

import { getDb } from '../firebase.js';

const CLIENTS_TO_CHECK = ['MTC', 'AVII'];

function isInteger(value) {
  if (value == null || value === undefined) return true; // Missing is not a type error
  return Number.isInteger(value);
}

function looksLikePesosNotCentavos(amount, context) {
  // Heuristic: dues/fees under 100 could be pesos mis-stored (e.g. $50 stored as 50 instead of 5000)
  if (amount == null || !Number.isFinite(amount)) return false;
  const abs = Math.abs(amount);
  return abs > 0 && abs < 100 && abs === Math.floor(abs);
}

async function verifyTransactions(db, clientId) {
  const results = { checked: 0, passed: 0, nonInteger: [], smallAmount: [] };
  const snapshot = await db.collection(`clients/${clientId}/transactions`).limit(500).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    results.checked++;

    const amount = data.amount;
    if (amount != null) {
      if (!isInteger(amount)) {
        results.nonInteger.push({ docId: doc.id, field: 'amount', value: amount, type: typeof amount });
      } else if (looksLikePesosNotCentavos(amount, 'transaction')) {
        results.smallAmount.push({ docId: doc.id, field: 'amount', value: amount, context: 'transaction' });
      } else {
        results.passed++;
      }
    } else {
      results.passed++;
    }
  }

  return results;
}

async function verifyHoaDuesAllocations(db, clientId) {
  const results = { checked: 0, passed: 0, nonInteger: [], smallAmount: [] };

  // Structure: clients/{clientId}/units/{unitId}/dues/{year}
  const unitsSnap = await db.collection(`clients/${clientId}/units`).limit(50).get();

  for (const unitDoc of unitsSnap.docs) {
    const unitId = unitDoc.id;
    const duesSnap = await db.collection(`clients/${clientId}/units/${unitId}/dues`).limit(5).get();

    for (const yearDoc of duesSnap.docs) {
      const data = yearDoc.data();
      const year = yearDoc.id;

      if (data.scheduledAmount != null) {
        results.checked++;
        if (!isInteger(data.scheduledAmount)) {
          results.nonInteger.push({ unitId, year, field: 'scheduledAmount', value: data.scheduledAmount, type: typeof data.scheduledAmount });
        } else {
          results.passed++;
        }
      }

      const payments = data.payments || [];
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        const amt = p?.amount ?? p?.basePaid ?? p?.penaltyPaid;
        if (amt != null) {
          results.checked++;
          if (!isInteger(amt)) {
            results.nonInteger.push({ unitId, year, month: i, field: 'payments.amount', value: amt, type: typeof amt });
          } else {
            results.passed++;
          }
        }
      }
    }
  }

  return results;
}

async function verifyCreditBalances(db, clientId) {
  const results = { checked: 0, passed: 0, nonInteger: [], smallAmount: [] };

  // Credit balances: clients/{id}/units/creditBalances doc with per-unit data
  const creditDoc = await db.collection(`clients/${clientId}/units`).doc('creditBalances').get();
  if (!creditDoc.exists) return results;

  const data = creditDoc.data();
  for (const [unitId, unitData] of Object.entries(data)) {
    if (!unitData || typeof unitData !== 'object') continue;

    const balance = unitData.balance ?? unitData.creditBalance;
    if (balance != null) {
      results.checked++;
      if (!isInteger(balance)) {
        results.nonInteger.push({
          unitId,
          field: 'balance',
          value: balance,
          type: typeof balance
        });
      } else if (looksLikePesosNotCentavos(balance, 'credit')) {
        results.smallAmount.push({
          unitId,
          field: 'balance',
          value: balance,
          context: 'credit balance'
        });
      } else {
        results.passed++;
      }
    }

    const history = unitData.history || [];
    for (const entry of history) {
      const amt = entry.amount ?? entry.balance;
      if (amt != null) {
        results.checked++;
        if (!isInteger(amt)) {
          results.nonInteger.push({
            unitId,
            field: 'history.amount',
            value: amt,
            type: typeof amt
          });
        } else {
          results.passed++;
        }
      }
    }
  }

  return results;
}

async function main() {
  console.log('\n🔍 Centavos Discipline Verification (READ-ONLY)\n');
  console.log('='.repeat(60));

  const db = await getDb();
  const projectId = process.env.GCLOUD_PROJECT || 'sandyland-management-system';
  console.log(`\n📌 Project: ${projectId}`);
  if (projectId.includes('prod')) {
    console.log('⚠️  WARNING: Connected to PRODUCTION. Script is read-only but verify project intent.');
  }

  let totalChecked = 0;
  let totalPassed = 0;
  const allNonInteger = [];
  const allSmallAmount = [];

  for (const clientId of CLIENTS_TO_CHECK) {
    console.log(`\n--- ${clientId} ---`);

    const [txResults, hoaResults, creditResults] = await Promise.all([
      verifyTransactions(db, clientId),
      verifyHoaDuesAllocations(db, clientId),
      verifyCreditBalances(db, clientId)
    ]);

    const txTotal = txResults.checked;
    const txPassed = txResults.passed + (txResults.checked - txResults.passed - txResults.nonInteger.length);
    console.log(`  Transactions: ${txResults.checked} checked, ${txResults.nonInteger.length} non-integer amounts`);
    console.log(`  HOA Allocations: ${hoaResults.checked} checked, ${hoaResults.nonInteger.length} non-integer`);
    console.log(`  Credit Balances: ${creditResults.checked} checked, ${creditResults.nonInteger.length} non-integer`);

    totalChecked += txResults.checked + hoaResults.checked + creditResults.checked;
    totalPassed += txResults.passed + hoaResults.passed + creditResults.passed;
    allNonInteger.push(...txResults.nonInteger.map((r) => ({ ...r, clientId })));
    allNonInteger.push(...hoaResults.nonInteger.map((r) => ({ ...r, clientId })));
    allNonInteger.push(...creditResults.nonInteger.map((r) => ({ ...r, clientId })));
    allSmallAmount.push(...txResults.smallAmount.map((r) => ({ ...r, clientId })));
    allSmallAmount.push(...hoaResults.smallAmount.map((r) => ({ ...r, clientId })));
    allSmallAmount.push(...creditResults.smallAmount.map((r) => ({ ...r, clientId })));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary');
  console.log(`  Total checked: ${totalChecked}`);
  console.log(`  Non-integer amounts: ${allNonInteger.length}`);
  console.log(`  Small amounts (possible pesos): ${allSmallAmount.length}`);

  if (allNonInteger.length > 0) {
    console.log('\n❌ Non-integer amounts (should be centavos integers):');
    allNonInteger.slice(0, 10).forEach((r) => console.log(`   ${r.clientId} ${JSON.stringify(r)}`));
    if (allNonInteger.length > 10) console.log(`   ... and ${allNonInteger.length - 10} more`);
  }

  if (allSmallAmount.length > 0) {
    console.log('\n⚠️  Small amounts (< 100, possible pesos stored as cents):');
    allSmallAmount.slice(0, 10).forEach((r) => console.log(`   ${r.clientId} ${JSON.stringify(r)}`));
    if (allSmallAmount.length > 10) console.log(`   ... and ${allSmallAmount.length - 10} more`);
  }

  if (allNonInteger.length === 0 && allSmallAmount.length === 0) {
    console.log('\n✅ All checked amounts are integers. No suspicious small amounts flagged.');
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
