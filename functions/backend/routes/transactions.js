import express from 'express';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';
const router = express.Router();
import { getDb } from '../firebase.js';
import { 
  createTransaction, 
  updateTransaction, 
  deleteTransaction, 
  deleteTransactionWithDocuments,  // Import the document-aware deletion function
  listTransactions,
  getTransaction,
  queryTransactions 
} from '../controllers/transactionsController.js';
import { 
  authenticateUserWithProfile, 
  enforceClientAccess, 
  requirePermission,
  logSecurityEvent 
} from '../middleware/clientAuth.js';
import {
  applyLocalizationHeaders,
  getLocalizationContext,
} from '../utils/localizationContract.js';
import { localizeDomainDisplayText, localizeFixedValue } from '../utils/localizationCatalog.js';
import { resolvePersistedCategoryName } from '../utils/persistedCategoryLocalization.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function buildCategoryFallback(categoryName) {
  const fallbackName = normalizeText(categoryName);
  return { name: fallbackName, name_es: '' };
}

async function buildCategoryLocalizationLookup(clientId) {
  const db = await getDb();
  const snapshot = await db.collection(`clients/${clientId}/categories`).get();

  const byId = new Map();
  const byName = new Map();

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const category = {
      id: doc.id,
      name: normalizeText(data.name),
      name_es: normalizeText(data.name_es),
    };
    byId.set(doc.id, category);
    if (category.name) {
      byName.set(category.name.toLowerCase(), category);
    }
  });

  return { byId, byName };
}

function resolveLocalizedCategoryName(transaction, localizationCtx, categoryLookup) {
  const sourceCategoryName = normalizeText(transaction.categoryName || transaction.category);
  if (!sourceCategoryName) {
    return '';
  }

  if (localizationCtx.resolvedLanguage !== 'ES') {
    return sourceCategoryName;
  }

  const fromId = transaction.categoryId ? categoryLookup?.byId?.get(transaction.categoryId) : null;
  const fromName = categoryLookup?.byName?.get(sourceCategoryName.toLowerCase()) || null;
  const persistedSource = fromId || fromName || buildCategoryFallback(sourceCategoryName);

  const persistedLocalized = resolvePersistedCategoryName(persistedSource, localizationCtx.resolvedLanguage);
  if (persistedLocalized) {
    return persistedLocalized;
  }

  return localizeDomainDisplayText(sourceCategoryName, localizationCtx.resolvedLanguage);
}

function normalizeAllocationsWithNotesCompanions(allocations) {
  if (!Array.isArray(allocations)) {
    return allocations;
  }

  return allocations.map((allocation) => {
    if (!allocation || typeof allocation !== 'object') {
      return allocation;
    }

    return {
      ...allocation,
      notes: normalizeText(allocation.notes),
      notes_es: normalizeText(allocation.notes_es),
    };
  });
}

function resolveLocalizedNotesValue(notes, notesEs, language) {
  if (language === 'ES') {
    return notesEs || notes;
  }

  return notes;
}

function withTransactionCompanions(transaction, localizationCtx, categoryLookup) {
  const language = localizationCtx.resolvedLanguage;
  const descriptionSource = normalizeText(transaction.description);
  const notesSource = normalizeText(transaction.notes);
  const notesEsSource = normalizeText(transaction.notes_es);
  const vendorSource = normalizeText(transaction.vendorName);
  const paymentMethodSource = normalizeText(transaction.paymentMethod);
  const accountNameSource = normalizeText(transaction.accountName);
  const localizedCategoryName = resolveLocalizedCategoryName(transaction, localizationCtx, categoryLookup);
  const allocationsWithNotesCompanions = normalizeAllocationsWithNotesCompanions(transaction.allocations);
  const localizedNotes = resolveLocalizedNotesValue(notesSource, notesEsSource, language);

  return {
    ...transaction,
    notes: notesSource,
    notes_es: notesEsSource,
    allocations: allocationsWithNotesCompanions,
    typeLocalized: localizeFixedValue('type', transaction.type, language),
    typeDisplayLocalized: localizeFixedValue('type', transaction.type, language),
    categoryNameLocalized: localizedCategoryName,
    categoryLocalized: localizedCategoryName,
    descriptionLocalized: localizeDomainDisplayText(descriptionSource, language),
    notesLocalized: localizedNotes,
    vendorNameLocalized: localizeDomainDisplayText(vendorSource, language),
    paymentMethodLocalized: localizeDomainDisplayText(paymentMethodSource, language),
    accountNameLocalized: localizeDomainDisplayText(accountNameSource, language),
  };
}

