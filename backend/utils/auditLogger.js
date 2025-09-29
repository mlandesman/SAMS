import { getDb } from '../firebase.js'; // Add .js extension
import admin from 'firebase-admin';
import { getNow } from '../services/DateService.js';
const db = await getDb(); // Await getDb

function generateAuditId() {
  const now = getNow();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(3, '0'); // Add milliseconds

  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Writes an audit log to /auditLogs/{auditId}
 * @param {Object} param0 - log fields
 * @param {string} param0.module - Module name (e.g., 'transactions', 'units')
 * @param {string} param0.action - Action performed (e.g., 'create', 'update', 'delete')
 * @param {string} param0.parentPath - Path to parent document
 * @param {string} param0.docId - Document ID
 * @param {string} param0.friendlyName - Human-readable name
 * @param {string} param0.notes - Additional notes (optional)
 * @param {string|null} param0.clientId - Client ID (optional, auto-extracted from parentPath if not provided)
 * @returns {Promise<boolean>} true if success, false if error
 */
async function writeAuditLog({ module, action, parentPath, docId, friendlyName, notes = '', clientId = null }) {
  try {
    // Auto-extract clientId from parentPath if not provided
    if (!clientId && parentPath && parentPath.startsWith('clients/')) {
      const pathParts = parentPath.split('/');
      if (pathParts.length >= 2) {
        clientId = pathParts[1]; // Extract clientId from "clients/{clientId}/..."
      }
    }

    const auditId = generateAuditId();
    const log = {
      timestamp: admin.firestore.Timestamp.now(),
      module,
      action,
      parentPath,
      docId,
      friendlyName,
      notes,
      clientId, // New field - null for system-wide operations, clientId for client-specific
    };

    await db.collection('auditLogs').doc(auditId).set(log);
    return true;
  } catch (error) {
    console.error('❌ Error writing audit log:', error);
    return false;
  }
}

export { writeAuditLog };