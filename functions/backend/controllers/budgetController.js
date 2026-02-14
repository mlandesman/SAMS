/**
 * budgetController.js
 * CRUD operations for budget entries
 * Budgets are stored at: /clients/{clientId}/categories/{categoryId}/budget/{year}
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { getNow } from '../services/DateService.js';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * List all budgets for a fiscal year with category info
 * @param {string} clientId - Client ID
 * @param {number} year - Fiscal year
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<Array>} Array of budget objects with category info
 */
export async function listBudgetsByYear(clientId, year, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      logError('❌ No user provided for listBudgetsByYear');
      return [];
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      logError(`❌ User ${user.email} lacks access to client ${clientId}`);
      return [];
    }

    const db = await getDb();
    
    // Fetch all categories for this client
    const categoriesSnapshot = await db.collection(`clients/${clientId}/categories`).get();
    const categories = [];
    categoriesSnapshot.forEach(doc => {
      categories.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Fetch budgets for all categories for this year
    const budgets = [];
    
    for (const category of categories) {
      const budgetRef = db.doc(`clients/${clientId}/categories/${category.id}/budget/${year}`);
      const budgetDoc = await budgetRef.get();
      
      if (budgetDoc.exists) {
        const budgetData = budgetDoc.data();
        budgets.push({
          categoryId: category.id,
          categoryName: category.name,
          categoryType: category.type || 'expense',
          year: year,
          amount: budgetData.amount || 0,
          notes: budgetData.notes || '',
          createdAt: budgetData.createdAt,
          updatedAt: budgetData.updatedAt,
          createdBy: budgetData.createdBy,
          updatedBy: budgetData.updatedBy
        });
      } else {
        // Include categories without budgets (amount = 0)
        budgets.push({
          categoryId: category.id,
          categoryName: category.name,
          categoryType: category.type || 'expense',
          year: year,
          amount: 0,
          notes: '',
          createdAt: null,
          updatedAt: null,
          createdBy: null,
          updatedBy: null
        });
      }
    }
    
    logDebug(`✅ User ${user.email} listed ${budgets.length} budgets for client ${clientId}, year ${year}`);
    return budgets;
  } catch (error) {
    logError('❌ Error listing budgets:', error);
    return [];
  }
}

/**
 * Create or update budget for a category/year
 * @param {string} clientId - Client ID
 * @param {string} categoryId - Category ID
 * @param {number} year - Fiscal year
 * @param {number} amount - Budget amount in centavos (integer)
 * @param {string} notes - Optional notes string
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<boolean>} Success status
 */
export async function upsertBudget(clientId, categoryId, year, amount, notes, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      logError('❌ No user provided for upsertBudget');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      logError(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    // Validate amount is integer (centavos)
    if (!Number.isInteger(amount) || amount < 0) {
      logError('❌ Invalid amount - must be non-negative integer (centavos)');
      return false;
    }

    const db = await getDb();
    const budgetRef = db.doc(`clients/${clientId}/categories/${categoryId}/budget/${year}`);
    const budgetDoc = await budgetRef.get();
    
    const now = getNow();
    const timestamp = convertToTimestamp(now);
    
    if (budgetDoc.exists) {
      // Update existing budget
      await budgetRef.update({
        amount: amount,
        notes: notes || '',  // Save empty string if null/undefined
        updatedAt: timestamp,
        updatedBy: user.uid
      });
      
      // Get category name for audit log
      const categoryRef = db.doc(`clients/${clientId}/categories/${categoryId}`);
      const categoryDoc = await categoryRef.get();
      const categoryName = categoryDoc.exists ? categoryDoc.data().name : categoryId;
      
      const auditNotes = notes && notes.trim() 
        ? `Updated budget amount to ${amount} centavos and notes by ${user.email}`
        : `Updated budget amount to ${amount} centavos by ${user.email}`;
      
      const auditSuccess = await writeAuditLog({
        module: 'budgets',
        action: 'update',
        parentPath: `clients/${clientId}/categories/${categoryId}/budget/${year}`,
        docId: String(year),
        friendlyName: `${categoryName} - FY ${year}`,
        notes: auditNotes,
        userId: user.uid,
      });

      if (!auditSuccess) {
        logError('❌ Failed to write audit log for upsertBudget.');
      }
    } else {
      // Create new budget
      await budgetRef.set({
        amount: amount,
        notes: notes || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user.uid,
        updatedBy: user.uid
      });
      
      // Get category name for audit log
      const categoryRef = db.doc(`clients/${clientId}/categories/${categoryId}`);
      const categoryDoc = await categoryRef.get();
      const categoryName = categoryDoc.exists ? categoryDoc.data().name : categoryId;
      
      const auditNotes = notes && notes.trim()
        ? `Created budget with amount ${amount} centavos and notes by ${user.email}`
        : `Created budget with amount ${amount} centavos by ${user.email}`;
      
      const auditSuccess = await writeAuditLog({
        module: 'budgets',
        action: 'create',
        parentPath: `clients/${clientId}/categories/${categoryId}/budget/${year}`,
        docId: String(year),
        friendlyName: `${categoryName} - FY ${year}`,
        notes: auditNotes,
        userId: user.uid,
      });

      if (!auditSuccess) {
        logError('❌ Failed to write audit log for upsertBudget.');
      }
    }

    return true;
  } catch (error) {
    logError('❌ Error upserting budget:', error);
    return false;
  }
}

