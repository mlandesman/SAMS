/**
 * paymentMethodsController.js
 * CRUD operations for payment methods collection inside lists
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { generatePaymentMethodId, ensureUniqueDocumentId } from '../utils/documentIdGenerator.js';

/**
 * CRUD operations for payment methods under a client
 */

// Create a payment method
async function createPaymentMethod(clientId, data) {
  try {
    const db = await getDb();
    
    // Generate custom document ID from payment method name
    const baseId = generatePaymentMethodId(data.name);
    const methodId = await ensureUniqueDocumentId(db, `clients/${clientId}/paymentMethods`, baseId);
    
    // Use set with custom ID instead of add
    const methodRef = db.doc(`clients/${clientId}/paymentMethods/${methodId}`);
    await methodRef.set({
      ...data,
      createdAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'paymentMethods',
      action: 'create',
      parentPath: `clients/${clientId}/paymentMethods/${methodRef.id}`,
      docId: methodRef.id,
      friendlyName: data.name || 'Unnamed Payment Method',
      notes: 'Created payment method record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createPaymentMethod.');
    }

    return methodId;
  } catch (error) {
    console.error('❌ Error creating payment method:', error);
    return null;
  }
}

// Update a payment method
async function updatePaymentMethod(clientId, methodId, newData) {
  try {
    const db = await getDb();
    const methodRef = db.doc(`clients/${clientId}/paymentMethods/${methodId}`);
    await methodRef.update({
      ...newData,
      updatedAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'paymentMethods',
      action: 'update',
      parentPath: `clients/${clientId}/paymentMethods/${methodId}`,
      docId: methodId,
      friendlyName: newData.name || 'Unnamed Payment Method',
      notes: 'Updated payment method record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updatePaymentMethod.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating payment method:', error);
    return false;
  }
}

// Delete a payment method
async function deletePaymentMethod(clientId, methodId) {
  try {
    const db = await getDb();
    const methodRef = db.doc(`clients/${clientId}/paymentMethods/${methodId}`);
    await methodRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'paymentMethods',
      action: 'delete',
      parentPath: `clients/${clientId}/paymentMethods/${methodId}`,
      docId: methodId,
      friendlyName: '',
      notes: 'Deleted payment method record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deletePaymentMethod.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting payment method:', error);
    return false;
  }
}

// List all payment methods
async function listPaymentMethods(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/paymentMethods`).get();
    const paymentMethods = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      paymentMethods.push({
        ...data,
        id: doc.id, // Always use the document ID, overriding any 'id' field in data
      });
    });

    return paymentMethods;
  } catch (error) {
    console.error('❌ Error listing payment methods:', error);
    return [];
  }
}

export {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
};
