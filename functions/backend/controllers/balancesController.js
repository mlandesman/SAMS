/**
 * balances.js
 * CRUD operations for balances collection
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { normalizeDates } from '../utils/timestampUtils.js';
import admin from 'firebase-admin';

/**
 * CRUD operations for balances under a client
 */

// Create a monthly balance
async function createBalance(clientId, monthId, data) {
  try {
    const db = await getDb();
    const balanceRef = db.doc(`clients/${clientId}/balances/${monthId}`);
    // Normalize dates before storing in Firestore
    const normalizedData = normalizeDates(data);
    
    await balanceRef.set({
      ...normalizedData,
      createdAt: admin.firestore.Timestamp.now(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'balances',
      action: 'create',
      parentPath: `clients/${clientId}/balances/${monthId}`,
      docId: monthId,
      friendlyName: `Balance ${monthId}`,
      notes: 'Created monthly balance record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createBalance.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating balance:', error);
    return false;
  }
}

// Delete a balance
async function deleteBalance(clientId, monthId) {
  try {
    const db = await getDb();
    const balanceRef = db.doc(`clients/${clientId}/balances/${monthId}`);
    await balanceRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'balances',
      action: 'delete',
      parentPath: `clients/${clientId}/balances/${monthId}`,
      docId: monthId,
      friendlyName: '',
      notes: 'Deleted monthly balance record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteBalance.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting balance:', error);
    return false;
  }
}

// List all balances
async function listBalances(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/balances`).get();
    const balances = [];

    snapshot.forEach(doc => {
      balances.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return balances;
  } catch (error) {
    console.error('❌ Error listing balances:', error);
    return [];
  }
}

export {
  createBalance,
  deleteBalance,
  listBalances,
};