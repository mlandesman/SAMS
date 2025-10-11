/**
 * vendors.js
 * CRUD operations for vendors collection inside lists
 * Refactored to include propertyAccess validation
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { generateVendorId, ensureUniqueDocumentId } from '../utils/documentIdGenerator.js';
import { getNow } from '../services/DateService.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * CRUD operations for vendors under a client
 * All functions now require user object for propertyAccess validation
 */

// Create a vendor
async function createVendor(clientId, data, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for createVendor');
      return null;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return null;
    }

    const db = await getDb();
    
    // Build vendor with structured contact information
    const vendorData = {
      // Basic info
      name: (data.name || '').trim(),
      category: data.category || '',
      
      // New structured contact information
      contact: {
        email: data.email || data.contact?.email || null,
        phone: data.phone || data.contact?.phone || null,
        website: data.website || data.contact?.website || null,
        address: data.address || data.contact?.address || null,
        contactPerson: data.contactPerson || data.contact?.contactPerson || null
      },
      
      // Additional fields
      taxId: data.taxId || null,
      notes: data.notes || '',
      status: 'active',
      
      // Timestamps - only updated, creation metadata in audit log
      updated: convertToTimestamp(getNow()),
    };
    
    // Generate custom document ID from vendor name
    const baseId = generateVendorId(vendorData.name);
    const vendorId = await ensureUniqueDocumentId(db, `clients/${clientId}/vendors`, baseId);
    
    // Use set with custom ID instead of add
    const vendorRef = db.doc(`clients/${clientId}/vendors/${vendorId}`);
    await vendorRef.set(vendorData);

    const auditSuccess = await writeAuditLog({
      module: 'vendors',
      action: 'create',
      parentPath: `clients/${clientId}/vendors/${vendorRef.id}`,
      docId: vendorRef.id,
      friendlyName: vendorData.name || 'Unnamed Vendor',
      notes: `Created vendor record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createVendor.');
    }

    return vendorId;
  } catch (error) {
    console.error('❌ Error creating vendor:', error);
    return null;
  }
}

// Update a vendor
async function updateVendor(clientId, vendorId, newData, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for updateVendor');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const vendorRef = db.doc(`clients/${clientId}/vendors/${vendorId}`);
    
    const updates = { ...newData };
    
    // If updating contact info, ensure it's structured
    if (updates.email || updates.phone || updates.website || updates.address || updates.contactPerson) {
      // Get existing vendor data to merge contact info
      const existingDoc = await vendorRef.get();
      const existingData = existingDoc.data() || {};
      const existingContact = existingData.contact || {};
      
      updates.contact = {
        email: updates.email || existingContact.email || null,
        phone: updates.phone || existingContact.phone || null,
        website: updates.website || existingContact.website || null,
        address: updates.address || existingContact.address || null,
        contactPerson: updates.contactPerson || existingContact.contactPerson || null
      };
      
      // Remove flat fields
      delete updates.email;
      delete updates.phone;
      delete updates.website;
      delete updates.address;
      delete updates.contactPerson;
    } else if (updates.contact) {
      // If contact object is provided directly, use it
      updates.contact = {
        email: updates.contact.email || null,
        phone: updates.contact.phone || null,
        website: updates.contact.website || null,
        address: updates.contact.address || null,
        contactPerson: updates.contact.contactPerson || null
      };
    }
    
    // Ensure name is trimmed if provided
    if (updates.name) {
      updates.name = updates.name.trim();
    }
    
    await vendorRef.update({
      ...updates,
      updated: convertToTimestamp(getNow()),
      updatedBy: user.uid,
    });

    const auditSuccess = await writeAuditLog({
      module: 'vendors',
      action: 'update',
      parentPath: `clients/${clientId}/vendors/${vendorId}`,
      docId: vendorId,
      friendlyName: updates.name || 'Unnamed Vendor',
      notes: `Updated vendor record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateVendor.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating vendor:', error);
    return false;
  }
}

// Delete a vendor
async function deleteVendor(clientId, vendorId, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for deleteVendor');
      return false;
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const vendorRef = db.doc(`clients/${clientId}/vendors/${vendorId}`);
    await vendorRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'vendors',
      action: 'delete',
      parentPath: `clients/${clientId}/vendors/${vendorId}`,
      docId: vendorId,
      friendlyName: '',
      notes: `Deleted vendor record by ${user.email}`,
      userId: user.uid,
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteVendor.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting vendor:', error);
    return false;
  }
}

// List all vendors
async function listVendors(clientId, user) {
  try {
    // Validate propertyAccess
    if (!user) {
      console.error('❌ No user provided for listVendors');
      return [];
    }

    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return [];
    }

    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/vendors`).get();
    const vendors = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Flatten contact fields for frontend compatibility
      const vendor = {
        id: doc.id, // Always use the document ID
        name: data.name || '',
        category: data.category || '',
        // Flatten contact fields from nested structure
        email: data.contact?.email || data.email || '',
        phone: data.contact?.phone || data.phone || '',
        website: data.contact?.website || data.website || '',
        address: data.contact?.address || data.address || '',
        contactPerson: data.contact?.contactPerson || data.contactPerson || '',
        // Other fields
        taxId: data.taxId || '',
        notes: data.notes || '',
        status: data.status || 'active',
        // Keep nested contact for reference if needed
        contact: data.contact,
        // Timestamps
        created: data.created,
        updated: data.updated
      };
      
      vendors.push(vendor);
    });

    console.log(`✅ User ${user.email} listed ${vendors.length} vendors for client ${clientId}`);
    return vendors;
  } catch (error) {
    console.error('❌ Error listing vendors:', error);
    return [];
  }
}

export {
  createVendor,
  updateVendor,
  deleteVendor,
  listVendors,
};