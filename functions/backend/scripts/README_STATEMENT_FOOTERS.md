# Statement Footer Update Scripts

Scripts to update client configuration with statement footer text for MTC and AVII clients.

## Scripts

1. **updateMTCStatementFooter.js** - Updates MTC client with bulleted footer text
2. **updateAVIIStatementFooter.js** - Updates AVII client with bulleted footer text (preserves *** markers)

## Usage

### Local/Development Environment

```bash
cd functions/backend
node scripts/updateMTCStatementFooter.js
node scripts/updateAVIIStatementFooter.js
```

The scripts will automatically find and use `serviceAccountKey.json` from common locations.

### Production Environment

**Using Application Default Credentials (ADC)**

```bash
# Ensure you're authenticated with gcloud ADC
gcloud auth application-default login

# Navigate to functions directory
cd functions/backend

# Run scripts with --prod flag
node scripts/updateMTCStatementFooter.js --prod
node scripts/updateAVIIStatementFooter.js --prod
```

The `--prod` flag tells the scripts to:
- Use Application Default Credentials (ADC) instead of service account key files
- Connect to `sams-sandyland-prod` Firebase project
- Display production environment indicators

## Prerequisites

### For Development
- Service account key file (`serviceAccountKey.json`) in one of these locations:
  - `functions/backend/serviceAccountKey.json`
  - `functions/serviceAccountKey.json`
  - `serviceAccountKey.json` (project root)

### For Production
- **Application Default Credentials (ADC)** must be configured:
  ```bash
  gcloud auth application-default login
  ```
- This uses your gcloud credentials to authenticate with Firebase
- No service account key file needed for production

## What These Scripts Do

Both scripts:
1. Read/create the account statements config document (`clients/{clientId}/config/accountStatements`)
2. Display current configuration status
3. Update `statementFooter.en` and `statementFooter.es` fields in the config document
4. Preserve existing config fields (merge operation)
5. Add timestamp and script identifier

**Config Structure:**
- Path: `clients/{clientId}/config/accountStatements`
- Fields: `statementFooter.en`, `statementFooter.es`
- Extensible: Can add other statement-related configs (e.g., `headerText`, `disclaimerText`) in the future

## Expected Output

### MTC Script Output
```
📄 Updating MTC client configuration with statement footer...

📋 Current Client Configuration:
   Client ID: MTC
   Name: [Client Name]
   Has config: true/false
   Has statementFooter: true/false

✅ Client configuration updated successfully!
📍 Path: clients/MTC

📋 Updated Configuration:
   statementFooter.en: 456 characters
   statementFooter.es: 456 characters
```

### AVII Script Output
```
📄 Updating AVII client configuration with statement footer...

📋 Current Client Configuration:
   Client ID: AVII
   Name: [Client Name]
   Has config: true/false
   Has statementFooter: true/false

✅ Client configuration updated successfully!
📍 Path: clients/AVII

📋 Updated Configuration:
   statementFooter.en: [length] characters
   statementFooter.es: [length] characters
```

## Verification

After running scripts, verify the update:

1. **Check Firestore Console**:
   - Navigate to `clients/{clientId}/config/accountStatements` document
   - Verify `statementFooter.en` and `statementFooter.es` fields exist

2. **Test Statement Generation**:
   - Generate a statement for a unit in the updated client
   - Verify footer displays correctly in both English and Spanish
   - Check bullet rendering (MTC) or paragraph formatting (AVII)

## Troubleshooting

### Error: "Client document not found"
- Verify client ID is correct (MTC or AVII)
- Check Firebase project is correct
- Ensure you have read/write permissions

### Error: "Firebase Admin SDK initialization failed"
- **Development**: Check service account key file exists and is valid
- **Production**: Run `gcloud auth application-default login` to authenticate ADC
- Verify Firebase project configuration

### Error: "Permission denied"
- **Development**: Verify service account has Firestore write permissions
- **Production**: Check your gcloud account has Firebase Admin permissions
- Check IAM roles in Google Cloud Console
- For production, ensure you're using `--prod` flag

### Error: "Could not find serviceAccountKey.json" (when not using --prod)
- Place `serviceAccountKey.json` in one of the expected locations (see Prerequisites)
- Or use `--prod` flag to use ADC instead

## Rollback

If you need to remove the footer configuration:

```javascript
// In Firebase Console or via script:
const configRef = db.doc('clients/MTC/config/accountStatements'); // or 'clients/AVII/config/accountStatements'
await configRef.update({
  'statementFooter': admin.firestore.FieldValue.delete()
});
```

## Notes

- Scripts use `set()` with `merge: true`, so they merge with existing config (won't overwrite other config fields)
- Config location: `clients/{clientId}/config/accountStatements` (follows module-specific config pattern)
- Footer text format:
  - **MTC**: Uses bullet characters (`◦`) - renders as HTML bulleted list
  - **AVII**: Uses bullet characters (`◦`) with `***` markers for emphasis - renders as HTML bulleted list
- Empty footer fallback: If `statementFooter` is missing, statements show empty footer (no PII leakage)
- Extensible structure: The `accountStatements` config document can hold other statement-related settings in the future

