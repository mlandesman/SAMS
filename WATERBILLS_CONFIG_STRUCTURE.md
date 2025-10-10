# Water Bills Email Templates - Firebase Config Structure

## Overview

The water bills email templates were originally developed as **HTML files** stored in the codebase, but were later migrated to be stored as **string fields** inside the Firebase config document. This is why they were lost during the AVII client re-import - the config.json didn't have the HTML content.

## Firebase Document Structure

**Path:** `clients/{clientId}/config/emailTemplates`

```json
{
  "waterBill": {
    "subject_en": "💧 Water Bill for Unit {{__UnitNumber__}} - {{__BillingPeriod__}} | Due: {{__DueDate__}}",
    "subject_es": "💧 Estado de Cuenta de Agua - Unidad {{__UnitNumber__}} - {{__BillingPeriod__}} | Vencimiento: {{__DueDate__}}",
    "body_en": "<!DOCTYPE html><html lang=\"en\">...[FULL HTML AS STRING]...</html>",
    "body_es": "<!DOCTYPE html><html lang=\"es\">...[FULL HTML AS STRING]...</html>"
  },
  "receipt": {
    // Other receipt templates...
  }
}
```

## How the System Works

### 1. Code Location
The email service code expects to find templates in Firebase:
- **File:** `backend/controllers/emailService.js`
- **Function:** `sendWaterBillEmail()`
- **Lines:** 366-392

```javascript
// Fetch email templates from Firebase
const emailTemplateDoc = await db.collection('clients').doc(clientId)
  .collection('config').doc('emailTemplates').get();

const emailTemplates = emailTemplateDoc.data();
const waterBillTemplates = emailTemplates.waterBill;

// Select language-specific templates
const templateLang = userLanguage === 'es' ? 'es' : 'en';
const bodyTemplate = waterBillTemplates[`body_${templateLang}`];    // Full HTML string
const subjectTemplate = waterBillTemplates[`subject_${templateLang}`]; // Subject string
```

### 2. Template Processing
- Templates use **Handlebars-style** syntax for variables
- Variables use double underscore format: `{{__VariableName__}}`
- Conditional sections: `{{#if __Condition__}}...{{/if}}`
- Function: `processWaterBillTemplate(template, variables)`

### 3. Original Location (Git History)
The templates were originally stored as files:
- `backend/templates/email/waterBills/body_en.html`
- `backend/templates/email/waterBills/body_es.html`
- **Commit:** `00713d7` - "Fix Water Bills template processing..."
- **Date:** Early development phase

They were later migrated to Firebase strings but this migration wasn't captured in the export/import files.

## Why Templates Were Lost

During the AVII client re-import:

1. **Export Phase:**
   - `export-client.js` may not have captured the `emailTemplates` subcollection properly
   - OR the templates weren't in Firebase yet at export time

2. **Import Phase:**
   - `import-config.js` imported from JSON file without the HTML strings
   - The `config.json` file had the structure but empty/missing `body_en` and `body_es` fields

3. **Result:**
   - Firebase path exists: `clients/AVII/config/emailTemplates`
   - But `waterBill` object is missing or incomplete
   - System throws error: "Water bill body template not found for language: en"

## Restoration Process

### Option 1: Use Git History (Recommended)
```bash
node restore-waterbills-config-from-git.js AVII
```

This script:
1. Extracts original HTML from git commit `00713d7`
2. Creates proper Firebase config structure
3. Uploads to `clients/AVII/config/emailTemplates`
4. Verifies upload was successful

### Option 2: Manual Firebase Console
1. Go to Firebase Console
2. Navigate to: `clients/AVII/config/emailTemplates`
3. Edit the document
4. Add `waterBill` object with 4 fields:
   - `subject_en` (string)
   - `subject_es` (string)
   - `body_en` (string - full HTML)
   - `body_es` (string - full HTML)

### Option 3: Use Restored Files
The HTML files have been extracted to:
- `/tmp/original_body_en.html`
- `/tmp/original_body_es.html`

Read these files and manually upload via script or Firebase console.

## Template Variables

The templates use these variables (defined in `templateVariables.js`):

