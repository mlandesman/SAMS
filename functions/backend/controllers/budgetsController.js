/**
 * budgets.js
 * CRUD operations for budgets collection under a client
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

/**
 * CRUD operations for budgets under a specific year and type (income/expense)
 */

// Create a budget entry
async function createBudget(clientId, year, type, data) {
  try {
    const db = await getDb();
    const budgetRef = await db.collection(`clients/${clientId}/budgets/${year}/${type}`).add({
      ...data,
      createdAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'budgets',
      action: 'create',
      parentPath: `clients/${clientId}/budgets/${year}/${type}/${budgetRef.id}`,
      docId: budgetRef.id,
      friendlyName: data.category || 'Unnamed Budget Category',
      notes: 'Created budget entry',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createBudget.');
    }

    return budgetRef.id;
  } catch (error) {
    console.error('❌ Error creating budget:', error);
    return null;
  }
}

// Update a budget entry
async function updateBudget(clientId, year, type, budgetId, newData) {
  try {
    const db = await getDb();
    const budgetRef = db.doc(`clients/${clientId}/budgets/${year}/${type}/${budgetId}`);
    await budgetRef.update({
      ...newData,
      updatedAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'budgets',
      action: 'update',
      parentPath: `clients/${clientId}/budgets/${year}/${type}/${budgetId}`,
      docId: budgetId,
      friendlyName: newData.category || 'Unnamed Budget Category',
      notes: 'Updated budget entry',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateBudget.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating budget:', error);
    return false;
  }
}

// Delete a budget entry
async function deleteBudget(clientId, year, type, budgetId) {
  try {
    const db = await getDb();
    const budgetRef = db.doc(`clients/${clientId}/budgets/${year}/${type}/${budgetId}`);
    await budgetRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'budgets',
      action: 'delete',
      parentPath: `clients/${clientId}/budgets/${year}/${type}/${budgetId}`,
      docId: budgetId,
      friendlyName: '',
      notes: 'Deleted budget entry',
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

// List all budget entries under a year/type
async function listBudgets(clientId, year, type) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/budgets/${year}/${type}`).get();
    const budgets = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      budgets.push({
        ...data,
        id: doc.id, // Always use the document ID, overriding any 'id' field in data
      });
    });

    return budgets;
  } catch (error) {
    console.error('❌ Error listing budgets:', error);
    return [];
  }
}

export {
  createBudget,
  updateBudget,
  deleteBudget,
  listBudgets,
};