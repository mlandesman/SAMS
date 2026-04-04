/**
 * Apply SAMS transaction updates after reconciliation matcher finds rounding / SPEI-fee patterns.
 *
 * SPEI (580¢): mirrors UnifiedExpenseEntry "Add Bank Fees" — expense becomes more negative by 580¢;
 * allocations split principal (unchanged vendor) vs Bank: Transfer Fees (500¢) + Bank: IVA (80¢).
 * per Michael: 580¢ gap may apply to any Scotia client; false positives are negligible.
 *
 * Rounding (1–2¢): preserves original principal as first allocation line; adds a small Bank: Adjustments
 * line so receipts/reports still reflect the prior main amount (audit trail).
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

const GAP_CENTAVOS = 580;
const COMMISSION_CENTAVOS = 500;
const IVA_CENTAVOS = 80;

const BANK_FEE_CATEGORY_NAMES = {
  commission: 'Bank: Transfer Fees',
  iva: 'Bank: IVA'
};

/** Rounding variance line — match a client category name when possible */
const ROUNDING_ADJUSTMENT_CATEGORY_NAME = 'Bank: Adjustments';

async function resolveCategoryId(clientId, categoryName) {
  if (!categoryName) return null;
  const db = await getDb();
  const snap = await db
    .collection(`clients/${clientId}/categories`)
    .where('name', '==', categoryName)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  return null;
}

/**
 * @param {object} txn — Firestore transaction doc
 * @param {number} bankCentavos — bank normalized row amount (positive)
 * @returns {object} fields to merge into transaction doc
 */
export async function buildSpeiFeeFixUpdate(clientId, txn, bankCentavos) {
  if (txn.type !== 'expense' || (txn.amount || 0) >= 0) {
    throw new Error('SPEI auto-fix applies to expense (negative amount) only');
  }
  const principalAbs = Math.abs(Math.round(txn.amount || 0));
  const bankMag = Math.abs(Math.round(bankCentavos || 0));
  if (principalAbs + GAP_CENTAVOS !== bankMag) {
    throw new Error(
      `SPEI fix: bank amount must equal |SAMS| + ${GAP_CENTAVOS}¢ (bank=${bankMag}¢ |SAMS|=${principalAbs}¢)`
    );
  }

  if (txn.allocations?.length > 0) {
    throw new Error(
      'SPEI auto-fix skipped: transaction already has allocations — edit manually in workbench'
    );
  }

  const newAmountCentavos = Math.round(txn.amount) - GAP_CENTAVOS;
  const mainCategoryId = txn.categoryId || null;
  const mainCategoryName = txn.categoryName || 'Expense';

  const commissionCat = await resolveCategoryId(clientId, BANK_FEE_CATEGORY_NAMES.commission);
  const ivaCat = await resolveCategoryId(clientId, BANK_FEE_CATEGORY_NAMES.iva);

  const allocations = [
    {
      categoryId: mainCategoryId,
      categoryName: mainCategoryName,
      amount: -principalAbs,
      notes: 'Principal (pre-fee)'
    },
    {
      categoryId: commissionCat,
      categoryName: BANK_FEE_CATEGORY_NAMES.commission,
      amount: -COMMISSION_CENTAVOS,
      notes: 'Bank transfer fee (reconciliation auto-fix)'
    },
    {
      categoryId: ivaCat,
      categoryName: BANK_FEE_CATEGORY_NAMES.iva,
      amount: -IVA_CENTAVOS,
      notes: 'Bank transfer IVA (reconciliation auto-fix)'
    }
  ];

  const sumAlloc = allocations.reduce((s, a) => s + a.amount, 0);
  if (sumAlloc !== newAmountCentavos) {
    throw new Error(`SPEI fix allocation sum ${sumAlloc} !== new amount ${newAmountCentavos}`);
  }

  return {
    amount: newAmountCentavos,
    categoryId: '-split-',
    categoryName: '-Split-',
    allocations,
    notes: appendReconNote(
      txn.notes,
      '(includes transfer fees — reconciliation SPEI auto-fix)'
    ),
    updated: admin.firestore.Timestamp.now()
  };
}

