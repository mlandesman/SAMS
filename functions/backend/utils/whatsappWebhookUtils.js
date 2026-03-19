/**
 * WhatsApp Cloud API Webhook Utilities
 *
 * Modular helpers for parsing, matching, and persisting webhook events.
 * Task: WA-BACKEND-1 (WhatsApp Webhook)
 */

import crypto from 'crypto';
import { getNow } from '../services/DateService.js';
import { logInfo, logWarn, logError } from '../../shared/logger.js';
import { getDisplayNameFromUser, getPhoneFromUser } from './unitContactUtils.js';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'baja', 'alto'];

/**
 * Normalize phone to E.164-like form for matching (digits only, optional + prefix)
 * @param {string} phone - Raw phone from webhook
 * @returns {string} Normalized phone (digits only)
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  return digits || '';
}

/**
 * Verify Meta webhook challenge (GET)
 * @param {string} mode - hub.mode
 * @param {string} token - hub.verify_token
 * @param {string} challenge - hub.challenge
 * @param {string} expectedToken - From WHATSAPP_VERIFY_TOKEN secret
 * @returns {{ valid: boolean, challenge?: string }}
 */
/**
 * Verify Meta webhook POST signature (X-Hub-Signature-256).
 * @param {Buffer} rawBody - Exact request body bytes Meta signed
 * @param {string|undefined} signatureHeader - X-Hub-Signature-256 header value
 * @param {string} appSecret - Meta App Secret (Firebase secret WHATSAPP_APP_SECRET)
 * @returns {boolean}
 */
export function verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || typeof appSecret !== 'string' || !signatureHeader || !Buffer.isBuffer(rawBody)) {
    return false;
  }
  const sig = String(signatureHeader).trim();
  const prefix = 'sha256=';
  if (!sig.startsWith(prefix)) {
    return false;
  }
  const receivedHex = sig.slice(prefix.length);
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (receivedHex.length !== expectedHex.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  } catch {
    return false;
  }
}

export function verifyWebhookChallenge(mode, token, challenge, expectedToken) {
  if (mode !== 'subscribe') {
    logWarn('WhatsApp webhook: invalid hub.mode', { mode });
    return { valid: false };
  }
  if (!expectedToken || token !== expectedToken) {
    logWarn('WhatsApp webhook: verify token mismatch');
    return { valid: false };
  }
  if (!challenge) {
    logWarn('WhatsApp webhook: missing hub.challenge');
    return { valid: false };
  }
  logInfo('WhatsApp webhook: verification successful');
  return { valid: true, challenge };
}

/**
 * Parse inbound user messages from webhook value
 * @param {object} value - value from changes[].value
 * @returns {Array<object>} Normalized message objects
 */
export function parseInboundMessages(value) {
  const messages = value?.messages || [];
  const contacts = (value?.contacts || []).reduce((acc, c) => {
    if (c?.wa_id) acc[c.wa_id] = c;
    return acc;
  }, {});

  return messages.map((msg) => {
    const contact = contacts[msg.from] || {};
    const profile = contact.profile || {};
    return {
      messageId: msg.id,
      from: msg.from,
      waId: msg.from,
      timestamp: msg.timestamp,
      type: msg.type || 'unknown',
      text: msg.text?.body || msg.caption || '',
      profileName: profile.name || '',
    };
  });
}

/**
 * Parse outbound status updates from webhook value
 * @param {object} value - value from changes[].value
 * @returns {Array<object>} Normalized status objects
 */
export function parseStatusUpdates(value) {
  const statuses = value?.statuses || [];
  return statuses.map((s) => ({
    messageId: s.id,
    recipientId: s.recipient_id,
    status: s.status || 'unknown',
    timestamp: s.timestamp,
    conversation: s.conversation || null,
    pricing: s.pricing || null,
    error: s.errors?.[0] || null,
  }));
}

/**
 * Strip leading/trailing punctuation and odd whitespace so "STOP.", "STOP!", "…baja" match keywords.
 * @param {string} s
 * @returns {string}
 */
