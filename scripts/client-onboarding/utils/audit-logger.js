/**
 * Audit Logger Utility
 * Implements the audit logging pattern we designed
 */

import { getCurrentTimestamp } from './timestamp-converter.js';

/**
 * Write an audit log entry
 * @param {Object} db - Firestore database instance
 * @param {Object} auditData - Audit log data
 * @param {string} auditData.module - Module/component that triggered the action
 * @param {string} auditData.action - CREATE, UPDATE, DELETE, etc.
 * @param {string} auditData.collection - Collection path
 * @param {string} auditData.documentId - Document ID
 * @param {string} auditData.userId - User ID or system identifier
 * @param {Object} auditData.changes - What changed
 * @param {Object} auditData.metadata - Additional metadata
 */
export async function writeAuditLog(db, auditData) {
  const {
    module = 'unknown',
    action,
    collection,
    documentId,
    userId,
    changes = {},
    metadata = {}
  } = auditData;
  
  const auditEntry = {
    // Required fields
    module,
    action,
    collection,
    documentId,
    userId,
    timestamp: getCurrentTimestamp(),
    
    // Changes made
    changes,
    
    // Additional context
    metadata: {
      ...metadata,
      environment: process.env.FIRESTORE_ENV || 'dev',
      scriptVersion: '1.0.0'
    }
  };
  
  try {
    // Use auto-generated ID for better performance
    const docRef = await db.collection('auditLogs').add(auditEntry);
    return docRef.id;
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - audit logging should not break the main operation
    return null;
  }
}

/**
 * Write multiple audit logs in a batch
 * @param {Object} db - Firestore database instance
 * @param {Array} auditDataArray - Array of audit data objects
 */
export async function writeBatchAuditLogs(db, auditDataArray) {
  const batch = db.batch();
  const auditIds = [];
  
  for (const auditData of auditDataArray) {
    // Use auto-generated ID
    const docRef = db.collection('auditLogs').doc();
    
    const auditEntry = {
      module: auditData.module || 'unknown',
      action: auditData.action,
      collection: auditData.collection,
      documentId: auditData.documentId,
      userId: auditData.userId,
      timestamp: getCurrentTimestamp(),
      changes: auditData.changes || {},
      metadata: {
        ...auditData.metadata || {},
        environment: process.env.FIRESTORE_ENV || 'dev',
        scriptVersion: '1.0.0'
      }
    };
    
    batch.set(docRef, auditEntry);
    auditIds.push(docRef.id);
  }
  
  try {
    await batch.commit();
    return auditIds;
  } catch (error) {
    console.error('Failed to write batch audit logs:', error);
    return [];
  }
}

/**
 * Query audit logs for a document
 * @param {Object} db - Firestore database instance
 * @param {string} collection - Collection path
 * @param {string} documentId - Document ID
 * @param {Object} options - Query options
 */
export async function getAuditHistory(db, collection, documentId, options = {}) {
  const { limit = 100, startAfter = null } = options;
  
  let query = db.collection('auditLogs')
    .where('collection', '==', collection)
    .where('documentId', '==', documentId)
    .orderBy('timestamp', 'desc')
    .limit(limit);
  
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}