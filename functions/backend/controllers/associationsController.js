/**
 * associations.js
 * CRUD operations for associations collection
 * (formerly called properties)
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

/**
 * CRUD operations for associations under a client
 */

// Create an association
async function createAssociation(clientId, data) {
  try {
    const db = await getDb();
    const assocRef = await db.collection(`clients/${clientId}/associations`).add({
      ...data,
      createdAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'associations',
      action: 'create',
      parentPath: `clients/${clientId}/associations/${assocRef.id}`,
      docId: assocRef.id,
      friendlyName: data.name || 'Unnamed Association',
      notes: 'Created new association record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createAssociation.');
    }

    return assocRef.id;
  } catch (error) {
    console.error('❌ Error creating association:', error);
    return null;
  }
}

// Update an association
async function updateAssociation(clientId, assocId, newData) {
  try {
    const db = await getDb();
    const assocRef = db.doc(`clients/${clientId}/associations/${assocId}`);
    await assocRef.update({
      ...newData,
      updatedAt: getNow(),
    });

    const auditSuccess = await writeAuditLog({
      module: 'associations',
      action: 'update',
      parentPath: `clients/${clientId}/associations/${assocId}`,
      docId: assocId,
      friendlyName: newData.name || 'Unnamed Association',
      notes: 'Updated association record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateAssociation.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating association:', error);
    return false;
  }
}

// Delete an association
async function deleteAssociation(clientId, assocId) {
  try {
    const db = await getDb();
    const assocRef = db.doc(`clients/${clientId}/associations/${assocId}`);
    await assocRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'associations',
      action: 'delete',
      parentPath: `clients/${clientId}/associations/${assocId}`,
      docId: assocId,
      friendlyName: '',
      notes: 'Deleted association record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteAssociation.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting association:', error);
    return false;
  }
}

// List all associations
async function listAssociations(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/associations`).get();
    const associations = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      associations.push({
        ...data,
        id: doc.id, // Always use the document ID, overriding any 'id' field in data
      });
    });

    return associations;
  } catch (error) {
    console.error('❌ Error listing associations:', error);
    return [];
  }
}

export {
  createAssociation,
  updateAssociation,
  deleteAssociation,
  listAssociations,
};