/**
 * Delete budget entry
 * @param {string} clientId - Client ID
 * @param {string} categoryId - Category ID
 * @param {number} year - Fiscal year
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<boolean>} Success status
 */
export async function deleteBudget(clientId, categoryId, year, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      logError('❌ No user provided for deleteBudget');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      logError(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const budgetRef = db.doc(`clients/${clientId}/categories/${categoryId}/budget/${year}`);
    
    // Get category name for audit log before deletion
    const categoryRef = db.doc(`clients/${clientId}/categories/${categoryId}`);
    const categoryDoc = await categoryRef.get();
    const categoryName = categoryDoc.exists ? categoryDoc.data().name : categoryId;
    
    await budgetRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'budgets',
      action: 'delete',
      parentPath: `clients/${clientId}/categories/${categoryId}/budget/${year}`,
      docId: String(year),
      friendlyName: `${categoryName} - FY ${year}`,
      notes: `Deleted budget entry by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      logError('❌ Failed to write audit log for deleteBudget.');
    }

    return true;
  } catch (error) {
    logError('❌ Error deleting budget:', error);
    return false;
  }
}

/**
 * Get prior year budget and actual spending for a category
 * Used for copying prior year data into current year budget
 * @param {string} clientId - Client ID
 * @param {string} categoryId - Category ID
 * @param {number} year - Current fiscal year (prior year will be year - 1)
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<Object>} Prior year budget and actual data
 */
export async function getPriorYearData(clientId, categoryId, year, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      logError('❌ No user provided for getPriorYearData');
      throw new Error('User authentication required');
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      logError(`❌ User ${user.email} lacks access to client ${clientId}`);
      throw new Error('Access denied');
    }

    const db = await getDb();
    
    // Get client configuration for fiscal year start month
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    // Calculate prior year
    const priorYear = year - 1;
    
    // Get fiscal year bounds for prior year
    const { startDate, endDate } = getFiscalYearBounds(priorYear, fiscalYearStartMonth);
    const startTimestamp = convertToTimestamp(startDate);
    const endTimestamp = convertToTimestamp(endDate);
    
    // Fetch prior year budget
    const budgetRef = db.doc(`clients/${clientId}/categories/${categoryId}/budget/${priorYear}`);
    const budgetDoc = await budgetRef.get();
    
    let budgetData = null;
    if (budgetDoc.exists) {
      const budget = budgetDoc.data();
      budgetData = {
        amount: budget.amount || 0, // centavos
        notes: budget.notes || ''
      };
    }
    
    // Fetch transactions for prior year and calculate actual spending
    // Query all transactions within fiscal year bounds, then filter by category in memory
    const transactionsSnapshot = await db.collection(`clients/${clientId}/transactions`)
      .where('date', '>=', startTimestamp)
      .where('date', '<=', endTimestamp)
      .get();
    
    // Aggregate actual spending for this category
    // Handle both regular transactions and split transactions
    let actualAmount = 0; // centavos (signed: negative for expenses, positive for income)
    let transactionCount = 0;
    
    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      
      // Check if this is a split transaction
      const isSplit = transaction.categoryId === '-split-' || 
                      transaction.categoryId === '-Split-' ||
                      transaction.categoryName === '-Split-' ||
                      (transaction.categoryId === null && transaction.allocations && transaction.allocations.length > 0);
      
      if (isSplit && transaction.allocations && Array.isArray(transaction.allocations)) {
        // Process split transaction: check if any allocation matches this category
        transaction.allocations.forEach(allocation => {
          if (allocation.categoryId === categoryId) {
            const allocationAmount = allocation.amount || 0; // Amount is in centavos (signed)
            actualAmount += allocationAmount;
            transactionCount++;
          }
        });
      } else if (transaction.categoryId === categoryId) {
        // Regular transaction for this category
        const amount = transaction.amount || 0; // Amount is in centavos (signed)
        actualAmount += amount;
        transactionCount++;
      }
    });
    
    // For display purposes, convert to positive for expenses (since we're showing spending)
    // But keep the signed value for proper accounting
    const actualAmountForDisplay = actualAmount < 0 ? Math.abs(actualAmount) : actualAmount;
    
    logDebug(`✅ Prior year data for client ${clientId}, category ${categoryId}, prior year ${priorYear}: budget=${budgetData?.amount || 0}, actual=${actualAmountForDisplay}, transactions=${transactionCount}`);
    
    return {
      priorYear: priorYear,
      budget: budgetData || null,
      actual: {
        amount: actualAmountForDisplay, // centavos (positive for display)
        transactionCount: transactionCount
      }
    };
  } catch (error) {
    logError('❌ Error getting prior year data:', error);
    throw error;
  }
}

