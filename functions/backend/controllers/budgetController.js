/**
 * budgetController.js
 * CRUD operations for budget entries
 * Budgets are stored at: /clients/{clientId}/categories/{categoryId}/budget/{year}
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { getNow } from '../services/DateService.js';

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
      console.error('❌ No user provided for listBudgetsByYear');
      return [];
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
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
    
    console.log(`✅ User ${user.email} listed ${budgets.length} budgets for client ${clientId}, year ${year}`);
    return budgets;
  } catch (error) {
    console.error('❌ Error listing budgets:', error);
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
      console.error('❌ No user provided for upsertBudget');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    // Validate amount is integer (centavos)
    if (!Number.isInteger(amount) || amount < 0) {
      console.error('❌ Invalid amount - must be non-negative integer (centavos)');
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
        console.error('❌ Failed to write audit log for upsertBudget.');
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
        console.error('❌ Failed to write audit log for upsertBudget.');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error upserting budget:', error);
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
      console.error('❌ No user provided for deleteBudget');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
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
      console.error('❌ Failed to write audit log for deleteBudget.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting budget:', error);
    return false;
  }
}

