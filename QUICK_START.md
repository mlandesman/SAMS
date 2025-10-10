# Quick Start: Restore Water Bills Templates

## TL;DR

Your AVII water bills email templates (bilingual HTML) are missing from the re-imported config. I've found and recreated them.

## Fastest Way to Restore

```bash
cd /workspace
node restore-waterbills-templates.js AVII
```

✅ Done! This uploads all 4 required components to Firebase.

---

## What's Missing & What I Found

| Component | Status | File |
|-----------|--------|------|
| English HTML | ✅ Found | `fixed_body_en.html` |
| Spanish HTML | ⚠️ Missing → ✅ Created | `waterBills_body_es.html` |
| English Subject | ⚠️ Missing → ✅ Created | In `waterBills_emailTemplates_config.json` |
| Spanish Subject | ⚠️ Missing → ✅ Created | In `waterBills_emailTemplates_config.json` |

---

## Files I Created for You

1. **waterBills_body_es.html** - Complete Spanish template
2. **waterBills_emailTemplates_config.json** - Full config structure
3. **restore-waterbills-templates.js** - Automated restoration script
4. **WATERBILLS_CONFIG_RESTORATION_GUIDE.md** - Detailed instructions
5. **WATERBILLS_TEMPLATE_TRANSLATIONS.md** - Translation reference
6. **RESTORATION_SUMMARY.md** - Complete summary
7. **QUICK_START.md** - This file

---

## The Config Structure

Firebase location: `/clients/AVII/config/emailTemplates`

```json
{
  "waterBill": {
    "subject_en": "💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}",
    "subject_es": "💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}",
    "body_en": "<Full English HTML>",
    "body_es": "<Full Spanish HTML>"
  }
}
```

---

## Subject Lines

### English
```
💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}
```

### Spanish
```
💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}
```

---

## Three Ways to Restore

### Method 1: Automated Script (Recommended)
```bash
node restore-waterbills-templates.js AVII
```

### Method 2: Manual via Firebase Console
1. Go to Firestore → `clients/AVII/config/emailTemplates`
2. Add field `waterBill` (type: map)
3. Add 4 string fields: `subject_en`, `subject_es`, `body_en`, `body_es`
4. Copy content from the files I created

### Method 3: Via Import System
Ensure your import scripts include the `config` subcollection with `emailTemplates` document.

---

## Verify It Worked

### Check Firebase
```
Path: /clients/AVII/config/emailTemplates/waterBill
Expected: 4 fields (subject_en, subject_es, body_en, body_es)
```

### Test Email
```bash
# Send test water bill in English
POST /api/email/water-bill
{
  "clientId": "AVII",
  "unitNumber": "101",
  "billingPeriod": "2026-00",
  "userLanguage": "en",
  "recipientEmails": ["test@example.com"]
}

# Send test water bill in Spanish
POST /api/email/water-bill
{
  "clientId": "AVII",
  "unitNumber": "101",
  "billingPeriod": "2026-00",
  "userLanguage": "es",
  "recipientEmails": ["test@example.com"]
}
```

---

## Template Features

✅ Bilingual (English & Spanish)
✅ Mobile-responsive
✅ AVII ocean-to-sand gradient branding
✅ Conditional sections (car wash, boat wash, penalties)
✅ High usage warnings
✅ Usage comparison with previous month
✅ Mexican payment instructions (SPEI, CLABE)
✅ Handlebars variable substitution
✅ Professional Spanish translations

---

## Template Variables (Examples)

- `{{UnitNumber}}` → "101"
- `{{BillingPeriod}}` → "July 2025"
- `{{TotalAmountDue}}` → "$1,102.50 MXN"
- `{{WaterConsumption}}` → "18 m³"
- `{{DueDate}}` → "July 20, 2025"
- `{{#if ShowCarWash}}` → Conditional display

---

## Need More Details?

📖 **Read:** `RESTORATION_SUMMARY.md` - Complete overview
📖 **Read:** `WATERBILLS_CONFIG_RESTORATION_GUIDE.md` - Detailed guide
📖 **Read:** `WATERBILLS_TEMPLATE_TRANSLATIONS.md` - Translation reference

---

## Quick Troubleshooting

**Problem:** Script fails to connect to Firebase
- ✅ Check Firebase credentials are configured
- ✅ Verify you're in the correct directory
- ✅ Check Node.js version (needs ES modules support)

**Problem:** Templates don't render correctly
- ✅ Check user language preference is set ('en' or 'es')
- ✅ Verify all 4 fields exist in Firebase
- ✅ Check template variables are being populated correctly

**Problem:** Spanish characters look wrong
- ✅ Ensure email client supports UTF-8
- ✅ Check HTML meta charset is set to UTF-8
- ✅ Verify Firebase stored templates correctly

---

## That's It!

Run the script and you're done. The templates will be restored to Firebase exactly as they were before the import.

**Questions?** Check the detailed guides in the workspace.


