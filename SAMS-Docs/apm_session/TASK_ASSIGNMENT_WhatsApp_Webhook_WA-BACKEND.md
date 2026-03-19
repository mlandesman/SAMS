---
memory_log_path: /Users/michael/Projects/SAMS/SAMS-Docs/apm_session/Memory/Task_Completion_Logs/WhatsApp_Webhook_WA-BACKEND_2026-03-19.md
sprint_id: WA-BACKEND
sprint_name: WhatsApp Backend Integration
issue: "178"
---

# Task Assignment: WhatsApp Webhook (Sprint WA-BACKEND)

**Task ID:** WA-BACKEND-1  
**Sprint:** WA-BACKEND — WhatsApp Backend Integration  
**Issue:** #178 (partial)  
**Priority:** Medium  
**Estimate:** 6–8 hours  
**Branch:** `feature/whatsapp-webhook`

---

## Objective

Build the first working WhatsApp Cloud API webhook for SAMS to:
1. Receive inbound user messages from Meta
2. Receive outbound message status updates
3. Log everything in Firestore
4. Prove whether phone-to-business messages reach Meta and our backend
5. Support STOP / opt-out detection for compliance

**Scope:** Inbound webhook and status logging only. Do NOT rebuild outbound sending. Do NOT change the existing WhatsApp token flow.

---

## Production Configuration (Known)

| Item | Value |
|------|-------|
| Business Portfolio | Sandyland Management Systems |
| App | Sandyland WA Production App |
| Production phone | +52 984 156 6006 |
| Phone Number ID | 969950456204182 |
| Status | WhatsApp Business Account connected and approved; outbound cURL works; inbound not processed (no webhook) |
| App mode | Development (will move to Live after webhook verification) |

---

## Build Requirements

### 1. Firebase HTTPS Webhook Endpoint

Create **one** endpoint supporting both GET and POST. Use path `/whatsapp-webhook` (no `/api/` prefix — see Firebase Hosting Route Requirements).

**GET behavior (Meta verification challenge):**
- Read `hub.mode`, `hub.verify_token`, `hub.challenge` from query params
- Compare `hub.verify_token` against secret (see §7)
- If valid: return `hub.challenge` as plain text, HTTP 200
- If invalid: return 403

**POST behavior:**
- Accept WhatsApp webhook payloads from Meta
- Log raw payload for debugging
- Return HTTP 200 immediately after receipt (do not block on processing)
- Do not fail on unknown event types — handle gracefully

### 2. Parse and Classify Webhook Events

Support at minimum:
- **Inbound user messages:** `from`, `message id`, `timestamp`, `text body`, `message type`, `profile name`, `wa_id`
- **Outbound status updates:** `message id`, `recipient id`, `status` (sent/delivered/read/failed), `timestamp`, `conversation metadata`, `pricing metadata`, `error` if present

### 3. Firestore Structure

| Collection | Purpose |
|------------|---------|
| `whatsappWebhookEvents` | Raw webhook POST payloads with timestamp and event type |
| `whatsappMessages` | Normalized message/status records |

**whatsappMessages suggested fields:**
- `messageId`, `direction` (inbound|outbound), `phone`, `waId`, `text`, `type`, `status`
- `timestampCreated`, `timestampSent`, `timestampDelivered`, `timestampRead`
- `rawEventRef` (reference to whatsappWebhookEvents doc)
- `clientId`, `unitId` (if matched)
- `optOutDetected` (boolean)

### 4. Phone Number Matching

- Normalize incoming phone (e.g. E.164)
- Attempt to match to a user in SAMS (users have `profile.phone` — see `functions/backend/utils/unitContactUtils.js`)
- If found: store `clientId`, `unitId` (or equivalent references) on the message
- If not found: still log the message
- **Do not block** processing if no match exists

**SAMS data model note:** Users are in `users` collection; `profile.phone` holds phone. Unit owners/managers reference users via `userId`. For matching, query users by normalized phone. With small user counts, fetching users and filtering in memory is acceptable; document if a different approach is used.

### 5. STOP / Opt-Out Detection

Detect case-insensitive keywords: `STOP`, `UNSUBSCRIBE`, `CANCEL`, `BAJA`, `ALTO`

When detected:
- Set `optOutDetected = true` on the message log
- If phone matched to a user: update `users/{userId}.notifications.sms = false` (use dot notation or nested update so existing `notifications` object is preserved)
- If no match: still log the message with `optOutDetected = true` (no user doc to update)
- Do not auto-reply yet (structure code so confirmation reply can be added later)
- **Note:** Profile update code may currently allow editing this field; deny access in a future change

### 6. Structured Logging

Log (concise, no spam):
- Webhook verification attempts
- Inbound POST received
- Count of entries/messages/statuses parsed
- Firestore write success/failure
- Detected STOP events
- Phone matching result
- Parsing errors

Use `functions/shared/logger.js` (logInfo, logWarn, logError). Do not expose secrets in logs.

### 7. Security

