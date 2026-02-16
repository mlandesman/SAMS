/**
 * Error Capture Service — Firestore-backed error persistence for System Error Monitor
 * Writes error records to systemErrors collection; used by logger sink and API routes.
 */

import admin from 'firebase-admin';
import { getNow } from './DateService.js';
import { logInfo } from '../../shared/logger.js';

const DETAILS_MAX_LEN = 2000;
const MESSAGE_MAX_LEN = 500;

/**
 * Extract module from message for categorization
 * @param {string} message
 * @returns {string}
 */
function extractModule(message) {
  const m = String(message).toLowerCase();
  if (m.includes('email') || m.includes('transporter')) return 'email';
  if (m.includes('statement') || m.includes('soa')) return 'statement';
  if (m.includes('upc') || m.includes('payment')) return 'payment';
  if (m.includes('water')) return 'water';
  if (m.includes('budget')) return 'budget';
  if (m.includes('auth') || m.includes('token')) return 'auth';
  return 'general';
}

/**
 * Format details from meta (stack trace or stringified object)
 * @param {any} meta
 * @returns {string}
 */
function formatDetails(meta) {
  if (!meta) return '';
  if (meta instanceof Error && meta.stack) {
    return String(meta.stack).substring(0, DETAILS_MAX_LEN);
  }
  if (typeof meta === 'object') {
    try {
      return JSON.stringify(meta).substring(0, DETAILS_MAX_LEN);
    } catch {
      return String(meta).substring(0, DETAILS_MAX_LEN);
    }
  }
  return String(meta).substring(0, DETAILS_MAX_LEN);
}

/**
 * Create an error sink function for Firestore.
 * Returns a function suitable for registerErrorSink().
 * Fire-and-forget: catches its own errors, never throws.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Function} Sink callback receiving { message, meta, timestamp }
 */
export function createErrorSinkForFirestore(db) {
  return async function sink({ message, meta, timestamp }) {
    try {
      const doc = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: 'backend',
        module: extractModule(message),
        level: 'error',
        message: String(message).substring(0, MESSAGE_MAX_LEN),
        details: formatDetails(meta),
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null
      };
      const ref = await db.collection('systemErrors').add(doc);
      logInfo('📥 Backend error captured', { id: ref.id, module: doc.module });
    } catch (err) {
      console.error('[ErrorCaptureService] Failed to write error to Firestore:', err.message);
    }
  };
}

/**
 * Get unacknowledged errors, ordered by timestamp desc
 * @param {FirebaseFirestore.Firestore} db
 * @param {number} limit
 * @returns {Promise<Array<{id: string, ...}>>}
 */
export async function getUnacknowledgedErrors(db, limit = 50) {
  const snapshot = await db.collection('systemErrors')
    .where('acknowledged', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Acknowledge a single error
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} errorId
 * @param {string} userId
 */
export async function acknowledgeError(db, errorId, userId) {
  await db.collection('systemErrors').doc(errorId).update({
    acknowledged: true,
    acknowledgedBy: userId,
    acknowledgedAt: getNow()
  });
}

/**
 * Acknowledge all unacknowledged errors
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId
 * @returns {Promise<number>} Count of acknowledged documents
 */
export async function acknowledgeAllErrors(db, userId) {
  const snapshot = await db.collection('systemErrors')
    .where('acknowledged', '==', false)
    .get();

  const batch = db.batch();
  const now = getNow();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      acknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: now
    });
  });
  await batch.commit();
  return snapshot.size;
}

/**
 * Get count of unacknowledged errors
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<number>}
 */
export async function getUnacknowledgedErrorCount(db) {
  const snapshot = await db.collection('systemErrors')
    .where('acknowledged', '==', false)
    .count()
    .get();
  return snapshot.data().count;
}
