/**
 * Enterprise Balance Controller
 * Enhanced CRUD operations for balances collection with concurrent support
 * Phase 1.2: Batch Operation Resilience Implementation
 */

import { getDbEnterprise, releaseDbConnection, retryOperation } from '../firebase-enterprise.js';
import { processBatchOperations, createBalancesBatch } from '../utils/batchOperations.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { normalizeDates } from '../utils/timestampUtils.js';
import { EnterpriseDataValidator } from '../utils/dataValidation-enterprise.js';

/**
 * Enhanced input validation for balance data
 */
function validateBalanceData(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Balance data must be a valid object');
    return { valid: false, errors };
  }

  const requiredFields = ['totalIncome', 'totalExpenses', 'netBalance'];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== 'number' || !isFinite(data[field])) {
      errors.push(`Field ${field} must be a finite number`);
    }
  }

  const maxValue = 999999999.99;
  const minValue = -999999999.99;

  for (const field of requiredFields) {
    if (data[field] !== undefined && (data[field] > maxValue || data[field] < minValue)) {
      errors.push(`Field ${field} value ${data[field]} is outside acceptable range`);
    }
  }

  if (data.currency && typeof data.currency !== 'string') {
    errors.push('Currency must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Enterprise-grade balance creation with retry logic
 */
// Performance: Monitor this operation for response time
  async function create(clientId, monthId, data, context = {}) {
  try {
    // Use enterprise data validation
    const validation = await EnterpriseDataValidator.validateBalance(data, context);
    if (!validation.valid) {
      console.error('❌ Invalid balance data:', validation.errors);
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

    if (!monthId || typeof monthId !== 'string') {
      return { success: false, errors: ['Invalid month ID'] };
    }

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const balanceRef = db.doc(`clients/${clientId}/balances/${monthId}`);

        // Use sanitized data from validation
        const sanitizedData = { ...data, ...validation.sanitized };

        // Normalize dates before storing in Firestore
        const normalizedData = normalizeDates(sanitizedData);

        const balanceDocument = {
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

        await balanceRef.set(balanceDocument);

        // Attempt audit log (non-blocking)
        try {
          await writeAuditLog({
            module: 'balances',
            action: 'create',
            parentPath: `clients/${clientId}/balances/${monthId}`,
            docId: monthId,
            friendlyName: `Balance ${monthId}`,
            notes: 'Created monthly balance record (enterprise)',
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-blocking):', auditError.message);
        }

        return { success: true, monthId, data: balanceDocument };

      } finally {
        releaseDbConnection();
      }
    }, `create-balance-${clientId}-${monthId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Enterprise-grade balance deletion with retry logic
 */
// Performance: Monitor this operation for response time
  async function delete(clientId, monthId) {
  try {
    if (!clientId || !monthId) {
      return { success: false, errors: ['Invalid client ID or month ID'] };
    }

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const balanceRef = db.doc(`clients/${clientId}/balances/${monthId}`);

        const doc = await balanceRef.get();
        if (!doc.exists) {
          return { success: false, errors: ['Balance not found'] };
        }

        await balanceRef.delete();

        // Attempt audit log (non-blocking)
        try {
          await writeAuditLog({
            module: 'balances',
            action: 'delete',
            parentPath: `clients/${clientId}/balances/${monthId}`,
            docId: monthId,
            friendlyName: `Balance ${monthId}`,
            notes: 'Deleted monthly balance record (enterprise)',
          });
        } catch (auditError) {
          console.warn('⚠️ Audit log failed (non-blocking):', auditError.message);
        }

        return { success: true, monthId };

      } finally {
        releaseDbConnection();
      }
    }, `delete-balance-${clientId}-${monthId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Enterprise-grade balance listing with pagination and performance optimization
 */
// Performance: Monitor this operation for response time
  async function list(clientId, options = {}) {
  try {
    if (!clientId) {
      return { success: false, errors: ['Invalid client ID'] };
    }

    const { limit = 100, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        let query = db.collection(`clients/${clientId}/balances`);

        query = query.orderBy(sortBy, sortOrder);

        if (offset > 0) {
          query = query.offset(offset);
        }

        if (limit > 0) {
          query = query.limit(limit);
        }

        // Performance: Consider using Firestore compound queries instead of in-memory filtering
    const snapshot = await query.get();
        const balances = [];

        snapshot.forEach(doc => {
          balances.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        return {
          success: true,
          balances,
          count: balances.length,
          hasMore: balances.length === limit
        };

      } finally {
        releaseDbConnection();
      }
    }, `list-balances-${clientId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Batch balance operations for high-throughput scenarios
 */
// Performance: Monitor this operation for response time
  async function create(clientId, balanceDataArray) {
  try {
    if (!clientId || !Array.isArray(balanceDataArray)) {
      return { success: false, errors: ['Invalid client ID or balance data array'] };
    }

    const validationErrors = [];
    const validatedData = [];

    for (let i = 0; i < balanceDataArray.length; i++) {
      const item = balanceDataArray[i];
      if (!item.monthId || !item.data) {
        validationErrors.push(`Item ${i}: Missing monthId or data`);
        continue;
      }

      const validation = validateBalanceData(item.data);
      if (!validation.valid) {
        validationErrors.push(`Item ${i} (${item.monthId}): ${validation.errors.join(', ')}`);
        continue;
      }

      validatedData.push(item);
    }

    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    console.log(`🔄 Starting batch creation of ${validatedData.length} balances for client ${clientId}`);

    // Use enterprise batch operations
    const result = await createBalancesBatch(clientId, validatedData);

    return {
      success: result.summary.failed === 0,
      summary: result.summary,
      results: result.results,
      errors: result.summary.failed > 0 ? ['Some operations failed'] : []
    };

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Get balance statistics for monitoring
 */
async function getBalanceStatsEnterprise(clientId) {
  try {
    if (!clientId) {
      return { success: false, errors: ['Invalid client ID'] };
    }

    return await retryOperation(async () => {
      const db = await getDbEnterprise();

      try {
        const snapshot = await db.collection(`clients/${clientId}/balances`).get();

        let totalIncome = 0;
        let totalExpenses = 0;
        let count = 0;

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.totalIncome && !isNaN(data.totalIncome)) {
            totalIncome += data.totalIncome;
          }
          if (data.totalExpenses && !isNaN(data.totalExpenses)) {
            totalExpenses += data.totalExpenses;
          }
          count++;
        });

        const netBalance = totalIncome - totalExpenses;

        return {
          success: true,
          stats: {
            count,
            totalIncome,
            totalExpenses,
            netBalance,
            averageIncome: count > 0 ? (totalIncome / count) : 0,
            averageExpenses: count > 0 ? (totalExpenses / count) : 0
          }
        };

      } finally {
        releaseDbConnection();
      }
    }, `balance-stats-${clientId}`);

  } catch (error) {
    console.error('❌ Operation failed:', error);
    return { success: false, errors: [error.message] };
  }
}

// Export enterprise functions
export {
  createBalanceEnterprise,
  deleteBalanceEnterprise,
  listBalancesEnterprise,
  createBalancesBatchEnterprise,
  getBalanceStatsEnterprise,
  validateBalanceData
};

// Maintain backward compatibility with original names
export {
  createBalanceEnterprise as createBalance,
  deleteBalanceEnterprise as deleteBalance,
  listBalancesEnterprise as listBalances
};