export function normalizeOptOutText(s) {
  let t = s.trim().toLowerCase();
  // Trailing: periods, bangs, commas, CJK/full stops, ellipsis, etc.
  t = t.replace(/[\s\u00A0.!?…,;:。、，]+$/gu, '').trim();
  t = t.replace(/^[\s\u00A0.!?…,;:。、，]+/gu, '').trim();
  return t;
}

/**
 * First whitespace-delimited token with non-letter/digit stripped from both ends (handles "UNSUBSCRIBE,").
 * @param {string} text
 * @returns {string}
 */
export function firstWordForOptOut(text) {
  const raw = (text.trim().toLowerCase().split(/\s+/)[0] || '');
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Detect STOP/opt-out keywords (case-insensitive)
 * @param {string} text - Message text
 * @returns {boolean}
 */
export function detectOptOut(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = normalizeOptOutText(text);
  if (!normalized) return false;
  if (OPT_OUT_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(`${kw} `))) {
    return true;
  }
  const firstToken = firstWordForOptOut(text);
  return OPT_OUT_KEYWORDS.some((kw) => firstToken === kw);
}

/**
 * One Firestore scan per webhook batch: map normalized phone digits -> { userId, fullName }.
 * First user wins if duplicate phones exist; logs a warning on collision.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Map<string, { userId: string, fullName: string }>>}
 */
export async function buildUserPhoneLookupMap(db) {
  const map = new Map();
  if (!db) return map;

  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const userPhone = getPhoneFromUser(data);
    if (!userPhone) continue;

    const userPhoneNorm = normalizePhone(userPhone);
    if (!userPhoneNorm) continue;

    const fullName = getDisplayNameFromUser(data);
    const entry = { userId: doc.id, fullName };

    if (map.has(userPhoneNorm)) {
      logWarn('WhatsApp phone lookup: duplicate profile.phone after normalize; keeping first user', {
        phoneNorm: userPhoneNorm,
        keptUserId: map.get(userPhoneNorm).userId,
        skippedUserId: doc.id,
      });
      continue;
    }
    map.set(userPhoneNorm, entry);
  }
  return map;
}

/**
 * @param {string} normalizedPhone
 * @param {Map<string, { userId: string, fullName: string }>} lookupMap
 * @returns {{ userId: string, fullName: string } | null}
 */
export function matchPhoneInLookupMap(normalizedPhone, lookupMap) {
  if (!normalizedPhone || !lookupMap) return null;
  return lookupMap.get(normalizedPhone) || null;
}

/**
 * Write raw webhook POST payload to Firestore
 * @param {object} payload - Raw JSON body
 * @param {string} eventType - Stored on raw doc (e.g. 'webhook_post')
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<string>} Document ID
 */
export async function writeRawWebhookEvent(payload, eventType, db) {
  const ref = await db.collection('whatsappWebhookEvents').add({
    eventType,
    rawPayload: payload,
    timestampReceived: getNow(),
    createdAt: getNow(),
  });
  return ref.id;
}

/**
 * Write normalized message/status to whatsappMessages
 * @param {object} record - Normalized record
 * @param {string|null} rawEventId - Reference to whatsappWebhookEvents doc
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<string>} Document ID
 */
export async function writeNormalizedMessage(record, rawEventId, db) {
  const doc = {
    ...record,
    rawEventRef: rawEventId ? db.doc(`whatsappWebhookEvents/${rawEventId}`) : null,
    timestampCreated: getNow(),
  };
  const ref = await db.collection('whatsappMessages').add(doc);
  return ref.id;
}

/**
 * Update user notifications.sms to false (opt-out)
 * @param {string} userId
 * @param {FirebaseFirestore.Firestore} db
 */
export async function applyOptOut(userId, db) {
  if (!userId || !db) return;
  try {
    await db.collection('users').doc(userId).update({
      'notifications.sms': false,
    });
    logInfo('WhatsApp opt-out applied', { userId });
  } catch (err) {
    logError('WhatsApp opt-out update failed', { userId, error: err.message });
  }
}
