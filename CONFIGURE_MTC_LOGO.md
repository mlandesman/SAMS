# Configure MTC Client Logo URL

## Firebase Console Steps

### 1. Set MTC Client Configuration
Navigate to Firebase Console → Firestore Database and add/update:

**Document Path:** `clients/MTC`
**Field to Add/Update:** `logoUrl`

**Recommended Logo URL for MTC:**
```
https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fmtc-logo.png?alt=media&token=YOUR_TOKEN_HERE
```

### 2. Upload MTC Logo to Firebase Storage
1. Go to Firebase Console → Storage
2. Create folder: `logos`
3. Upload MTC logo file as: `mtc-logo.png`
4. Copy the generated download URL
5. Update the `logoUrl` field in `clients/MTC` document

### 3. Alternative Logo URLs
If Firebase Storage doesn't work for email clients, these alternatives can be used:

**Google Drive Public (if available):**
- Upload to Google Drive
- Set sharing to "Anyone with the link can view"
- Use direct link format

**External CDN:**
- Upload to any public CDN
- Ensure HTTPS and no CORS restrictions for email clients

### 4. Test Logo Integration
After configuring the logo URL:

1. Test email delivery using DigitalReceiptDemo
2. Check email in multiple clients (Gmail, Outlook, Apple Mail)
3. Verify logo displays correctly in all email clients
4. Check mobile email rendering

### 5. Current Demo Configuration
The demo currently uses Sandyland logo:
```
https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0
```

**For MTC, this should be replaced with their actual logo URL.**

## Expected Result
Professional email receipts with:
- MTC logo displayed at the top
- Clean, mobile-responsive design  
- Proper fallback if logo fails to load
- Client name showing "Marina Turquesa Condominiums"