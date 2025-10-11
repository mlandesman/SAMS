/**
 * categories.js
 * CRUD operations for categories collection inside lists
 * Refactored to include propertyAccess validation
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { generateCategoryId, ensureUniqueDocumentId } from '../utils/documentIdGenerator.js';
import { getNow } from '../services/DateService.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * CRUD operations for categories under a client
 * All functions now require user object for propertyAccess validation
 */

// Create a category
async function createCategory(clientId, data, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for createCategory');
      return null;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return null;
    }

    const db = await getDb();
    
    // Build simplified category structure - no budget fields
    const category = {
      name: (data.name || '').trim(),
      description: data.description || '',
      type: data.type || 'expense', // expense or income
      status: 'active',
      // Only keep updated timestamp - creation metadata goes in audit log
      updated: convertToTimestamp(getNow()),
    };
    
    // Remove any budget-related fields that might be passed in
    delete data.budget;
    delete data.budgetAmount;
    delete data.allocations;
    delete data.yearlyBudget;
    delete data.monthlyBudget;
    
    // Generate custom document ID from category name
    const baseId = generateCategoryId(category.name);
    const categoryId = await ensureUniqueDocumentId(db, `clients/${clientId}/categories`, baseId);
    
    // Use set with custom ID instead of add
    const catRef = db.doc(`clients/${clientId}/categories/${categoryId}`);
    await catRef.set(category);

    const auditSuccess = await writeAuditLog({
      module: 'categories',
      action: 'create',
      parentPath: `clients/${clientId}/categories/${catRef.id}`,
      docId: catRef.id,
      friendlyName: category.name || 'Unnamed Category',
      notes: `Created category record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createCategory.');
    }

    return categoryId;
  } catch (error) {
    console.error('❌ Error creating category:', error);
    return null;
  }
}

// Update a category
async function updateCategory(clientId, catId, newData, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for updateCategory');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const catRef = db.doc(`clients/${clientId}/categories/${catId}`);
    
    // Build update object and remove budget fields
    const updates = { ...newData };
    delete updates.budget;
    delete updates.budgetAmount;
    delete updates.allocations;
    delete updates.yearlyBudget;
    delete updates.monthlyBudget;
    
    // Ensure name is trimmed if provided
    if (updates.name) {
      updates.name = updates.name.trim();
    }
    
    await catRef.update({
      ...updates,
      updated: convertToTimestamp(getNow()),
      updatedBy: user.uid,
    });

    const auditSuccess = await writeAuditLog({
      module: 'categories',
      action: 'update',
      parentPath: `clients/${clientId}/categories/${catId}`,
      docId: catId,
      friendlyName: updates.name || 'Unnamed Category',
      notes: `Updated category record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateCategory.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating category:', error);
    return false;
  }
}

// Delete a category
async function deleteCategory(clientId, catId, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for deleteCategory');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const catRef = db.doc(`clients/${clientId}/categories/${catId}`);
    await catRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'categories',
      action: 'delete',
      parentPath: `clients/${clientId}/categories/${catId}`,
      docId: catId,
      friendlyName: '',
      notes: `Deleted category record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteCategory.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    return false;
  }
}

// List all categories
async function listCategories(clientId, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for listCategories');
      return [];
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return [];
    }

    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/categories`).get();
    const categories = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const category = {
        id: doc.id, // Always use the document ID
        ...data
      };
      
      // Remove any budget fields and clean migration artifacts
      delete category.budget;
      delete category.budgetAmount;
      delete category.allocations;
      delete category.yearlyBudget;
      delete category.monthlyBudget;
      
      categories.push(category);
    });

    console.log(`✅ User ${user.email} listed ${categories.length} categories for client ${clientId}`);
    return categories;
  } catch (error) {
    console.error('❌ Error listing categories:', error);
    return [];
  }
}

export {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
};