### Basic Info
- `{{__ClientName__}}`
- `{{__ClientLogoUrl__}}`
- `{{__UnitNumber__}}`
- `{{__BillingPeriod__}}`
- `{{__DueDate__}}`
- `{{__BillDate__}}`

### Water Consumption
- `{{__WaterConsumption__}}` - m³ consumed
- `{{__PriorReading__}}` - Previous meter reading
- `{{__CurrentReading__}}` - Current meter reading
- `{{__ReadingDate__}}` - Date meters were read
- `{{__WaterCharge__}}` - Formatted amount for water

### Service Charges
- `{{__CarWashCount__}}` - Number of car washes
- `{{__CarWashCharge__}}` - Car wash total
- `{{__BoatWashCount__}}` - Number of boat washes
- `{{__BoatWashCharge__}}` - Boat wash total
- `{{__CarWashRate__}}` - Rate per car wash
- `{{__BoatWashRate__}}` - Rate per boat wash

### Financial Totals
- `{{__CurrentMonthTotal__}}` - Current charges
- `{{__PenaltyAmount__}}` - Penalty charges
- `{{__TotalAmountDue__}}` - Grand total

### Conditional Display
- `{{__ShowCarWash__}}` - Boolean
- `{{__ShowBoatWash__}}` - Boolean
- `{{__ShowPenalties__}}` - Boolean
- `{{__ShowPaidStatus__}}` - Boolean
- `{{__IsHighUsage__}}` - Boolean (>30m³)

### Styling
- `{{__PrimaryColor__}}` - Brand primary color
- `{{__AccentColor__}}` - Brand accent color
- `{{__CurrencySymbol__}}` - $ or other
- `{{__ClientAddress__}}` - Full address
- `{{__ClientPhone__}}` - Phone number
- `{{__ClientEmail__}}` - Email address

## Translations (English → Spanish)

| English | Spanish |
|---------|---------|
| Water Bill Statement | Estado de Cuenta de Agua |
| Due Date | Fecha de Vencimiento |
| Bill Date | Fecha de Facturación |
| Total Amount Due | Monto Total a Pagar |
| Water Consumption | Consumo de Agua |
| Monthly Usage | Uso Mensual |
| Previous | Anterior |
| Current | Actual |
| Usage | Consumo |
| Service Charges | Cargos por Servicios |
| Car Wash Services | Servicios de Lavado de Auto |
| Boat Wash Services | Servicios de Lavado de Embarcación |
| Current Month Charges | Cargos del Mes Actual |
| Late Payment Penalties | Recargos por Pago Tardío |
| Payment Information | Información de Pago |
| Payment Methods Accepted | Métodos de Pago Aceptados |
| Bank Transfer (SPEI) | Transferencia Bancaria (SPEI) |
| Cash Payment at Management Office | Pago en Efectivo en la Oficina |
| Electronic Transfer | Transferencia Electrónica |
| High Water Usage Notice | Aviso de Consumo Alto de Agua |

## Testing After Restoration

1. **Verify Firebase Document:**
   ```bash
   # Use Firebase console or CLI
   firebase firestore:get clients/AVII/config/emailTemplates
   ```

2. **Test Email Sending:**
   - Use the Digital Receipt Demo interface
   - Or call the API directly: `POST /api/comm/email/waterBill/send`

3. **Test Both Languages:**
   - Send test email with `userLanguage='en'`
   - Send test email with `userLanguage='es'`
   - Verify both render correctly in email client

## Future Prevention

To prevent losing these templates in future imports:

1. **Update Export Script:**
   - Ensure `export-client.js` captures full `emailTemplates` document
   - Verify HTML strings are properly serialized in JSON

2. **Update Import Script:**
   - Ensure `import-config.js` preserves all fields including large strings
   - Add validation to check for required template fields

3. **Add Backup:**
   - Keep copies of HTML templates in git history
   - Document the Firebase structure clearly
   - Add verification step after import

## Summary

✅ **The templates exist in git history at commit `00713d7`**  
✅ **They should be stored as strings in Firebase, not as files**  
✅ **The restoration script will extract and upload them properly**  
✅ **Both English and Spanish templates are complete and professional**  

Run the restoration script and your water bills email system will work again!

