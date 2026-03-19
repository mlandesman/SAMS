# Sprint WA-BACKEND: WhatsApp Backend Integration

## Sprint Overview

**Goal:** Build the backend WhatsApp Cloud API integration layer — service, webhook, Firestore logging, and send endpoints — without wiring up frontend modules. The Meta Developer and WhatsApp Business Platform are already configured externally. cURL-based message sending has been verified. This sprint protects that platform investment by getting the integration code into SAMS.

**Estimated Effort:** 6-8 hours  
**GitHub Issue:** #178 (partial — backend only)  
**PRD:** `SAMS-Docs/apm_session/Agile/PRDs/PRD_WhatsApp_Integration_into_SAMS_Notifications.md`

---

## Critical Rules

1. **ES6 modules only** — `import`/`export`, never `require`/`module.exports`
2. **Use `getNow()` from DateService** — never `new Date()`
3. **No frontend changes in this sprint** — backend and config only
4. **Firebase Secrets** — all tokens/credentials stored as Firebase Secrets, never in code or environment files
5. **Feature flag** — all WhatsApp functionality gated behind a feature flag (`whatsappEnabled`)

---

## Context: External Platform Status

- **Meta Developer App:** "SAMS Notifications" — created and configured
- **WhatsApp Business Account (WABA):** Production, under Sandyland Management Systems
- **Phone Number:** Mexican number purchased and connected
- **System User Token:** Generated (permanent, for server-to-server calls)
- **cURL Test:** Verified — messages send successfully via Graph API
- **Templates:** To be submitted for Meta approval (Statement Ready, Past Due Reminder, Poll Available, Legal Notice)

---

## Task Breakdown

### WA-1: Firebase Secrets + Configuration (1h)

Store WhatsApp credentials as Firebase Secrets (not in code):

```bash
firebase functions:secrets:set WA_SYSTEM_USER_TOKEN
firebase functions:secrets:set WA_PHONE_NUMBER_ID
firebase functions:secrets:set WA_BUSINESS_ACCOUNT_ID
firebase functions:secrets:set WA_WEBHOOK_VERIFY_TOKEN
```

**Create:** `functions/backend/config/whatsappConfig.js`
- Export a function to retrieve WhatsApp config from secrets
- Include Graph API base URL (`https://graph.facebook.com/v19.0/`)
- Include feature flag check (`isFeatureEnabled('whatsappEnabled')`)

### WA-2: WhatsApp Service Module (2-3h)

**Create:** `functions/backend/services/whatsappService.js`

Core functions:
- `sendTemplateMessage({ to, templateName, language, parameters })` — send a pre-approved template message
- `sendFreeFormMessage({ to, body })` — send a text message (only within 24h session window)
- `getMessageStatus(messageId)` — query message status from Firestore
- `isOptedOut(phone)` — check if a phone number has opted out
- `markOptOut(phone, clientId)` — record an opt-out

All send functions must:
1. Check feature flag (`whatsappEnabled`)
2. Check opt-out status before sending
3. Validate phone number format (Mexican: `521XXXXXXXXXX`)
4. Call the Graph API via `fetch`
5. Log the message to Firestore (`whatsappMessages` collection)
6. Return `{ success, messageId, error }`

Error handling for known Meta errors:
- `131047` — User not opted in
- `131051` — Template not approved
- `100` — Invalid parameter
- `190` — Token invalid/expired

### WA-3: Firestore Data Model (1h)

**Collection:** `whatsappMessages/{messageId}`

```javascript
{
  messageId: string,          // wamid from Meta API response
  direction: 'outbound' | 'inbound',
  clientId: string,
  unitId: string | null,
  phone: string,              // recipient/sender phone
  templateName: string | null, // null for free-form
  language: 'en' | 'es',
  body: string | null,        // text content (free-form only)
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  error: string | null,       // error message if failed
  errorCode: number | null,   // Meta error code
  timestampQueued: timestamp,
  timestampSent: timestamp | null,
  timestampDelivered: timestamp | null,
  timestampRead: timestamp | null,
  triggeredBy: string,        // 'scheduled', 'manual', or user UID
  triggerContext: string,      // e.g., 'statement_ready', 'past_due_reminder'
  metadata: object             // flexible payload for future use
}
```

