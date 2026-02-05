import express from 'express';
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';
const router = express.Router();
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
    
    logDebug('🔍 Transaction route - GET / (List/Query):', { 
      user: req.user.email,
      clientId,
      userRole: req.clientRole,
      queryParams: req.query
    });
    
    // Check if we have query parameters
    if (Object.keys(req.query).length > 0) {
      // Use queryTransactions for filtered results
      const transactions = await queryTransactions(clientId, req.query);
      res.json(transactions);
    } else {
      // Use listTransactions for all transactions
      const transactions = await listTransactions(clientId);
      res.json(transactions);
    }
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
    
    logDebug('🔍 Transaction route - GET /:txnId (Secured):', { 
      user: req.user.email,
      clientId,
      txnId,
      userRole: req.clientRole
    });
    
    const transaction = await getTransaction(clientId, txnId);
    
    if (transaction) {
      res.json(transaction);
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