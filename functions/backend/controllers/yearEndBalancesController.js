/**
 * yearEndBalancesController.js
 * CRUD operations for year-end balances
 */

import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { getNow } from '../services/DateService.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * Create a year-end balance document
 */
export async function createYearEndBalance(clientId, data, user) {
  try {
    // Validate user access
    if (!user) {
      console.error('❌ No user provided for createYearEndBalance');
      return null;
    }

    if (!user.isSuperAdmin && !user.isSuperAdmin() && !user.hasPropertyAccess && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return null;
    }

    const db = await getDb();
    
    // Build year-end balance structure to match existing route structure
    const yearEndBalance = {
      accounts: data.accounts || [],
      createdAt: convertToTimestamp(getNow()),
      createdBy: user.email || user.uid,
      clientId: clientId,
      // Additional fields from the modern import
      fiscalYear: data.fiscalYear,
      date: data.date || new Date(`${data.fiscalYear}-12-31`).toISOString(),
      totals: data.totals || {
        assets: 0,
        liabilities: 0,
        equity: 0,
        netPosition: 0
      },
      metadata: {
        ...data.metadata,
        createdAt: convertToTimestamp(getNow()),
        createdBy: user.email || user.uid,
        updatedAt: convertToTimestamp(getNow()),
        updatedBy: user.email || user.uid
      }
    };
    
    // Use fiscalYear as document ID
    const docId = data.fiscalYear.toString();
    const balanceRef = db.doc(`clients/${clientId}/yearEndBalances/${docId}`);
    
    // Check if document already exists
    const existing = await balanceRef.get();
    if (existing.exists) {
      console.log(`⚠️ Year-end balance for ${data.fiscalYear} already exists, updating instead`);
      return await updateYearEndBalance(clientId, docId, yearEndBalance, user);
    }
    
    await balanceRef.set(yearEndBalance);

    const auditSuccess = await writeAuditLog({
      module: 'yearEndBalances',
      action: 'create',
      parentPath: `clients/${clientId}/yearEndBalances/${docId}`,
      docId: docId,
      friendlyName: `Year-End Balance ${data.fiscalYear}`,
      notes: `Created year-end balance for fiscal year ${data.fiscalYear} by ${user.email}`,
      userId: user.uid,
      clientId: clientId
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for createYearEndBalance.');
    }

    return docId;
  } catch (error) {
    console.error('❌ Error creating year-end balance:', error);
    return null;
  }
}

/**
 * Update a year-end balance document
 */
export async function updateYearEndBalance(clientId, yearId, newData, user) {
  try {
    // Validate user access
    if (!user) {
      console.error('❌ No user provided for updateYearEndBalance');
      return false;
    }

    if (!user.isSuperAdmin && !user.isSuperAdmin() && !user.hasPropertyAccess && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const balanceRef = db.doc(`clients/${clientId}/yearEndBalances/${yearId}`);
    
    const updates = {
      ...newData,
      metadata: {
        ...newData.metadata,
        updatedAt: convertToTimestamp(getNow()),
        updatedBy: user.email || user.uid
      }
    };

    await balanceRef.update(updates);

    const auditSuccess = await writeAuditLog({
      module: 'yearEndBalances',
      action: 'update',
      parentPath: `clients/${clientId}/yearEndBalances/${yearId}`,
      docId: yearId,
      friendlyName: `Year-End Balance ${yearId}`,
      notes: `Updated year-end balance for fiscal year ${yearId} by ${user.email}`,
      userId: user.uid,
      clientId: clientId
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for updateYearEndBalance.');
    }

    return yearId;
  } catch (error) {
    console.error('❌ Error updating year-end balance:', error);
    return false;
  }
}

/**
 * Get year-end balances for a client
 */
export async function getYearEndBalances(clientId, user) {
  try {
    // Validate user access
    if (!user) {
      console.error('❌ No user provided for getYearEndBalances');
      return [];
    }

    if (!user.isSuperAdmin && !user.isSuperAdmin() && !user.hasPropertyAccess && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return [];
    }

    const db = await getDb();
    const balancesRef = db.collection(`clients/${clientId}/yearEndBalances`);
    const snapshot = await balancesRef.orderBy('year', 'desc').get();
    
    const balances = [];
    snapshot.forEach(doc => {
      balances.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return balances;
  } catch (error) {
    console.error('❌ Error getting year-end balances:', error);
    return [];
  }
}

/**
 * Get a specific year-end balance
 */
export async function getYearEndBalance(clientId, yearId, user) {
  try {
    // Validate user access
    if (!user) {
      console.error('❌ No user provided for getYearEndBalance');
      return null;
    }

    if (!user.isSuperAdmin && !user.isSuperAdmin() && !user.hasPropertyAccess && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return null;
    }

    const db = await getDb();
    const balanceRef = db.doc(`clients/${clientId}/yearEndBalances/${yearId}`);
    const doc = await balanceRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('❌ Error getting year-end balance:', error);
    return null;
  }
}

/**
 * Delete a year-end balance document
 */
export async function deleteYearEndBalance(clientId, yearId, user) {
  try {
    // Validate user access
    if (!user) {
      console.error('❌ No user provided for deleteYearEndBalance');
      return false;
    }

    if (!user.isSuperAdmin && !user.isSuperAdmin() && !user.hasPropertyAccess && !user.hasPropertyAccess(clientId)) {
      console.error(`❌ User ${user.email} lacks access to client ${clientId}`);
      return false;
    }

    const db = await getDb();
    const balanceRef = db.doc(`clients/${clientId}/yearEndBalances/${yearId}`);
    
    await balanceRef.delete();

    const auditSuccess = await writeAuditLog({
      module: 'yearEndBalances',
      action: 'delete',
      parentPath: `clients/${clientId}/yearEndBalances/${yearId}`,
      docId: yearId,
      friendlyName: `Year-End Balance ${yearId}`,
      notes: `Deleted year-end balance for fiscal year ${yearId} by ${user.email}`,
      userId: user.uid,
      clientId: clientId
    });

    if (!auditSuccess) {
      console.error('❌ Failed to write audit log for deleteYearEndBalance.');
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting year-end balance:', error);
    return false;
  }
}