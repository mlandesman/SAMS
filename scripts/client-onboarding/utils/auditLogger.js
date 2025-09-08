// scripts/utils/auditLogger.js
import admin from 'firebase-admin';

/**
 * Generates a unique audit ID based on the current timestamp
 * @returns {string} A formatted timestamp string for use as an audit ID
 */
function generateAuditId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return `${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}`;
}

/**
 * Writes an audit log to /auditLogs/{auditId}
 * This version is designed to work with scripts that already have their own Firebase initialization
 * @param {Object} param0 - log fields
 * @param {admin.firestore.Firestore} db - Firestore database instance
 * @returns {Promise<boolean>} true if success, false if error
 */
async function writeAuditLog({ 
  module, 
  action, 
  details = {},
  status = 'success',
  notes = ''
}, db) {
  try {
    if (!db) {
      console.error('❌ Error writing audit log: No database instance provided');
      return false;
    }

    const auditId = generateAuditId();
    const log = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      module,
      action,
      status,
      details,
      notes,
    };

    await db.collection('auditLogs').doc(auditId).set(log);
    return true;
  } catch (error) {
    console.error('❌ Error writing audit log:', error);
    return false;
  }
}

export { writeAuditLog };