- Verify token from Firebase secret or env (not hardcoded)
- **POST:** Validate `X-Hub-Signature-256` (HMAC-SHA256 of **raw** request body) using Meta **App Secret** stored as Firebase secret `WHATSAPP_APP_SECRET` (reject unsigned/invalid signatures with 403)
- Capture raw body for signature verification (e.g. `express.json` `verify` callback); do not verify against re-serialized JSON
- Do not hardcode auth tokens or commit secret values in docs/repo
- Await processing before ending the response so Cloud Functions completes Firestore work (Meta timeout allows several seconds)
- Add `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` to `functions/index.js` secrets array (alongside GMAIL_APP_PASSWORD, etc.)

### 8. Modular Implementation

Separate logic into small functions:
- `verifyWebhookChallenge`
- `verifyMetaWebhookSignature`
- `parseInboundMessages`
- `parseStatusUpdates`
- `writeRawWebhookEvent`
- `writeNormalizedMessage`
- `detectOptOut`
- `buildUserPhoneLookupMap` / `matchPhoneInLookupMap`

---

## SAMS Engineering Requirements

### Firebase Hosting (CRITICAL)

Per `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/Firebase_Hosting_Route_Requirements.md`:

- Add Express route: `app.use('/whatsapp-webhook', whatsappWebhookRoutes)` — mount with **public** routes (no auth)
- Add to `firebase.json` for **both** desktop and mobile hosting targets:
  - `{ "source": "/whatsapp-webhook", "function": "api" }`
  - `{ "source": "/whatsapp-webhook/**", "function": "api" }`
- Meta will POST to `https://sams.sandyland.com.mx/whatsapp-webhook` (production)

### Feature Flag

No feature flag required for this webhook. (Per PO: app is invitation-only.)

### Branch & PR

- Branch: `feature/whatsapp-webhook`
- Before final PR: merge/rebase main into feature branch
- Run `bash scripts/pre-pr-checks.sh main` before PR

---

## Deliverables

1. Firebase function(s) and helper module(s)
2. Instructions for Meta callback URL: exact URL to paste
3. Verify token: **You create this** — it is NOT the bearer token. Choose any secure string (e.g. `sams-wa-verify-2026` or a UUID), store in Firebase secret `WHATSAPP_VERIFY_TOKEN`, and enter the same value in Meta Developer Console when configuring the webhook. Meta sends it during GET verification; your backend compares and returns the challenge only if it matches.
4. Firestore collection structure created
5. One or two sample test payloads or local test instructions
6. Brief deployment steps

---

## Acceptance Criteria

- [ ] Meta webhook verification works (GET returns challenge)
- [ ] Phone-to-business WhatsApp message hits webhook and is stored
- [ ] Raw payload in `whatsappWebhookEvents`
- [ ] Normalized inbound message in `whatsappMessages`
- [ ] STOP message detected and logged correctly
- [ ] Outbound message status updates captured and stored
- [ ] Logs clearly show message flow from Meta to SAMS

---

## Post-Implementation Handover

Provide Michael with:
1. Exact deployed webhook URL for Meta: `https://sams.sandyland.com.mx/whatsapp-webhook`
2. Verify token: value stored in `WHATSAPP_VERIFY_TOKEN` secret (same value must be entered in Meta)
3. Test plan: (a) normal inbound message, (b) STOP, (c) outbound message + status events

---

## Manual Steps: Meta Webhook Configuration (For Michael — After Code Is Deployed)

**Prerequisite:** Webhook code deployed and live at `https://sams.sandyland.com.mx/whatsapp-webhook`

1. **Open Meta Developer Console**
   - Go to https://developers.facebook.com/
   - Select app: **Sandyland WA Production App** (or the production WhatsApp app)
   - In left sidebar: **WhatsApp** → **Configuration** (or **API Setup**)

2. **Add Webhook**
   - Find the **Webhook** section
   - Click **Edit** or **Configure** next to "Callback URL"
   - **Callback URL:** `https://sams.sandyland.com.mx/whatsapp-webhook`
   - **Verify token:** Enter the exact value stored in Firebase secret `WHATSAPP_VERIFY_TOKEN`
     - To view the secret: `firebase functions:secrets:access WHATSAPP_VERIFY_TOKEN` (or check your notes from when you set it)
   - Click **Verify and save**
   - Meta sends a GET request to your URL; if your backend returns the challenge correctly, verification succeeds

3. **Subscribe to Webhook Fields**
   - After verification, expand **Webhook fields** (or similar)
   - Subscribe to at minimum:
     - `messages` — inbound user messages
     - `message_status` — outbound message status updates (sent, delivered, read, failed)
   - Save

4. **Verify**
   - Send a test message from your phone to the business number (+52 984 156 6006)
   - Check Firestore `whatsappWebhookEvents` and `whatsappMessages` for new documents
   - Check Cloud Functions logs for webhook activity

---

## Reference Documents

- Feature Flag Requirements: `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/Feature_Flag_Requirements.md`
- Firebase Hosting Route Requirements: `/Users/michael/Projects/SAMS/SAMS-Docs/SAMS Guides/Firebase_Hosting_Route_Requirements.md`
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- unitContactUtils (phone from users): `functions/backend/utils/unitContactUtils.js`

---

**Created:** 2026-03-19  
**Manager Agent:** APM Manager Agent
