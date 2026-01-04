# Enable Production Emails for Credit Auto-Pay Reports

## Current Status
🔒 **Development Mode Active** - All emails sent to `michael@landesman.com`

## When to Enable Production Emails
After testing period (few days) when confident the reports are accurate and formatted correctly.

## How to Enable Production Emails

### Step 1: Edit the Service File
File: `functions/backend/services/creditAutoPayReportService.js`

Find lines 237-238 in the `getCreditAutoPayEmailRecipients()` function:

**BEFORE (Development Mode):**
```javascript
if (managementEmail) {
  // DEVELOPMENT OVERRIDE: Comment out production email, use dev email
  // recipients.push(managementEmail);
  recipients.push('michael@landesman.com');
  console.log(`📧 Email recipient (dev override): michael@landesman.com`);
  console.log(`   (Production would use: ${managementEmail})`);
}
```

**AFTER (Production Mode):**
```javascript
if (managementEmail) {
  // PRODUCTION MODE: Send to actual management email
  recipients.push(managementEmail);
  // recipients.push('michael@landesman.com');  // Dev override disabled
  console.log(`📧 Email recipient: ${managementEmail}`);
}
```

### Step 2: Deploy the Change
```bash
cd /Users/michael/Projects/SAMS
firebase deploy --only functions
```

### Step 3: Verify Production Emails
1. Wait for next nightly run (3 AM Cancun time)
2. Verify emails sent to correct management emails:
   - MTC → Check MTC `managementCompany.email`
   - AVII → Check AVII `managementCompany.email`
3. Check Firestore logs: `system/creditAutoPayReports/scheduled/{date}`

### Step 4: Monitor First Production Run
- Check Firebase Console → Functions → nightlyScheduler → Logs
- Verify both MTC and AVII emails sent
- Confirm correct recipients received emails
- Check for any errors or issues

## Rollback (If Needed)
If issues arise, revert to development mode:

1. Re-comment line 237: `// recipients.push(managementEmail);`
2. Uncomment line 238: `recipients.push('michael@landesman.com');`
3. Deploy: `firebase deploy --only functions`

## Management Email Configuration

### Where Management Emails Are Stored
Firestore location: `clients/{clientId}`

Field: `managementCompany.email`

### Verify Management Emails
```javascript
// Check MTC management email
const mtcDoc = await db.collection('clients').doc('MTC').get();
console.log('MTC management email:', mtcDoc.data().managementCompany?.email);

// Check AVII management email
const aviiDoc = await db.collection('clients').doc('AVII').get();
console.log('AVII management email:', aviiDoc.data().managementCompany?.email);
```

### Update Management Emails (If Needed)
```javascript
// Update via Firebase Console or script
await db.collection('clients').doc('MTC').update({
  'managementCompany.email': 'new-email@example.com'
});
```

## Testing Checklist

Before enabling production emails:
- [ ] Verified reports are accurate (compare with Phase 1 console output)
- [ ] Confirmed HTML formatting is professional
- [ ] Validated auto-pay dates are correct (due date + grace period)
- [ ] Checked grace periods: MTC 10 days, AVII 30 days
- [ ] Verified both MTC and AVII emails send successfully
- [ ] Confirmed management email addresses are correct
- [ ] Tested for several days without issues

After enabling production emails:
- [ ] Monitor first nightly run logs
- [ ] Verify emails received by management
- [ ] Check for any bounce-backs or delivery issues
- [ ] Confirm Firestore logging works
- [ ] Validate no errors in Firebase Console

## Support

If issues arise after enabling production emails:
1. Check Firebase Console → Functions → Logs for errors
2. Check Firestore: `system/creditAutoPayReports/scheduled/{date}`
3. Verify Gmail credentials are configured in Firebase secrets
4. Check management email addresses are valid
5. Rollback to development mode if needed (see above)

---

**File Location**: `functions/backend/services/ENABLE_PRODUCTION_EMAILS.md`
**Created**: January 3, 2026
**Task**: TASK-90-PHASE2
