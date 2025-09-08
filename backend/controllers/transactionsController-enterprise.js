/**
 * Enterprise Transaction Controller
 * Enhanced CRUD operations for transactions collection with concurrent support
 * Phase 1.3: Transaction Management Implementation
 */

import { getDbEnterprise, releaseDbConnection, retryOperation } from '../firebase-enterprise.js';
import { processBatchOperations, processTransactionsBatch } from '../utils/batchOperations.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { normalizeDates } from '../utils/timestampUtils.js';
import { EnterpriseDataValidator } from '../utils/dataValidation-enterprise.js';

/**
 * Enhanced input validation for transaction data
 */
function validateTransactionData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Transaction data must be a valid object');
    return { valid: false, errors };
  }

  const requiredFields = ['amount', 'description'];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (data.amount !== undefined) {
    if (typeof data.amount !== 'number' || !isFinite(data.amount)) {
      errors.push('Amount must be a finite number');
    } else if (data.amount === 0) {
      errors.push('Amount cannot be zero');
    }
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || data.description.trim().length === 0) {
      errors.push('Description must be a non-empty string');
    } else if (data.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }
  }

  const maxValue = 999999999.99;
  const minValue = -999999999.99;

  if (data.amount !== undefined && (data.amount > maxValue || data.amount < minValue)) {
    errors.push(`Amount ${data.amount} is outside acceptable range`);
  }

  if (data.currency && typeof data.currency !== 'string') {
    errors.push('Currency must be a string');
  }

  if (data.date && !(data.date instanceof Date) && typeof data.date !== 'string') {
    errors.push('Date must be a Date object or ISO string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Enterprise-grade transaction creation with retry logic
 */
// Performance: Monitor this operation for response time
  async function create(clientId, transactionId, data, context = {}) {
  try {
    // Use enterprise data validation
    const validation = await EnterpriseDataValidator.validateTransaction(data, context);
    if (!validation.valid) {
      console.error('❌ Invalid transaction data:', validation.errors);
      if (validation.securityIssues.length > 0) {
        console.error('🚨 Security issues detected:', validation.securityIssues);
      }
      return {
        success: false,
        errors: validation.errors,
        securityIssues: validation.securityIssues.length > 0 ? 'Security violations detected' : undefined
      };
    }

    if (!clientId || typeof clientId !== 'string') {
      return { success: false, errors: ['Invalid client ID'] };
    }

    if (!transactionId || typeof transactionId !== 'string') {
      return { success: false, errors: ['Invalid transaction ID'] };
    }

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const transactionRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);

        const existingDoc = await transactionRef.get();
        if (existingDoc.exists) {
          return { success: false, errors: ['Transaction already exists'] };
        }

        // Use sanitized data from validation
        const sanitizedData = { ...data, ...validation.sanitized };

        // Normalize dates before storing in Firestore
        const normalizedData = normalizeDates(sanitizedData);

        const transactionDocument = {
          ...normalizedData,
          createdAt: new Date(),
          lastUpdated: new Date(),
          version: 1,

          enterprise: {
            created: true,
            source: 'enterprise-controller',
            timestamp: new Date().toISOString()
          }
        };

        await transactionRef.set(transactionDocument);

        // Attempt audit log (non-blocking)
        try {
          await writeAuditLog({
            module: 'transactions',
            action: 'create',
            parentPath: `clients/${clientId}/transactions/${transactionId}`,
            docId: transactionId,
            friendlyName: `Transaction ${transactionId}`,
            notes: `Created transaction: ${data.description || 'No description'} (enterprise)`,
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-blocking):', auditError.message);
        }

        return { success: true, transactionId, data: transactionDocument };

      } finally {
        releaseDbConnection();
      }
    }, `create-transaction-${clientId}-${transactionId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Enterprise-grade transaction update with versioning
 */
// Performance: Monitor this operation for response time
  async function update(clientId, transactionId, data) {
  try {

    const validation = validateTransactionData(data);
    if (!validation.valid) {
      console.error('❌ Invalid transaction data:', validation.errors);
      return { success: false, errors: validation.errors };
    }

    if (!clientId || !transactionId) {
      return { success: false, errors: ['Invalid client ID or transaction ID'] };
    }

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const transactionRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);

        const currentDoc = await transactionRef.get();
        if (!currentDoc.exists) {
          return { success: false, errors: ['Transaction not found'] };
        }

        const currentData = currentDoc.data();
        const currentVersion = currentData.version || 1;

        // Normalize dates before storing
        const normalizedData = normalizeDates(data);

        const updatedDocument = {
          ...currentData,
          ...normalizedData,
          lastUpdated: new Date(),
          version: currentVersion + 1,

          enterprise: {
            ...currentData.enterprise,
            updated: true,
            lastUpdateSource: 'enterprise-controller',
            lastUpdateTimestamp: new Date().toISOString()
          }
        };

        await transactionRef.set(updatedDocument);

        // Attempt audit log (non-blocking)
        try {
          await writeAuditLog({
            module: 'transactions',
            action: 'update',
            parentPath: `clients/${clientId}/transactions/${transactionId}`,
            docId: transactionId,
            friendlyName: `Transaction ${transactionId}`,
            notes: `Updated transaction from v${currentVersion} to v${currentVersion + 1} (enterprise)`,
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-blocking):', auditError.message);
        }

        return { success: true, transactionId, data: updatedDocument };

      } finally {
        releaseDbConnection();
      }
    }, `update-transaction-${clientId}-${transactionId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Enterprise-grade transaction deletion with soft delete option
 */
// Performance: Monitor this operation for response time
  async function delete(clientId, transactionId, options = {}) {
  try {
    if (!clientId || !transactionId) {
      return { success: false, errors: ['Invalid client ID or transaction ID'] };
    }

    const { softDelete = false } = options;

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const transactionRef = db.doc(`clients/${clientId}/transactions/${transactionId}`);

        const doc = await transactionRef.get();
        if (!doc.exists) {
          return { success: false, errors: ['Transaction not found'] };
        }

        if (softDelete) {
          // Soft delete: mark as deleted but keep in database
          const currentData = doc.data();
          const currentVersion = currentData.version || 1;

          await transactionRef.set({
            ...currentData,
            deleted: true,
            deletedAt: new Date(),
            version: currentVersion + 1,
            enterprise: {
              ...currentData.enterprise,
              softDeleted: true,
              deletedSource: 'enterprise-controller',
              deletedTimestamp: new Date().toISOString()
            }
          });
        } else {
          // Hard delete: remove from database
          await transactionRef.delete();
        }

        // Attempt audit log (non-blocking)
        try {
          await writeAuditLog({
            module: 'transactions',
            action: softDelete ? 'soft_delete' : 'delete',
            parentPath: `clients/${clientId}/transactions/${transactionId}`,
            docId: transactionId,
            friendlyName: `Transaction ${transactionId}`,
            notes: `${softDelete ? 'Soft deleted' : 'Deleted'} transaction (enterprise)`,
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-blocking):', auditError.message);
        }

        return { success: true, transactionId, softDelete };

      } finally {
        releaseDbConnection();
      }
    }, `delete-transaction-${clientId}-${transactionId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Enterprise-grade transaction listing with advanced filtering and pagination
 */
// Performance: Monitor this operation for response time
  async function list(clientId, options = {}) {
  try {
    if (!clientId) {
      return { success: false, errors: ['Invalid client ID'] };
    }

    const {
      limit = 100,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      searchTerm
    } = options;

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        let query = db.collection(`clients/${clientId}/transactions`);

        // Only use one inequality filter at a time to avoid index requirements

        if (dateFrom && !dateTo && !minAmount && !maxAmount) {
          // Single date filter only
          query = query.where('createdAt', '>=', new Date(dateFrom));
        } else if (dateTo && !dateFrom && !minAmount && !maxAmount) {
          // Single date filter only
          query = query.where('createdAt', '<=', new Date(dateTo));
        } else if (minAmount !== undefined && !maxAmount && !dateFrom && !dateTo) {
          // Single amount filter only
          query = query.where('amount', '>=', minAmount);
        } else if (maxAmount !== undefined && !minAmount && !dateFrom && !dateTo) {
          // Single amount filter only
          query = query.where('amount', '<=', maxAmount);
        }
        // For complex filtering, we'll do client-side filtering after retrieval

        query = query.orderBy(sortBy, sortOrder);

        if (offset > 0) {
          query = query.offset(offset);
        }

        if (limit > 0) {
          query = query.limit(limit);
        }

        const snapshot = await query.get();
        let transactions = [];

        snapshot.forEach(doc => {
          const data = doc.data();

          // Apply client-side filtering for complex conditions

          // Filter out soft-deleted items unless requested
          if (!includeDeleted && data.deleted === true) {
            return; // Skip deleted transactions
          }

          // Apply date range filtering (client-side)
          if (dateFrom && data.createdAt && data.createdAt.toDate() < new Date(dateFrom)) {
            return; // Skip - before date range
          }
          if (dateTo && data.createdAt && data.createdAt.toDate() > new Date(dateTo)) {
            return; // Skip - after date range
          }

          // Apply amount range filtering (client-side)
          if (minAmount !== undefined && (data.amount === undefined || data.amount < minAmount)) {
            return; // Skip - below minimum amount
          }
          if (maxAmount !== undefined && (data.amount === undefined || data.amount > maxAmount)) {
            return; // Skip - above maximum amount
          }

          // Apply search term filtering (client-side for flexibility)
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const description = (data.description || '').toLowerCase();
            const category = (data.category || '').toLowerCase();

            if (!description.includes(term) && !category.includes(term)) {
              return; // Skip this transaction
            }
          }

          transactions.push({
            id: doc.id,
            ...data,
          });
        });

        return {
          success: true,
          transactions,
          count: transactions.length,
          hasMore: transactions.length === limit,
          filters: { dateFrom, dateTo, minAmount, maxAmount, searchTerm, includeDeleted }
        };

      } finally {
        releaseDbConnection();
      }
    }, `list-transactions-${clientId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Batch transaction operations for high-throughput scenarios
 */
// Performance: Monitor this operation for response time
  async function create(clientId, transactionDataArray) {
  try {
    if (!clientId || !Array.isArray(transactionDataArray)) {
      return { success: false, errors: ['Invalid client ID or transaction data array'] };
    }

    const validationErrors = [];
    const validatedData = [];

    for (let i = 0; i < transactionDataArray.length; i++) {
      const item = transactionDataArray[i];
      if (!item.transactionId || !item.data) {
        validationErrors.push(`Item ${i}: Missing transactionId or data`);
        continue;
      }

      const validation = validateTransactionData(item.data);
      if (!validation.valid) {
        validationErrors.push(`Item ${i} (${item.transactionId}): ${validation.errors.join(', ')}`);
        continue;
      }

      validatedData.push(item);
    }

    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    console.log(`🔄 Starting batch creation of ${validatedData.length} transactions for client ${clientId}`);

    // Use enterprise batch operations
    const result = await processTransactionsBatch(clientId, validatedData);

    // Transform result to match expected structure
    return {
      success: result.failed === 0,
      summary: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        successRate: result.successRate + '%'
      },
      results: result.results,
      errors: result.failed > 0 ? ['Some operations failed'] : [],

      successful: result.successful,
      failed: result.failed,
      total: result.total,
      successRate: result.successRate + '%'
    };

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Get transaction statistics for monitoring
 */
async function getTransactionStatsEnterprise(clientId, options = {}) {
  try {
    if (!clientId) {
      return { success: false, errors: ['Invalid client ID'] };
    }

    const { includeDeleted = false, dateFrom, dateTo } = options;

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        let query = db.collection(`clients/${clientId}/transactions`);

        // Keep query simple to avoid index requirements
        const snapshot = await query.get();

        let totalAmount = 0;
        let positiveAmount = 0;
        let negativeAmount = 0;
        let count = 0;
        let categories = {};

        snapshot.forEach(doc => {
          const data = doc.data();

          // Apply client-side filtering for statistics

          // Filter out soft-deleted items unless requested
          if (!includeDeleted && data.deleted === true) {
            return; // Skip deleted transactions
          }

          // Apply date range filtering (client-side)
          if (dateFrom && data.createdAt && data.createdAt.toDate() < new Date(dateFrom)) {
            return; // Skip - before date range
          }
          if (dateTo && data.createdAt && data.createdAt.toDate() > new Date(dateTo)) {
            return; // Skip - after date range
          }

          if (data.amount && !isNaN(data.amount)) {
            totalAmount += data.amount;

            if (data.amount > 0) {
              positiveAmount += data.amount;
            } else {
              negativeAmount += data.amount;
            }

            // Track categories
            const category = data.category || 'Uncategorized';
            categories[category] = (categories[category] || 0) + 1;
          }
          count++;
        });

        return {
          success: true,
          stats: {
            count,
            totalAmount: Math.round(totalAmount * 100) / 100,
            positiveAmount: Math.round(positiveAmount * 100) / 100,
            negativeAmount: Math.round(negativeAmount * 100) / 100,
            netAmount: Math.round((positiveAmount + negativeAmount) * 100) / 100,
            averageAmount: count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0,
            categories: Object.keys(categories).length,
            categoryBreakdown: categories
          },
          filters: { dateFrom, dateTo, includeDeleted }
        };

      } finally {
        releaseDbConnection();
      }
    }, `transaction-stats-${clientId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

// Export enterprise functions
export {
  createTransactionEnterprise,
  updateTransactionEnterprise,
  deleteTransactionEnterprise,
  listTransactionsEnterprise,
  createTransactionsBatchEnterprise,
  getTransactionStatsEnterprise,
  validateTransactionData
};

// Maintain backward compatibility with original names
export {
  createTransactionEnterprise as createTransaction,
  updateTransactionEnterprise as updateTransaction,
  deleteTransactionEnterprise as deleteTransaction,
  listTransactionsEnterprise as listTransactions
};