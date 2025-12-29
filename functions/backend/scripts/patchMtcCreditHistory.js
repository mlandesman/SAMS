/**
 * Patch MTC credit history burn-down entries (additive, non-destructive).
 *
 * Assumes starting_balance already set correctly in creditBalances.
 * Removes prior burn-down entries added by this script (notes containing "Apply Jan")
 * and adds corrected credit_used entries for 2025 prepay consumption.
 *
 * Usage:
 *   NODE_ENV=production node functions/backend/scripts/patchMtcCreditHistory.js
 */

import { getDb } from '../firebase.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const PATCH_UNITS = {
  '1A': {
    creditUsed: 13800, // 3 months * 4600
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Mar 2025 HOA prepay (3 x 4600)'
  },
  '1C': {
    creditUsed: 26400, // 6 months * 4400
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Jun 2025 HOA prepay (6 x 4400)'
  },
  '2C': {
    creditUsed: 13188, // use prepay amount to end at 0
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Mar 2025 prepay to dues'
  },
  'PH1A': {
    creditUsed: 34800, // 6 months * 5800
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Jun 2025 HOA prepay (6 x 5800)'
  },
  'PH2B': {
    creditUsed: 17400, // 3 months * 5800
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Mar 2025 HOA prepay (3 x 5800)'
  },
  'PH4D': {
    creditUsed: 34800, // 6 months * 5800
    date: '2025-01-02T00:00:00-05:00',
    notes: 'Apply Jan-Jun 2025 prepay (6 x 5800)'
  }
};

// Final 12/31/2025 target balances from Sheets (MXN)
// We'll add a single adjustment entry per unit to hit these balances.
const TARGET_ENDING_BALANCES = {
  '1A': 6239,
  '1B': 1286,
  '1C': 600,
  '2A': 294,
  '2B': 0,
  '2C': 0,
  'PH1A': 0,
  'PH2B': 910,
  'PH3C': 0,
  'PH4D': 14400
};

function pesosToCentavos(p) {
  if (!p || isNaN(p)) return 0;
  return Math.round(Number(p) * 100);
}

async function patch() {
  console.log('🔄 Patching MTC credit history burn-down (additive, preserving other history)...');
  const db = await getDb();
  const ref = db.doc('clients/MTC/units/creditBalances');
  const snap = await ref.get();
  if (!snap.exists) throw new Error('creditBalances doc not found for MTC');
  const data = snap.data() || {};

  for (const [unitId, cfg] of Object.entries(PATCH_UNITS)) {
    const unit = data[unitId] || {};
    const history = Array.isArray(unit.history) ? [...unit.history] : [];

    // Remove prior burn-down entries we added (notes containing "Apply Jan")
    const filtered = history.filter(h => !(h.type === 'credit_used' && typeof h.notes === 'string' && h.notes.includes('Apply Jan')));

    // Add corrected burn-down entry
    filtered.push({
      id: `credit_used_${unitId}_${Date.now()}`,
      type: 'credit_used',
      amount: -pesosToCentavos(cfg.creditUsed),
      timestamp: cfg.date,
      transactionId: null,
      notes: cfg.notes,
      description: cfg.notes
    });

    // Sort by timestamp for cleanliness
    filtered.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });

    const newBalance = getCreditBalance({ history: filtered });

    data[unitId] = {
      ...unit,
      history: filtered,
      creditBalance: newBalance,
      lastChange: {
        historyIndex: filtered.length - 1,
        year: '2025',
        timestamp: new Date().toISOString()
      }
    };

    console.log(`  ✅ ${unitId}: credit_used ${cfg.creditUsed} MXN applied; new balance ${newBalance / 100} MXN`);
  }

  // Apply final adjustments to match Sheets ending balances (12/31/2025)
  const adjDate = '2025-12-31T00:00:00-05:00';
  for (const [unitId, targetPesos] of Object.entries(TARGET_ENDING_BALANCES)) {
    const unit = data[unitId];
    if (!unit) continue;
    const history = Array.isArray(unit.history) ? [...unit.history] : [];
    const currentBalance = typeof unit.creditBalance === 'number' ? unit.creditBalance : getCreditBalance({ history });
    const target = pesosToCentavos(targetPesos);
    const delta = target - currentBalance;
    if (delta === 0) continue;

    history.push({
      id: `adjust_${unitId}_${Date.now()}`,
      type: delta > 0 ? 'credit_added' : 'credit_used',
      amount: delta,
      timestamp: adjDate,
      transactionId: null,
      notes: 'Align to Sheets ending balance 2025-12-31',
      description: 'Align to Sheets ending balance 2025-12-31'
    });

    // Sort for cleanliness
    history.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });

    const newBalance = getCreditBalance({ history });
    data[unitId] = {
      ...unit,
      history,
      creditBalance: newBalance,
      lastChange: {
        historyIndex: history.length - 1,
        year: '2025',
        timestamp: new Date().toISOString()
      }
    };
    console.log(`  🔧 ${unitId}: adjusted by ${delta / 100} MXN to target ${targetPesos}, new balance ${newBalance / 100} MXN`);
  }

  await ref.set(data);
  console.log('\n✅ Patch complete. Review statements for impacted units.');
}

patch().catch(err => {
  console.error('❌ Patch failed:', err);
  process.exit(1);
});

