/**
 * WhatsApp Cloud API Webhook Routes
 *
 * GET: Meta verification challenge
 * POST: Validates X-Hub-Signature-256, awaits processing, then always 200 on valid signed payloads
 * (Meta retries non-200 for days — 500 caused duplicate whatsappWebhookEvents / messages).
 *
 * Task: WA-BACKEND-1 (WhatsApp Webhook)
 */

import { Router } from 'express';
import { getDb } from '../firebase.js';
import {
  verifyWebhookChallenge,
  verifyMetaWebhookSignature,
  parseInboundMessages,
  parseStatusUpdates,
  detectOptOut,
  buildUserPhoneLookupMap,
  matchPhoneInLookupMap,
  writeRawWebhookEvent,
  writeNormalizedMessage,
  applyOptOut,
  normalizePhone,
} from '../utils/whatsappWebhookUtils.js';
import { logInfo, logWarn, logError } from '../../shared/logger.js';

const router = Router();

/**
 * GET /whatsapp-webhook - Meta webhook verification
 */
router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const result = verifyWebhookChallenge(mode, token, challenge, expectedToken);

  if (!result.valid) {
    return res.status(403).end();
  }
  res.status(200).type('text/plain').send(result.challenge);
});

/**
 * POST /whatsapp-webhook - Inbound messages and status updates
 */
router.post('/', async (req, res) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    logError('WhatsApp webhook: WHATSAPP_APP_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook misconfigured' });
  }

  const rawBody = req.rawBody;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    logWarn('WhatsApp webhook: missing raw body (cannot verify signature)');
    return res.status(403).end();
  }

  const sigHeader = req.get('x-hub-signature-256');
  if (!verifyMetaWebhookSignature(rawBody, sigHeader, appSecret)) {
    logWarn('WhatsApp webhook: signature verification failed');
    return res.status(403).end();
  }

  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    logWarn('WhatsApp webhook: empty or invalid POST body');
    return res.status(200).end();
  }

  if (payload.object !== 'whatsapp_business_account') {
    logWarn('WhatsApp webhook: unexpected object type', { object: payload.object });
    return res.status(200).end();
  }

  try {
    await processWebhookPayload(payload);
  } catch (err) {
    // Always ack 200 after verify — Meta retries 4xx/5xx for days; partial writes + retries duplicate raw events.
    logError('WhatsApp webhook processing failed (acked 200 to Meta)', {
      error: err.message,
      stack: err.stack,
    });
  }
  return res.status(200).end();
});

function buildStatusRecord(st) {
  const ts = st.timestamp ? new Date(parseInt(st.timestamp, 10) * 1000) : null;
  const status = st.status || '';
  return {
    messageId: st.messageId,
    direction: 'outbound',
    phone: st.recipientId,
    waId: st.recipientId,
    text: null,
    type: 'status',
    status,
    timestampSent: status === 'sent' || status === 'failed' ? ts : null,
    timestampDelivered: status === 'delivered' || status === 'read' ? ts : null,
    timestampRead: status === 'read' ? ts : null,
    userId: null,
    fullName: null,
    optOutDetected: false,
    conversation: st.conversation,
    pricing: st.pricing,
    error: st.error,
  };
}

/**
 * Process webhook payload: parse, persist, match phones, detect opt-out.
 */
async function processWebhookPayload(payload) {
  const db = await getDb();
  const phoneLookup = await buildUserPhoneLookupMap(db);
  let rawEventId = null;
  try {
    rawEventId = await writeRawWebhookEvent(payload, 'webhook_post', db);
  } catch (err) {
    logError('WhatsApp webhook: writeRawWebhookEvent failed (continuing; normalized rows may lack rawEventRef)', {
      error: err.message,
    });
  }

  const entries = payload.entry || [];
  let messageCount = 0;
  let statusCount = 0;
  let writeFailures = 0;

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const field = change.field;
      const value = change.value;

      if ((field === 'messages' || field === 'message_status') && value) {
        if (field === 'messages') {
          const inboundMessages = parseInboundMessages(value);
          for (const msg of inboundMessages) {
            messageCount++;
            const phoneNorm = normalizePhone(msg.waId || msg.from);
            const match = matchPhoneInLookupMap(phoneNorm, phoneLookup);
            const optOutDetected = detectOptOut(msg.text);

            const record = {
              messageId: msg.messageId,
              direction: 'inbound',
              phone: msg.from,
              waId: msg.waId,
              text: msg.text,
              type: msg.type,
              status: null,
              timestampSent: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : null,
              timestampDelivered: null,
              timestampRead: null,
              userId: match?.userId || null,
              fullName: match?.fullName || null,
              optOutDetected,
            };

            try {
              await writeNormalizedMessage(record, rawEventId, db);
            } catch (err) {
              writeFailures++;
              logError('WhatsApp webhook: writeNormalizedMessage failed (inbound, continuing batch)', {
                messageId: msg.messageId,
                error: err.message,
              });
            }

            // Still attempt opt-out if detected (compliance); applyOptOut has internal error handling
            if (optOutDetected && match?.userId) {
              await applyOptOut(match.userId, db);
            }
          }
        }

        const statuses = parseStatusUpdates(value);
        for (const st of statuses) {
          statusCount++;
          const record = buildStatusRecord(st);
          try {
            await writeNormalizedMessage(record, rawEventId, db);
          } catch (err) {
            writeFailures++;
            logError('WhatsApp webhook: writeNormalizedMessage failed (status, continuing batch)', {
              messageId: st.messageId,
              status: st.status,
              error: err.message,
            });
          }
        }
      } else if (field) {
        logInfo('WhatsApp webhook: unhandled change field', { field });
      }
    }
  }

  logInfo('WhatsApp webhook POST processed', {
    entries: entries.length,
    messages: messageCount,
    statuses: statusCount,
    writeFailures,
  });
}

export default router;