const NON_FILTER_QUERY_PARAMS = new Set(['lang', 'language']);

function hasTransactionFilters(query = {}) {
  return Object.keys(query).some((key) => !NON_FILTER_QUERY_PARAMS.has(String(key || '').trim().toLowerCase()));
}

async function localizeTransactionRecords(clientId, transactions, localizationCtx) {
  if (!localizationCtx.flags.companionsOn || transactions.length === 0) {
    return transactions;
  }

  let categoryLookup = null;
  if (localizationCtx.resolvedLanguage === 'ES') {
    categoryLookup = await buildCategoryLocalizationLookup(clientId);
  }

  let localizedTransactions = transactions.map((transaction) =>
    withTransactionCompanions(transaction, localizationCtx, categoryLookup)
  );

  const partialTranslation = false;
  return { localizedTransactions, partialTranslation };
}

// Apply security middleware to all transaction routes
router.use(authenticateUserWithProfile);
router.use(enforceClientAccess);

/**
 * Get all transactions or query with filters
 * GET /api/clients/:clientId/transactions
 * Requires: authentication, client access, transaction view permission
 */
router.get('/', 
  requirePermission('transactions.view'),
  logSecurityEvent('TRANSACTION_LIST'),
  async (req, res) => {
  try {
    const clientId = req.authorizedClientId;
    const localizationCtx = await getLocalizationContext(req, 'transactions.list');
    applyLocalizationHeaders(res, localizationCtx);
    
    logDebug('🔍 Transaction route - GET / (List/Query):', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole,
      queryParams: req.query
    });
    
    // Check if we have query parameters
    const hasFilters = hasTransactionFilters(req.query);
    let transactions = hasFilters
      ? await queryTransactions(clientId, req.query)
      : await listTransactions(clientId);

    const localizedResult = await localizeTransactionRecords(clientId, transactions, localizationCtx);
    if (Array.isArray(localizedResult)) {
      transactions = localizedResult;
    } else {
      transactions = localizedResult.localizedTransactions;
      if (localizationCtx.flags.companionsOn) {
        res.setHeader('X-SAMS-Localization-Partial', localizedResult.partialTranslation ? 'true' : 'false');
      }
    }

    res.json(transactions);
  } catch (error) {
    logError('Error listing transactions:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Create a new transaction
 * POST /api/clients/:clientId/transactions
 * Requires: authentication, client access, transaction create permission
 */
router.post('/', 
  requirePermission('transactions.create'),
  logSecurityEvent('TRANSACTION_CREATE'),
  async (req, res) => {
  try {
    // Client ID is now guaranteed to be authorized via enforceClientAccess middleware
    const clientId = req.authorizedClientId;
    
    logDebug('🔍 Transaction route - POST / (Secured):', { 
      user: req.user.email,
      clientId: clientId,
      userRole: req.clientRole,
      'req.body keys': Object.keys(req.body)
    });
    
    const txnId = await createTransaction(clientId, req.body);
    
    if (txnId) {
      // Fetch the created transaction to get properly formatted dates
      const createdTransaction = await getTransaction(clientId, txnId);
      
      // Return the full transaction data for the frontend confirmation
      const responseData = {
        id: txnId,
        success: true,
        transaction: createdTransaction || {
          id: txnId,
          ...req.body,
          clientId: clientId
        }
      };
      logDebug('📤 Returning transaction response with formatted dates');
      res.status(201).json(responseData);
    } else {
      res.status(400).json({ error: 'Failed to create transaction' });
    }
  } catch (error) {
    logError('Error in transaction route:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Get a transaction by ID
 * GET /api/clients/:clientId/transactions/:txnId
 * Requires: authentication, client access, transaction view permission
 */
router.get('/:txnId', 
  requirePermission('transactions.view'),
  logSecurityEvent('TRANSACTION_VIEW'),
  async (req, res) => {
  try {
    const txnId = req.params.txnId;
    const clientId = req.authorizedClientId;
    const localizationCtx = await getLocalizationContext(req, 'transactions.detail');
    applyLocalizationHeaders(res, localizationCtx);
    
    logDebug('🔍 Transaction route - GET /:txnId (Secured):', { 
      user: req.user.email,
      clientId,
      txnId,
      userRole: req.clientRole
    });
    
    const transaction = await getTransaction(clientId, txnId);
    
    if (transaction) {
      const localizedResult = await localizeTransactionRecords(clientId, [transaction], localizationCtx);
      const localizedTransaction = Array.isArray(localizedResult)
        ? localizedResult[0]
        : localizedResult.localizedTransactions[0];
      if (!Array.isArray(localizedResult) && localizationCtx.flags.companionsOn) {
        res.setHeader('X-SAMS-Localization-Partial', localizedResult.partialTranslation ? 'true' : 'false');
      }
      res.json(localizedTransaction);
    } else {
      logDebug(`Transaction not found: clientId=${clientId}, txnId=${txnId}`);
      res.status(404).json({ error: 'Transaction not found' });
    }
  } catch (error) {
    logError('Error getting transaction:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Update a transaction
 * PUT /api/clients/:clientId/transactions/:txnId
 * Requires: authentication, client access, transaction edit permission
 */
router.put('/:txnId', 
  requirePermission('transactions.edit'),
  logSecurityEvent('TRANSACTION_UPDATE'),
  async (req, res) => {
  try {
    const txnId = req.params.txnId;
    const clientId = req.authorizedClientId;
    
    logDebug('🔍 Transaction route - PUT /:txnId (Update):', { 
      user: req.user.email,
      clientId,
      txnId,
      userRole: req.clientRole,
      updateData: req.body
    });
    
    const success = await updateTransaction(clientId, txnId, req.body);
    
    if (success) {
      // Fetch the updated transaction to get properly formatted dates
      const updatedTransaction = await getTransaction(clientId, txnId);
      
      res.json({ 
        success: true,
        message: 'Transaction updated successfully',
        transaction: updatedTransaction
      });
    } else {
      res.status(400).json({ error: 'Failed to update transaction' });
    }
  } catch (error) {
    logError('Error updating transaction:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * Delete a transaction (with HOA Dues cleanup if applicable)
 * DELETE /api/clients/:clientId/transactions/:txnId
 * Requires: authentication, client access, transaction delete permission
 */
router.delete('/:txnId', 
  requirePermission('transactions.delete'),
  logSecurityEvent('TRANSACTION_DELETE'),
  async (req, res) => {
  try {
    const txnId = req.params.txnId;
    const clientId = req.authorizedClientId;
    
    logDebug(`🚀 [ROUTE] Delete transaction request received (Secured):`, {
      user: req.user.email,
      txnId,
      clientId,
      userRole: req.clientRole,
      url: req.originalUrl
    });
    
    logDebug(`🎯 [ROUTE] Calling deleteTransactionWithDocuments for cascading cleanup: clientId=${clientId}, txnId=${txnId}`);
    const success = await deleteTransactionWithDocuments(clientId, txnId);
    
    if (success) {
      logDebug(`✅ [ROUTE] Successfully deleted transaction ${txnId}`);
      res.json({ 
        success: true,
        message: 'Transaction deleted successfully' 
      });
    } else {
      logDebug(`❌ [ROUTE] Failed to delete transaction ${txnId}`);
      res.status(400).json({ 
        error: 'Failed to delete transaction' 
      });
    }
  } catch (error) {
    logError('❌ [ROUTE] Error in delete transaction route:', error);
    res.status(500).json({ 
      error: error.message || 'Server error during transaction deletion' 
    });
  }
});

export default router;