---
agent: Implementation_Agent
task_ref: WA-BACKEND-1
status: Completed
ad_hoc_delegation: false
compatibility_issues: false
important_findings: true
---

# Task Log: WA-BACKEND-1 — WhatsApp Webhook

## Summary

Implemented the WhatsApp Cloud API webhook for SAMS: single `/whatsapp-webhook` endpoint (GET for Meta verification, POST with **X-Hub-Signature-256** validation using `WHATSAPP_APP_SECRET`). Events are parsed, persisted to Firestore (`whatsappWebhookEvents`, `whatsappMessages`), phones matched via **one users scan per webhook batch** (lookup map), STOP/opt-out updates `notifications.sms`. POST **awaits** processing before 200 to avoid Cloud Functions background truncation.

## Details

- **Helpers** (`functions/backend/utils/whatsappWebhookUtils.js`): `verifyWebhookChallenge`, `verifyMetaWebhookSignature`, `parseInboundMessages`, `parseStatusUpdates`, `detectOptOut`, `buildUserPhoneLookupMap`, `matchPhoneInLookupMap`, `writeRawWebhookEvent`, `writeNormalizedMessage`, `applyOptOut`, `normalizePhone`
- **Routes**: GET challenge; POST requires raw body + valid HMAC; 403 on bad/missing signature; 503 if `WHATSAPP_APP_SECRET` unset
- **Raw body**: `express.json` `verify` in `functions/backend/index.js` sets `req.rawBody` for paths ending `/whatsapp-webhook`
- **Secrets** (Firebase / `.env`, **never commit values**): `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (Meta App Secret from app dashboard)
- **Status timestamps**: `buildStatusRecord` sets `timestampSent` for `sent`/`failed`, `timestampDelivered` for `delivered`/`read`, `timestampRead` for `read`
- **Firebase Hosting**: Rewrites for `/whatsapp-webhook` (desktop + mobile)

## Output

### Files Created / Modified
- `functions/backend/utils/whatsappWebhookUtils.js`, `functions/backend/routes/whatsappWebhookRoutes.js`, `functions/backend/routes/whatsappWebhookTestPayloads.json` (placeholders only)
- `functions/backend/index.js` — raw body capture for webhook
- `functions/index.js` — secrets: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`

### Firestore Collections
- `whatsappWebhookEvents`, `whatsappMessages` (unchanged purpose)

## Test Results

- **GET verification**: Use `hub.verify_token=<value from secret WHATSAPP_VERIFY_TOKEN>` (do not document actual value in git)
- **POST**: Requires `X-Hub-Signature-256: sha256=<hmac>` over exact raw JSON bytes using `WHATSAPP_APP_SECRET`
- Local: set both env vars; compute HMAC for curl body or use Meta’s delivery

## Issues

None

## Important Findings

- **Deploy:** Run `firebase functions:secrets:set WHATSAPP_APP_SECRET` with Meta App Secret (App settings → Basic). Redeploy `api` after binding the secret.
- **BugBot follow-ups addressed:** signature validation, await-before-response, no plaintext verify token in repo docs, single phone lookup per batch, `sent` status timestamp.

## Next Steps

1. Set `WHATSAPP_APP_SECRET` in Firebase; deploy functions + hosting
2. Meta Console: callback URL + verify token from secrets only
3. Regression test inbound message, STOP, outbound status
