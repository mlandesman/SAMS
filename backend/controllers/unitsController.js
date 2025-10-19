// src/CRUD/units.js
import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { getNow } from '../services/DateService.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * Create a Unit under a Client
 * @param {string} clientId 
 * @param {object} unitData 
 * @param {string} [docId] Optional document ID (like "2A", "PH4Z")
 * @returns 
 */
async function createUnit(clientId, unitData, docId = null) {
  try {
    const db = await getDb();
    
    // Extract unitId if provided separately
    const { unitId, ...restData } = unitData;
    const documentId = docId || unitId;
    
    // Remove redundant fields - document ID IS the unit identifier
    delete restData.unitNumber;
    delete restData.id;
    delete restData.unitId; // Don't store unitId in the document
    
    // Build unit object with new structure
    const unit = {
      // Required fields
      address: restData.address || '',
      propertyType: restData.propertyType || 'condo',
      status: restData.status || 'active',
      
      // New array fields (denormalized for display)
      owners: restData.owners || [],
      managers: restData.managers || [],
      emails: restData.emails || [],
      
      // Physical data
      squareFeet: restData.squareFeet || null,
      squareMeters: restData.squareMeters || null,
      ownershipPercentage: restData.ownershipPercentage || null,
      
      // Additional fields from existing data
      unitName: restData.unitName || '',
      
      // Timestamps - only updated, creation metadata in audit log
      updated: convertToTimestamp(getNow())
    };
    
    let unitRef;
    if (documentId) {
      unitRef = db.collection(`clients/${clientId}/units`).doc(documentId);
      await unitRef.set(unit);
    } else {
      unitRef = await db.collection(`clients/${clientId}/units`).add(unit);
    }

    await writeAuditLog({
      module: 'units',
      action: 'create',
      parentPath: `clients/${clientId}/units`,
      docId: unitRef.id,
      friendlyName: unit.unitName || unit.address || '',
      notes: 'Created new unit record',
    });

    return unitRef.id;
  } catch (error) {
    console.error('❌ Error creating unit:', error);
    throw error;
  }
}

// Update a unit
async function updateUnit(clientId, unitId, newData) {
  try {
    const db = await getDb();
    const unitRef = db.doc(`clients/${clientId}/units/${unitId}`);
    
    // Remove redundant fields from updates
    const updates = { ...newData };
    delete updates.unitNumber;
    delete updates.id;
    delete updates.unitId;
    
    // Handle timestamp updates
    if (updates.created) {
      updates.created = convertToTimestamp(updates.created);
    }
    
    await unitRef.update({
      ...updates,
      updated: convertToTimestamp(getNow()),
    });

    const auditSuccess = await writeAuditLog({
      module: 'units',
      action: 'update',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: updates.unitName || updates.address || 'Unnamed Unit',
      notes: 'Updated unit record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateUnit.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating unit:', error);
    return false;
  }
}

// Delete a unit
async function deleteUnit(clientId, unitId) {
  try {
    const db = await getDb();
    const unitRef = db.doc(`clients/${clientId}/units/${unitId}`);
    await unitRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'units',
      action: 'delete',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: '',
      notes: 'Deleted unit record',
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteUnit.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting unit:', error);
    return false;
  }
}

// List all units under a client
async function listUnits(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/units`).get();
    const units = [];

    snapshot.forEach(doc => {
      // CRITICAL FIX: Exclude 'creditBalances' document from units list
      // This document is used for credit balance storage, not a unit
      if (doc.id === 'creditBalances') {
        console.log('⚠️ Skipping creditBalances document from units list');
        return;
      }
      
      const data = doc.data();
      
      // Add the document ID as unitId for API response
      const unit = {
        unitId: doc.id, // Document ID is the unit identifier
        ...data,
        // Handle owner/owners field mapping
        owners: data.owners || (data.owner ? [data.owner] : []),
        managers: data.managers || [],
        // Ensure other expected fields exist
        status: data.status || 'active',
        notes: data.notes || ''
      };
      
      units.push(unit);
    });

    return units;
  } catch (error) {
    console.error('❌ Error listing units:', error);
    return [];
  }
}

// Update unit managers
async function updateUnitManagers(clientId, unitId, managers) {
  try {
    const db = await getDb();
    const unitRef = db.doc(`clients/${clientId}/units/${unitId}`);
    
    await unitRef.update({
      managers: managers || [],
      updated: convertToTimestamp(getNow())
    });
    
    await writeAuditLog({
      module: 'units',
      action: 'update',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: `Unit ${unitId}`,
      notes: 'Updated unit managers',
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error updating unit managers:', error);
    return false;
  }
}

// Add email to unit
async function addUnitEmail(clientId, unitId, email) {
  try {
    const db = await getDb();
    const admin = (await import('firebase-admin')).default;
    const unitRef = db.doc(`clients/${clientId}/units/${unitId}`);
    
    // Add to emails array
    await unitRef.update({
      emails: admin.firestore.FieldValue.arrayUnion(email),
      updated: convertToTimestamp(getNow())
    });
    
    await writeAuditLog({
      module: 'units',
      action: 'update',
      parentPath: `clients/${clientId}/units/${unitId}`,
      docId: unitId,
      friendlyName: `Unit ${unitId}`,
      notes: `Added email: ${email}`,
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error adding unit email:', error);
    return false;
  }
}

export {
  createUnit,
  updateUnit,
  deleteUnit,
  listUnits,
  updateUnitManagers,
  addUnitEmail,
};