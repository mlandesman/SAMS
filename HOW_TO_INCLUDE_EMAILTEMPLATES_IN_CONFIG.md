# How to Include EmailTemplates in Config Export/Import

## The Problem

When you re-imported AVII, the `emailTemplates` document from the `config` subcollection didn't include the water bills HTML templates as strings. This is because:

1. The HTML templates were stored as STRING values in Firebase at `/clients/AVII/config/emailTemplates`
2. When exported, they should be in your config.json
3. When imported, they need to be restored as strings

## The Correct Structure

The `emailTemplates` document in the `config` subcollection should look like this:

### Firebase Path
```
/clients/AVII/config/emailTemplates
```

### Document Structure (in Firebase)
```javascript
{
  waterBill: {
    subject_en: "💧 Water Bill for Unit {{UnitNumber}} - {{BillingPeriod}} | Due: {{DueDate}}",
    subject_es: "💧 Estado de Cuenta de Agua - Unidad {{UnitNumber}} - {{BillingPeriod}} | Vencimiento: {{DueDate}}",
    body_en: "<!DOCTYPE html>\n<html lang=\"en\">...(full HTML as one string)...",
    body_es: "<!DOCTYPE html>\n<html lang=\"es\">...(full HTML as one string)..."
  }
}
```

## How It Should Be Exported

When you run `export-client.js`, the config subcollection is already included (line 188):

```javascript
const subcollections = [
  'units', 'vendors', 'categories', 
  'paymentMethods', 'users', 'yearEndBalances',
  'auditLogs', 'importMetadata', 'transactions', 'config'  // ← This line
];
```

The export should create a file structure like:

```json
{
  "metadata": { ... },
  "client": { ... },
  "subcollections": {
    "config": {
      "emailTemplates": {
        "waterBill": {
          "subject_en": "...",
          "subject_es": "...",
          "body_en": "...",
          "body_es": "..."
        }
      },
      "waterBills": { ... }
    }
  }
}
```

## Verification: Check Your Export

To verify if your export includes the email templates:

```bash
# Find your AVII export
cd /workspace/scripts/client-onboarding/migrations/AVII-latest

# Check if dev-export.json exists and has the emailTemplates
cat dev-export.json | jq '.subcollections.config.emailTemplates' | head -50
```

If this returns `null` or doesn't show the waterBill object, then your export is missing the templates.

## Solution Options

### Option 1: Re-Export from Production/Dev (If Templates Still Exist There)

If the templates still exist in your production or dev Firebase:

```bash
cd /workspace/scripts/client-onboarding

# Export from environment where templates exist
FIRESTORE_ENV=dev node export-client.js --client AVII

# The export will be in migrations/AVII-latest/dev-export.json
```

Then check the export file:
```bash
# Verify emailTemplates are in the export
cat migrations/AVII-latest/dev-export.json | jq '.subcollections.config.emailTemplates.waterBill | keys'

# Should show: ["body_en", "body_es", "subject_en", "subject_es"]
```

### Option 2: Manually Add to Existing Export

If you have an export file but it's missing the emailTemplates, you can add them manually:

1. **Locate your export file:**
   ```bash
   cd /workspace/scripts/client-onboarding/migrations/AVII-latest
   ```

2. **Edit the export JSON:**
   ```bash
   # Open in a text editor
   nano dev-export.json  # or vim, code, etc.
   ```

3. **Add the emailTemplates to the config section:**
   Find the `"config"` key under `"subcollections"` and add:
   ```json
   {
     "subcollections": {
       "config": {
         "emailTemplates": {
           // Copy the entire emailTemplates object from AVII_emailTemplates_for_import.json
         },
         "waterBills": { ... existing waterBills config ... }
       }
     }
   }
   ```

4. **Use the prepared file:**
   I've created `AVII_emailTemplates_for_import.json` with the correct structure. Copy the `emailTemplates` object from there.

### Option 3: Import Templates Separately After Main Import

After importing your main AVII data, run the restoration script I created:

```bash
cd /workspace
node restore-waterbills-templates.js AVII
```

This will add just the emailTemplates to the existing AVII config without affecting other data.

## Import Script Verification

When you run your import script, verify it's handling the config subcollection correctly:

```javascript
// In your import script (import-config.js or similar)
// Make sure it processes the config subcollection

// For each document in the config subcollection:
for (const [docId, docData] of Object.entries(exportData.subcollections.config)) {
  await db.collection('clients').doc(clientId)
    .collection('config').doc(docId)
    .set(docData, { merge: true });
  
  console.log(`✓ Imported config/${docId}`);
}
```

## File Reference

I've created these files for you:

1. **AVII_emailTemplates_for_import.json** - Ready-to-import structure with HTML as strings
2. **restore-waterbills-templates.js** - Script to upload templates directly to Firebase
3. **fixed_body_en.html** - English template (reference)
4. **waterBills_body_es.html** - Spanish template (reference)

## Recommended Approach

**For immediate restoration:**
```bash
node restore-waterbills-templates.js AVII
```

**For future imports:**
1. Verify your export includes `subcollections.config.emailTemplates`
2. If missing, add it manually from `AVII_emailTemplates_for_import.json`
3. Ensure your import script processes the config subcollection
4. Verify after import:
   ```bash
   # Check Firebase Console:
   # /clients/AVII/config/emailTemplates
   # Should have waterBill field with 4 sub-fields
   ```

## Common Mistakes to Avoid

❌ **Don't store HTML as separate files** - They should be STRING values in the config document
❌ **Don't skip the config subcollection in exports** - It contains critical template data
❌ **Don't forget to escape special characters** - The HTML string needs proper JSON escaping
✅ **Do store the entire HTML as a single string** with `\n` for line breaks
✅ **Do include the config subcollection in your export/import scripts**
✅ **Do verify the import** by checking Firebase Console after importing

## Verification Checklist

After importing, verify:

- [ ] Document exists: `/clients/AVII/config/emailTemplates`
- [ ] Field exists: `waterBill` (type: map)
- [ ] Sub-fields exist: `subject_en`, `subject_es`, `body_en`, `body_es` (all strings)
- [ ] HTML strings start with: `<!DOCTYPE html>`
- [ ] HTML strings include: `<html lang="en">` or `<html lang="es">`
- [ ] HTML strings are complete (check length: ~8000-10000 characters each)
- [ ] Test email sending works in both languages

## Questions?

If the templates are still missing after following these steps:
1. Check if they exist in production Firebase
2. Run a fresh export from production
3. Or use the restoration script as a fallback