**Collection:** `system/whatsapp` (config document)
```javascript
{
  optedOutPhones: string[],   // phones that have sent STOP
  lastTemplateSync: timestamp,
  dailyMessageCount: number,
  dailyMessageDate: string    // YYYY-MM-DD, reset daily
}
```

### WA-4: Webhook Endpoint (1-2h)

**Create:** `functions/backend/controllers/whatsappWebhookController.js`  
**Route:** Register in `functions/backend/routes/` as `/api/whatsapp/webhook`

Two handlers:
1. **GET** `/api/whatsapp/webhook` — Meta verification handshake
   - Validate `hub.verify_token` against `WA_WEBHOOK_VERIFY_TOKEN`
   - Return `hub.challenge` on match

2. **POST** `/api/whatsapp/webhook` — Inbound events
   - Validate `X-Hub-Signature-256` header (HMAC SHA-256)
   - Handle message status updates: match `messageId` → update status + timestamps in Firestore
   - Handle inbound messages: check for STOP/opt-out keywords (STOP, UNSUBSCRIBE, CANCEL, BAJA, ALTO)
   - Log all inbound messages to `whatsappMessages` collection

**Security:** The webhook endpoint must NOT require Firebase Auth (Meta calls it directly). Use signature validation instead.

### WA-5: Admin Send Endpoint (1h)

**Create:** `functions/backend/controllers/whatsappController.js`  
**Route:** `POST /api/whatsapp/send` (requires admin auth)

This is a manual send endpoint for testing and future admin UI integration:
```javascript
// Body: { clientId, unitId, phone, templateName, language, parameters }
// Uses whatsappService.sendTemplateMessage()
// Returns: { success, messageId }
```

Also add: `GET /api/whatsapp/messages/:clientId` — retrieve message log for a client (paginated).

These endpoints require standard Firebase Auth + admin role.

### WA-6: Feature Flag + Testing (1h)

- Add `whatsappEnabled: false` to `system/featureFlags` Firestore document
- Test the send endpoint manually (with flag enabled in dev)
- Verify webhook handles Meta's verification challenge
- Verify message logging in Firestore
- Verify opt-out handling

---

## What This Sprint Does NOT Include

- No frontend UI changes (no admin message log view, no send buttons)
- No content template formatting (statement-specific, payment-specific message bodies)
- No module integration (SoA, UPC, Polls don't trigger WhatsApp yet)
- No automated message sending (no scheduled sends)
- No template submission to Meta for approval (done manually in Meta Business Manager)

These are all deferred to a future Sprint WA-FRONTEND.

---

## Acceptance Criteria

1. `whatsappService.sendTemplateMessage()` successfully sends via Graph API
2. All messages (sent and received) are logged in `whatsappMessages` collection
3. Webhook endpoint handles Meta verification challenge
4. Webhook endpoint processes status updates (delivered, read, failed)
5. STOP/opt-out keywords are detected and recorded
6. Feature flag gates all functionality (disabled by default)
7. Admin send endpoint works for manual testing
8. All credentials stored as Firebase Secrets (none in code)
9. Error codes from Meta are properly handled and logged

---

## Files to Create

| File | Purpose |
|------|---------|
| `functions/backend/config/whatsappConfig.js` | Credentials + config loader |
| `functions/backend/services/whatsappService.js` | Core send/status/opt-out logic |
| `functions/backend/controllers/whatsappWebhookController.js` | Webhook handlers |
| `functions/backend/controllers/whatsappController.js` | Admin send + message log endpoints |
| `functions/backend/routes/whatsapp.js` | Route definitions |

## Files to Modify

| File | Change |
|------|--------|
| `functions/index.js` | Register WhatsApp routes |
| Firestore | Add `whatsappEnabled: false` to feature flags |

---

## Pre-PR Checklist

- [ ] `bash scripts/pre-pr-checks.sh main` passes
- [ ] No `new Date()` — only `getNow()`
- [ ] ES6 modules only
- [ ] No credentials in code (all in Firebase Secrets)
- [ ] Feature flag OFF by default
- [ ] Webhook signature validation implemented
- [ ] BugBot cycle until clean
