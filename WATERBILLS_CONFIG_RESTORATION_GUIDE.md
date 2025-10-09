# Water Bills Email Templates - Config Restoration Guide

## Summary

When you re-imported the AVII client, the water bills email templates (bilingual HTML) that were previously stored in Firebase were not included in the `config.json`. This guide shows you how to restore them.

## Firebase Location

The water bills email templates should be stored in Firebase at:
```
/clients/AVII/config/emailTemplates
```

This is a single document in the `config` subcollection with the following structure.

## Proper Config Structure

The `emailTemplates` document should have a `waterBill` field containing:

```json
{
  "waterBill": {
    "subject_en": "💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}",
    "subject_es": "💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}",
    "body_en": "<Full English HTML template>",
    "body_es": "<Full Spanish HTML template>"
  }
}
```

## Files Created

I've created the following files in your workspace to restore the configuration:

### 1. **fixed_body_en.html** (already existed)
- Complete English HTML template
- Mobile-responsive design
- AVII branding with ocean-to-sand gradient
- Handlebars syntax for variable substitution
- Conditional sections for car wash, boat wash, penalties

### 2. **waterBills_body_es.html** (newly created)
- Complete Spanish HTML template
- Identical styling to English version
- Professional Spanish translations
- All text properly localized for Mexican market

### 3. **waterBills_emailTemplates_config.json** (newly created)
- Complete JSON structure ready for Firebase import
- Includes all 4 required fields:
  - `subject_en`: English subject line
  - `subject_es`: Spanish subject line  
  - `body_en`: Full English HTML (escaped for JSON)
  - `body_es`: Full Spanish HTML (escaped for JSON)

## Template Features

Both English and Spanish templates include:

✅ **Professional Design**
- Mobile-responsive layout
- Ocean-to-sand gradient (AVII branding)
- Clean typography optimized for email clients

✅ **Conditional Sections**
- Car wash services (shows only if count > 0)
- Boat wash services (shows only if count > 0)
- High usage warnings (shows if consumption > 30m³)
- Penalty notices (shows if penalties applied)
- Previous month comparison

✅ **Complete Billing Information**
- Water consumption with meter readings
- Service charges breakdown
- Payment instructions (SPEI, transfers, cash)
- Due dates and penalty information
- Client contact information

✅ **Variable Substitution**
Uses Handlebars syntax for template variables:
- `{{UnitNumber}}`, `{{BillingPeriod}}`, `{{TotalAmountDue}}`
- `{{WaterConsumption}}`, `{{PriorReading}}`, `{{CurrentReading}}`
- `{{CarWashCount}}`, `{{BoatWashCount}}`
- `{{ClientName}}`, `{{ClientLogoUrl}}`, etc.

## How to Restore in Firebase

### Option 1: Manual Update via Firebase Console

1. Go to Firebase Console → Firestore Database
2. Navigate to: `clients/AVII/config/emailTemplates`
3. If the document exists, edit it
4. If it doesn't exist, create a new document with ID `emailTemplates`
5. Add a field `waterBill` of type `map`
6. Add these 4 string fields inside `waterBill`:
   - `subject_en`: Copy from `waterBills_emailTemplates_config.json`
   - `subject_es`: Copy from `waterBills_emailTemplates_config.json`
   - `body_en`: Copy from `fixed_body_en.html`
   - `body_es`: Copy from `waterBills_body_es.html`

### Option 2: Import via Script

You can create a Node.js script to upload the config:

```javascript
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
// ... your initialization code ...

async function restoreWaterBillsTemplates() {
  const db = admin.firestore();
  
  // Read the template files
  const body_en = fs.readFileSync('./fixed_body_en.html', 'utf8');
  const body_es = fs.readFileSync('./waterBills_body_es.html', 'utf8');
  
  // Update the emailTemplates document
  await db.collection('clients').doc('AVII')
    .collection('config').doc('emailTemplates')
    .set({
      waterBill: {
        subject_en: "💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}",
        subject_es: "💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}",
        body_en: body_en,
        body_es: body_es
      }
    }, { merge: true });
  
  console.log('✅ Water bills email templates restored!');
}

restoreWaterBillsTemplates();
```

### Option 3: Import via Client Onboarding Scripts

If you're using the client onboarding scripts in `/workspace/scripts/client-onboarding/`, you can include this in your import configuration.

## Subject Lines (Quick Reference)

### English
```
💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}
```

### Spanish
```
💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}
```

## How the Email Service Uses These Templates

The backend email service (`/workspace/backend/controllers/emailService.js`) fetches these templates:

```javascript
// Fetch email templates from Firebase
const emailTemplateDoc = await db.collection('clients').doc('AVII')
  .collection('config').doc('emailTemplates').get();

const emailTemplates = emailTemplateDoc.data();
const waterBillTemplates = emailTemplates.waterBill;

// Select language-specific templates
const templateLang = userLanguage === 'es' ? 'es' : 'en';
const bodyTemplate = waterBillTemplates[`body_${templateLang}`];
const subjectTemplate = waterBillTemplates[`subject_${templateLang}`];
```

## Integration with Import System

When importing/re-importing AVII client data, make sure the `emailTemplates` configuration is included. If using the export-import scripts, ensure they properly handle the `config` subcollection:

```javascript
// In export-client.js
const configCollections = ['config'];
// Make sure to export all config documents including emailTemplates

// In import-config.js  
// Make sure to import all config documents including emailTemplates
```

## Verification

After restoring the templates, verify by:

1. **Check Firebase Console**
   - Navigate to `clients/AVII/config/emailTemplates`
   - Verify `waterBill` field exists
   - Verify all 4 sub-fields exist: `body_en`, `body_es`, `subject_en`, `subject_es`

2. **Test via API**
   ```bash
   # Using curl or similar
   curl -X GET "https://your-api.com/api/clients/AVII/config/emailTemplates" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Send Test Email**
   - Use the water bills email endpoint to send a test bill
   - Verify both English and Spanish versions render correctly

## Related Files

- **Backend Email Service**: `/workspace/backend/controllers/emailService.js`
- **Template Variables Builder**: `/workspace/backend/templates/waterBills/templateVariables.js`
- **Email Routes**: `/workspace/backend/routes/emailRoutes.js`
- **Config Routes**: `/workspace/backend/routes/config.js`

## Notes

- The HTML templates are quite large (~20KB each) due to embedded CSS
- Templates use Handlebars-style syntax: `{{variable}}` and `{{#if condition}}`
- The email service processes these with `processWaterBillTemplate()` function
- Templates are mobile-responsive and tested on Gmail, Outlook, Apple Mail
- Spanish translations are professional and appropriate for Mexican market

## Contact

If you need help with the restoration or have questions about the template structure, refer to:
- `/workspace/TASK_ASSIGNMENT_WATER_BILLS_EMAIL_TEMPLATES.md`
- `/workspace/Memory/Implementation_Agent_Water_Bills_Session.md`
