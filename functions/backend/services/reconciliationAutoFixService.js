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
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { updateTransaction } from '../controllers/transactionsController.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { validateDocument } from '../utils/validateDocument.js';

const GAP_CENTAVOS = 580;
const COMMISSION_CENTAVOS = 500;
const IVA_CENTAVOS = 80;

const BANK_FEE_CATEGORY_NAMES = {
  commission: 'Bank: Transfer Fees',
  iva: 'Bank: IVA'
};

/** Rounding variance line — match a client category name when possible */
const ROUNDING_ADJUSTMENT_CATEGORY_NAME = 'Bank: Adjustments';

/**
 * Same explanation on fee/adjustment allocation rows and on the supplemental audit log after
 * `updateTransaction` (the CRUD path already writes a generic "Updated transaction record" entry).
 */
const RECON_AUTOFIX_AUDIT_EXPLANATION =
  'Reconciliation auto-fix: SAMS cash aligned to bank (SPEI fee or rounding); account balance adjusted via standard transaction update.';

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
      notes: `Bank transfer fee. ${RECON_AUTOFIX_AUDIT_EXPLANATION}`
    },
    {
      categoryId: ivaCat,
      categoryName: BANK_FEE_CATEGORY_NAMES.iva,
      amount: -IVA_CENTAVOS,
      notes: `Bank transfer IVA. ${RECON_AUTOFIX_AUDIT_EXPLANATION}`
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
    notes: appendReconNote(txn.notes, 'reconciliation SPEI auto-fix'),
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
        notes: `Centavo rounding vs bank. ${RECON_AUTOFIX_AUDIT_EXPLANATION}`
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
    notes: `Centavo rounding vs bank. ${RECON_AUTOFIX_AUDIT_EXPLANATION}`
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
 * Convert an internal auto-fix patch (amounts in integer centavos, Firestore `updated`) into the
 * payload shape expected by `updateTransaction` (amounts in pesos; no `updated` — CRUD sets it).
 */
function autoFixPatchToUpdateBody(patch) {
  const { updated: _skipUpdated, ...rest } = patch;
  const body = { ...rest };
  if (body.amount !== undefined) {
    body.amount = centavosToPesos(Math.round(Number(body.amount)));
  }
  if (Array.isArray(body.allocations)) {
    body.allocations = body.allocations.map((line) => {
      const amt = line.amount;
      const converted =
        typeof amt === 'number' && amt !== 0 ? centavosToPesos(Math.round(amt)) : amt;
      return { ...line, amount: converted };
    });
  }
  return body;
}

/**
 * Apply updates via `updateTransaction` so validation, account balance, and audit logging stay
 * on the single CRUD path (no duplicate Firestore/balance logic).
 *
 * @returns {{ ok: boolean, error?: string }}
 */
export async function applyTransactionAutoFix(clientId, transactionId, patch) {
  try {
    const body = autoFixPatchToUpdateBody(patch);
    const validation = validateDocument('transactions', body, 'update');
    if (!validation.isValid) {
      const detail = (validation.errors || []).join('; ') || 'invalid auto-fix payload';
      return { ok: false, error: `Validation: ${detail}` };
    }
    const ok = await updateTransaction(clientId, transactionId, body);
    if (!ok) {
      return {
        ok: false,
        error: 'Transaction update failed (not found, Firestore error, or other server error)'
      };
    }

    const auditOk = await writeAuditLog({
      module: 'transactions',
      action: 'update',
      parentPath: `clients/${clientId}/transactions/${transactionId}`,
      docId: transactionId,
      friendlyName: patch.categoryName || body.categoryName || 'Transaction',
      notes: RECON_AUTOFIX_AUDIT_EXPLANATION
    });
    if (!auditOk) {
      console.error('❌ Failed to write reconciliation auto-fix audit log.');
    }

    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes('Cannot modify a cleared/reconciled transaction')) {
      return { ok: false, error: 'Transaction already cleared' };
    }
    return { ok: false, error: msg };
  }
}
