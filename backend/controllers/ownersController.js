/**
 * owners.js
 * CRUD operations for owners collection
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';

/**
 * CRUD operations for owners under a client
 */

// Create an owner
async function createOwner(clientId, data) {
  try {
    const db = await getDb();
    const ownerRef = await db.collection(`clients/${clientId}/owners`).add({
      ...data,
      createdAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'owners',
      action: 'create',
      parentPath: `clients/${clientId}/owners/${ownerRef.id}`,
      docId: ownerRef.id,
      friendlyName: data.fullName || 'Unnamed Owner',
      notes: 'Created owner record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createOwner.');
    }

    return ownerRef.id;
  } catch (error) {
    console.error('❌ Error creating owner:', error);
    return null;
  }
}

// Update an owner
async function updateOwner(clientId, ownerId, newData) {
  try {
    const db = await getDb();
    const ownerRef = db.doc(`clients/${clientId}/owners/${ownerId}`);
    await ownerRef.update({
      ...newData,
      updatedAt: new Date(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'owners',
      action: 'update',
      parentPath: `clients/${clientId}/owners/${ownerId}`,
      docId: ownerId,
      friendlyName: newData.fullName || 'Unnamed Owner',
      notes: 'Updated owner record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateOwner.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating owner:', error);
    return false;
  }
}

// Delete an owner
async function deleteOwner(clientId, ownerId) {
  try {
    const db = await getDb();
    const ownerRef = db.doc(`clients/${clientId}/owners/${ownerId}`);
    await ownerRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'owners',
      action: 'delete',
      parentPath: `clients/${clientId}/owners/${ownerId}`,
      docId: ownerId,
      friendlyName: '',
      notes: 'Deleted owner record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteOwner.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting owner:', error);
    return false;
  }
}

// List all owners
async function listOwners(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/owners`).get();
    const owners = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      owners.push({
        ...data,
        id: doc.id, // Always use the document ID, overriding any 'id' field in data
      });
    });

    return owners;
  } catch (error) {
    console.error('❌ Error listing owners:', error);
    return [];
  }
}

export {
  createOwner,
  updateOwner,
  deleteOwner,
  listOwners,
};