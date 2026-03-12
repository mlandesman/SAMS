// src/CRUD/units.js
import { getDb, toFirestoreTimestamp } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

function normalizeContactForStorage(entry) {
  if (typeof entry === 'string') {
    const trimmedName = entry.trim();
    if (!trimmedName) return null;
    return { name: trimmedName, email: '' };
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  if (typeof entry.userId === 'string' && entry.userId.trim()) {
    return { userId: entry.userId.trim() };
  }

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const email = typeof entry.email === 'string' ? entry.email.trim() : '';
  if (!name && !email) {
    return null;
  }

  return { name, email };
}

function normalizeContactsForStorage(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .map(normalizeContactForStorage)
    .filter(Boolean);
}

function getUserIdsFromContacts(contacts) {
  if (!Array.isArray(contacts)) return [];

  return contacts
    .filter(contact => contact && typeof contact === 'object' && typeof contact.userId === 'string')
    .map(contact => contact.userId.trim())
    .filter(Boolean);
}

function getResolvedName(userData = {}) {
  const profile = userData.profile || {};
  const firstName = typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
  const lastName = typeof profile.lastName === 'string' ? profile.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;
  return typeof userData.name === 'string' ? userData.name.trim() : '';
}

function getResolvedPhone(userData = {}) {
  const profile = userData.profile || {};
  return typeof profile.phone === 'string' ? profile.phone.trim() : '';
}

function getResolvedEmail(userData = {}) {
  return typeof userData.email === 'string' ? userData.email.trim() : '';
}

function enrichContactsWithUserMap(contacts, userMap) {
  if (!Array.isArray(contacts)) return [];

  return contacts.map(contact => {
    if (!contact || typeof contact !== 'object') {
      return contact;
    }

    if (typeof contact.userId === 'string' && contact.userId.trim()) {
      const userId = contact.userId.trim();
      const userData = userMap.get(userId);
      if (!userData) {
        return { userId, name: '', email: '', phone: '' };
      }
      return {
        userId,
        name: getResolvedName(userData),
        email: getResolvedEmail(userData),
        phone: getResolvedPhone(userData),
      };
    }

    return contact;
  });
}

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
      
      // Persist as UID references when provided; keep legacy entries for transition.
      owners: normalizeContactsForStorage(restData.owners || []),
      managers: normalizeContactsForStorage(restData.managers || []),
      // Note: emails field removed - emails are now in owner objects
      
      // Physical data
      squareFeet: restData.squareFeet || null,
      squareMeters: restData.squareMeters || null,
      ownershipPercentage: restData.ownershipPercentage || null,
      
      // Additional fields from existing data
      unitName: restData.unitName || '',
      
      // Timestamps - only updated, creation metadata in audit log
      updated: toFirestoreTimestamp(getNow())
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
    logError('❌ Error creating unit:', error);
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
    delete updates.emails; // Remove emails field - emails are now in owner objects
    
    // Keep owners/managers in UID-reference shape when provided.
    if (Object.prototype.hasOwnProperty.call(updates, 'owners')) {
      updates.owners = normalizeContactsForStorage(updates.owners);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'managers')) {
      updates.managers = normalizeContactsForStorage(updates.managers);
    }

    // Handle timestamp updates
    if (updates.created) {
      updates.created = toFirestoreTimestamp(updates.created);
    }
    
    await unitRef.update({
      ...updates,
      updated: toFirestoreTimestamp(getNow()),
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
      logError('❌ Failed to write audit log for updateUnit.');
    }

    return true;
  } catch (error) {
    logError('❌ Error updating unit:', error);
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
      logError('❌ Failed to write audit log for deleteUnit.');
    }

    return true;
  } catch (error) {
    logError('❌ Error deleting unit:', error);
    return false;
  }
}

// List all units under a client
async function listUnits(clientId) {
  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/units`).get();
    const units = [];
    const allUserIds = new Set();

    snapshot.forEach(doc => {
      // CRITICAL FIX: Exclude creditBalances* documents from units list
      // This includes 'creditBalances' and yearly archives like 'creditBalances_2025'
      if (doc.id.startsWith('creditBalances')) {
        logDebug(`⚠️ Skipping ${doc.id} document from units list`);
        return;
      }
      
      const data = doc.data();
      const ownersRaw = Array.isArray(data.owners) ? data.owners : (data.owner ? [data.owner] : []);
      const managersRaw = Array.isArray(data.managers) ? data.managers : [];

      getUserIdsFromContacts(ownersRaw).forEach(userId => allUserIds.add(userId));
      getUserIdsFromContacts(managersRaw).forEach(userId => allUserIds.add(userId));
      
      units.push({
        unitId: doc.id, // Document ID is the unit identifier
        ...data,
        ownersRaw,
        managersRaw,
        // Ensure other expected fields exist
        status: data.status || 'active',
        notes: data.notes || ''
      });
    });

    const userMap = new Map();
    const userIds = [...allUserIds];

    if (userIds.length > 0) {
      const userRefs = userIds.map(userId => db.collection('users').doc(userId));
      const userDocs = await db.getAll(...userRefs);

      userDocs.forEach((userDoc, index) => {
        if (userDoc.exists) {
          userMap.set(userIds[index], userDoc.data());
        }
      });
    }

    const enrichedUnits = units.map(unit => {
      const owners = enrichContactsWithUserMap(unit.ownersRaw, userMap);
      const managers = enrichContactsWithUserMap(unit.managersRaw, userMap);
      const { ownersRaw, managersRaw, ...unitWithoutRaw } = unit;
      return {
        ...unitWithoutRaw,
        owners,
        managers,
      };
    });

    return enrichedUnits;
  } catch (error) {
    logError('❌ Error listing units:', error);
    return [];
  }
}

// Update unit managers
async function updateUnitManagers(clientId, unitId, managers) {
  try {
    const db = await getDb();
    const unitRef = db.doc(`clients/${clientId}/units/${unitId}`);
    
    await unitRef.update({
      managers: normalizeContactsForStorage(managers || []),
      updated: toFirestoreTimestamp(getNow())
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
    logError('❌ Error updating unit managers:', error);
    return false;
  }
}

// DEPRECATED: Add email to unit
// This function is deprecated - emails should be added via owner objects in UnitFormModal
// Keeping for backward compatibility but it will no longer work (emails field removed)
async function addUnitEmail(clientId, unitId, email) {
  logWarn('⚠️  addUnitEmail is deprecated - emails should be added via owner objects');
  // This function is no longer functional - emails field has been removed
  // Use UnitFormModal to add emails to owner objects instead
  return false;
}

export {
  createUnit,
  updateUnit,
  deleteUnit,
  listUnits,
  updateUnitManagers,
  addUnitEmail,
};