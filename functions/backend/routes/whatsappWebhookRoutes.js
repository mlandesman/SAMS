/**
 * WhatsApp Cloud API Webhook Routes
 *
 * GET: Meta verification challenge
 * POST: Inbound messages and status updates (returns 200 immediately, processes async)
 *
 * Task: WA-BACKEND-1 (WhatsApp Webhook)
 */

import { Router } from 'express';
import { getDb } from '../firebase.js';
import {
  verifyWebhookChallenge,
  parseInboundMessages,
  parseStatusUpdates,
  detectOptOut,
  matchPhoneToUser,
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
 * Returns 200 immediately; processes payload asynchronously.
 */
router.post('/', async (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    logWarn('WhatsApp webhook: empty or invalid POST body');
    return res.status(200).end();
  }

  if (payload.object !== 'whatsapp_business_account') {
    logWarn('WhatsApp webhook: unexpected object type', { object: payload.object });
    return res.status(200).end();
  }

  // Return 200 immediately per Meta requirements
  res.status(200).end();

  // Process asynchronously (fire-and-forget)
  void processWebhookPayload(payload).catch((err) => {
    logError('WhatsApp webhook processing failed', { error: err.message, stack: err.stack });
  });
});

function buildStatusRecord(st) {
  const ts = st.timestamp ? new Date(parseInt(st.timestamp, 10) * 1000) : null;
  return {
    messageId: st.messageId,
    direction: 'outbound',
    phone: st.recipientId,
    waId: st.recipientId,
    text: null,
    type: 'status',
    status: st.status,
    timestampSent: null,
    timestampDelivered: st.status === 'delivered' || st.status === 'read' ? ts : null,
    timestampRead: st.status === 'read' ? ts : null,
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
  const entries = payload.entry || [];
  let messageCount = 0;
  let statusCount = 0;

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const field = change.field;
      const value = change.value;

      if ((field === 'messages' || field === 'message_status') && value) {
        const rawEventId = await writeRawWebhookEvent(payload, field, db);

        if (field === 'messages') {
          const inboundMessages = parseInboundMessages(value);
          for (const msg of inboundMessages) {
            messageCount++;
            const phoneNorm = normalizePhone(msg.waId || msg.from);
            const match = await matchPhoneToUser(phoneNorm, db);
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

            await writeNormalizedMessage(record, rawEventId, db);

            if (optOutDetected && match?.userId) {
              await applyOptOut(match.userId, db);
            }
          }
        }

        const statuses = parseStatusUpdates(value);
        for (const st of statuses) {
          statusCount++;
          const record = buildStatusRecord(st);
          await writeNormalizedMessage(record, rawEventId, db);
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
  });
}

export default router;