/**
 * Rounding: keep original |amount| on first allocation line; add adjustment line for delta only.
 */
export async function buildRoundingFixUpdate(clientId, txn, bankCentavos, deltaCentavos) {
  const absOld = Math.abs(Math.round(txn.amount || 0));
  const d = Math.round(deltaCentavos);
  if (Math.abs(d) < 1 || Math.abs(d) > 2) {
    throw new Error('Rounding fix: delta must be 1–2 centavos');
  }
  if (txn.type !== 'expense' || (txn.amount || 0) >= 0) {
    throw new Error('Rounding auto-fix applies to expense only in this implementation');
  }
  if (absOld + d !== bankCentavos) {
    throw new Error('Rounding fix: bank vs |SAMS| mismatch');
  }

  const newAmountCentavos = -bankCentavos;
  const adjCat = await resolveCategoryId(clientId, ROUNDING_ADJUSTMENT_CATEGORY_NAME);

  if (!txn.allocations?.length) {
    const mainCategoryId = txn.categoryId || null;
    const mainCategoryName = txn.categoryName || 'Expense';
    const allocations = [
      {
        categoryId: mainCategoryId,
        categoryName: mainCategoryName,
        amount: -absOld,
        notes: 'Recorded amount (reconciliation preserves for audit)'
      },
      {
        categoryId: adjCat,
        categoryName: ROUNDING_ADJUSTMENT_CATEGORY_NAME,
        amount: -d,
        notes: 'Centavo rounding vs bank (reconciliation auto-fix)'
      }
    ];
    const sumAlloc = allocations.reduce((s, a) => s + a.amount, 0);
    if (sumAlloc !== newAmountCentavos) {
      throw new Error(`Rounding allocation sum ${sumAlloc} !== ${newAmountCentavos}`);
    }
    return {
      amount: newAmountCentavos,
      categoryId: '-split-',
      categoryName: '-Split-',
      allocations,
      notes: appendReconNote(txn.notes, '(rounding adjustment via reconciliation)'),
      updated: admin.firestore.Timestamp.now()
    };
  }

  const existing = txn.allocations.map((a) => ({
    categoryId: a.categoryId || null,
    categoryName: a.categoryName || '',
    amount: Math.round(a.amount || 0),
    notes: a.notes || ''
  }));
  const prevSum = existing.reduce((s, a) => s + a.amount, 0);
  if (Math.abs(prevSum - Math.round(txn.amount || 0)) > 2) {
    throw new Error(
      'Rounding fix: existing allocations do not sum to transaction amount — edit manually'
    );
  }
  existing.push({
    categoryId: adjCat,
    categoryName: ROUNDING_ADJUSTMENT_CATEGORY_NAME,
    amount: -d,
    notes: 'Centavo rounding vs bank (reconciliation auto-fix)'
  });
  const sumAlloc = existing.reduce((s, a) => s + a.amount, 0);
  if (sumAlloc !== newAmountCentavos) {
    throw new Error('Rounding fix on split: allocation total does not match new bank amount');
  }
  return {
    amount: newAmountCentavos,
    categoryId: '-split-',
    categoryName: '-Split-',
    allocations: existing,
    notes: appendReconNote(txn.notes, '(rounding adjustment via reconciliation)'),
    updated: admin.firestore.Timestamp.now()
  };
}

function appendReconNote(notes, suffix) {
  const base = (notes || '').trim();
  if (base.includes(suffix.trim())) return base || suffix;
  return base ? `${base} ${suffix}` : suffix;
}

/**
 * Apply updates in Firestore (transaction not cleared).
 * @returns {{ ok: boolean, error?: string }}
 */
export async function applyTransactionAutoFix(clientId, transactionId, patch) {
  const db = await getDb();
  const ref = db.doc(`clients/${clientId}/transactions/${transactionId}`);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, error: 'Transaction not found' };
  const data = doc.data();
  if (data.clearedDate) return { ok: false, error: 'Transaction already cleared' };
  await ref.update(patch);
  return { ok: true };
}
