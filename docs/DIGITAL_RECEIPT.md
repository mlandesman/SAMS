# SAMS Digital Receipt for Email

## ✅ Implementation Status: COMPLETE & INTEGRATED

**Latest Updates (June 17, 2025):**
- ✅ **Universal Receipt System**: Centralized `generateReceipt()` function for any transaction ID
- ✅ **HOA Dues Integration**: Automatic receipt modal after HOA Dues payments
- ✅ **TransactionsView Integration**: Unified receipt generation across all modules
- ✅ **Data Issues Fixed**: Resolved date formatting and amount-in-words generation
- ✅ **Modal Stability**: Fixed disappearing modal during data refresh operations
- ✅ **Documentation**: Comprehensive transaction data requirements for all modules

**Previous Updates (June 16, 2025):**
- ✅ Email system fully operational with Gmail SMTP
- ✅ Custom notification modal system implemented  
- ✅ Receipt image optimization for smaller email attachments
- ✅ Professional success/error feedback with detailed recipient information
- ✅ Reusable notification system for future WhatsApp integration

---

## 🚀 **Current Features**

### **Email Delivery System**
- ✅ **Gmail SMTP Integration**: Authenticated email sending via App Password
- ✅ **Client-specific Templates**: Stored in Firestore `/clients/{clientId}/config/receiptEmail`
- ✅ **Multi-recipient Support**: Sends to unit owners + CC to property managers
- ✅ **Image Attachments**: Receipt generated as JPEG with optimized file size
- ✅ **Template Variables**: Dynamic content replacement (unit, amount, date, etc.)

### **User Experience**
- ✅ **Professional Notifications**: Custom modal for success/error feedback
- ✅ **Detailed Status**: Shows all recipients, CC list, and transaction details
- ✅ **Contact Validation**: Checks for valid email addresses before sending
- ✅ **Loading States**: Clear feedback during email generation and sending

### **Technical Optimizations**
- ✅ **Image Compression**: JPEG format at 85% quality for smaller attachments
- ✅ **Canvas Scaling**: Optimized 1.5x scale for good quality vs. file size
- ✅ **Payload Limits**: Backend supports 50MB requests for image attachments
- ✅ **Error Handling**: Comprehensive error catching and user feedback

---

## Image Sample from Google Sheets![Screenshot 2025-06-10 at 12.45.44 PM](assets/Screenshot%202025-06-10%20at%2012.45.44%E2%80%AFPM.jpg)

## Receipt Components
### Fields
* Date: date of deposit
* Receipt Number: currently the Sequence number but should be changed to Transaction ID (TxID: )
* Received From: unit owners full name /clients/{clientId}/units/{unitId}/owners[0]
* Amount: deposit amount (total no matter how many months of HOA paid)
* Amount: text representation (check writing style) in Spanish
* For: Category
* Note: Notes field
* Paid By: currently cash or bank check box but should be replaced by Payment Method
* Amount Due/Payment Amount/Balance Due should all be removed (not appropriate when paying multiple months)
### Wrapper Data
* Title Bar is the client's full name
* Logo is the logo from the firestore record (url in clientId logoUrl: field) sized appropriately.
### Additional Data Needed from db
* unit owners email /clients/{clientId}/units/{unitId}/emails[0-n] (need to concatenate emails to send to all owners/managers)
* property manager's email (pm@sandyland.com.mx)

## Google Method
In Google Sheets we post the data into a predefined sheet that looks like a receipt but using range names and .setValue from our Transaction row data.  The data only includes the unitId so all other data (names, emails) are done via lookup.

There are two current triggers for a receipt; HOA Dues Payment or Special Assessment/Project Payment from the unit owners.

As soon as an HOA Dues entry or Project Payment is posted to Transactions the receipt is generated.  The user is prompted to review the receipt then asked if they want to send the email now.  No copy of the receipt is kept as the property managers receive an emailed copy and it can be regenerated from the Transaction data.

The email contains some boiler plate text in HTML format with our company signature block plus a PNG/JPG image of the receipt.

There is also a YTD status report for this specific unit that is also sent as an image but that is for a later step.

## Code from GAS
```
function emailReceipt() {
  SpreadsheetApp.flush();
  
  var sourceSpreadsheet = SpreadsheetApp.getActive(); // Get active spreadsheet.
  var unit = getReceiptUnitID();
  var owner = getOwnerDetails(unit);
  var pdfName

  var sheetName = sourceSpreadsheet.getActiveSheet().getName();
  var  parents = DriveApp.getFileById(sourceSpreadsheet.getId()).getParents(); // Get folder containing spreadsheet to save pdf in.
  if (parents.hasNext()) {
    var  folder = parents.next();
  } else {
    folder = DriveApp.getRootFolder();
  }

  // Generate the PDF for the Recceipt and Crop it
  const pdfBlob = createReceiptPDF(sheetName, "Receipt.pdf");
  const imgReceipt = cropReceipt(pdfBlob);
  SLPutils.imageSave(
    imgReceipt,
    '1z5Y1UhP-s9gcZgK6eRy_ouXhRmjVvHCU',
    `Receipt ${unit} ${Utilities.formatDate(new Date(), "America/Cancun", "yyyy-MM-dd")}`
  );

  // build the email template process
  var  email = owner.ownerEmail;
  const subject = `Marina Turquesa Payment Receipt for ${unit}`;
  let body = getReceiptHTML().replace("__OwnerName__", owner.ownerName);
  body += getSignatureHTML();

  GmailApp.sendEmail(email, subject, body, {
    cc: "mtcmanager@landesman.com",
    htmlBody: body,
    attachments: [imgReceipt, theBlobStatus]
  });
  
  // delete pdf if already exists
  /*
  var  files = folder.getFilesByName(pdfName);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  } */
  alertPopUp("Emailed to " + email, "Success");

}

/**
 * Full flow to convert PDF to JPG, crop it, and return the cropped image.
 * Uses Sandyland's standardized receipt crop dimensions.
 * @param {Blob} pdfBlob - The PDF blob to convert and crop.
 * @returns {Blob} - Final transformed image blob.
 */
function cropReceipt(pdfBlob) {
  // Convert PDF to PNG
  const pngBlob = SLPutils.convertPDFtoImage(pdfBlob);

  // Upload to Cloudinary
  const uploadResult = SLPutils.cloudinaryUpload(pngBlob);
  Logger.log(uploadResult);

  let transformedBlob;

  if (uploadResult && uploadResult.public_id) {
    const tx = {
      CROP: { width: 2038, height: 905, x: 238, y: 219 },
      RESIZE: { percentage: 0.50, originalWidth: uploadResult.width },
      FORMAT: "jpg"
    };
    transformedBlob = SLPutils.cloudinaryTransform(uploadResult.public_id, tx);
  } else {
    transformedBlob = pngBlob;
  }

  return transformedBlob;
}

function createReceiptPDF(sheetName, pdfName) {
  var  sourceSpreadsheet = SpreadsheetApp.getActive();
  var  sourceSheet = sourceSpreadsheet.getSheetByName(sheetName);
  var  url = 'https://docs.google.com/spreadsheets/d/' + sourceSpreadsheet.getId() + '/export?exportFormat=pdf&format=pdf' // export as pdf / csv / xls / xlsx
    +    '&size=A5' // paper size legal / letter / A4
    +    '&portrait=false' // orientation, false for landscape
    +    '&fitw=true' // fit to page width, false for actual size
    +    '&sheetnames=false&printtitle=false' // hide optional headers and footers
    +    '&pagenum=RIGHT&gridlines=false' // hide page numbers and gridlines
    +    '&fzr=false' // do not repeat row headers (frozen rows) on each page
    +    '&horizontal_alignment=CENTER' //LEFT/CENTER/RIGHT
    +    '&vertical_alignment=TOP' //TOP/MIDDLE/BOTTOM
    +    '&gid=' + sourceSheet.getSheetId(); // the sheet's Id
  var  token = ScriptApp.getOAuthToken();
  // request export url
  var  response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  var  theBlob = response.getBlob().setName(pdfName);
  return theBlob;
};

```

### Email body (HTML)
```
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>HOA Receipt</title>
</head>
<body>
  <h3>__OwnerName__,</h3>Attached please find the receipt for your recent payment. If you find any errors or missing transactions, please let me know immediately. Remember that you can always access the <strong>Marina Turquesa Financials Portal</strong> by <a href="https://docs.google.com/spreadsheets/d/1zf4fKb5-VAbY609kyCIQ2CFe4ErT3hggZpvVSYw3TWM/edit?usp=sharing">Clicking Here.</a>
  <p>Thank you!</p>
  <div class="container-fluid">

    <?!= include('MTCsignature'); ?>

  </div>

</body>
</html>
```

### Email signature (HTML)
```
<table>
  <tr>
    <td>
      <table>
        <tr>
          <td>
            <table>
              <tr>
                <td>
                  <p><img src="https://signaturehound.com/api/v1/file/y6yooklpehuilt" alt="y6yooklpehuilt" width="100" height="100"></p>
                </td>
              </tr>
            </table>
          </td>
          <td></td>
          <td>
            <table>
              <tr>
                <td>
                  <p>Michael y Sandra Landesman</p>
                  <p>Administradores</p>
                </td>
              </tr>
              <tr>
                <td>
                  <table>
                    <tr>
                      <td>
                        <p><img src="https://signaturehound.com/api/v1/png/email/default/00d2ff.png" alt="00d2ff" width="21" height="21"></p>
                      </td>
                      <td>
                        <p><a href="mailto:ms@landesman.com">ms@landesman.com</a></p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p><img src="https://signaturehound.com/api/v1/png/mobile/default/00d2ff.png" alt="00d2ff" width="21" height="21"></p>
                      </td>
                      <td>
                        <p><a href="tel:+529841780331">+52 98 41 78 03 31 WhatsApp</a></p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p><img src="https://signaturehound.com/api/v1/png/map/default/00d2ff.png" alt="00d2ff" width="21" height="21"></p>
                      </td>
                      <td>
                        <p><a href="https://goo.gl/maps/LZGN41nxDnVGqTV99">Caleta Yalkú 9, PH4DPuerto Aventuras, Solidaridad, QROO 77733</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td> </td>
  </tr>
</table>
```

---

### **Universal Receipt Generation**
- ✅ **Transaction-Centric**: Generate receipts from any transaction ID across all modules
- ✅ **Centralized Utility**: `generateReceipt(transactionId, context)` works from anywhere
- ✅ **Automatic Data Fetching**: Fresh transaction data retrieved from database
- ✅ **Smart Date Handling**: Supports Firestore timestamps, Date objects, and strings  
- ✅ **Amount in Words**: Automatic Spanish text generation for receipt amounts
- ✅ **Owner Lookup**: Automatic unit owner information retrieval and formatting
- ✅ **Module Agnostic**: Works with HOA Dues, Transactions, Special Projects, Budget modules

## 📋 **Transaction Data Requirements for Digital Receipt Generation**

**Updated: June 17, 2025**

Since Firestore is a schema-less database, transactions from different modules may have varying field structures. This section documents the **required** and **optional** fields that must be present in a transaction document to successfully generate a Digital Receipt using the universal `generateReceipt()` function.

### **Required Transaction Fields**

These fields **MUST** be present in any transaction document to generate a receipt:

```javascript
{
  // Core identification
  "id": "string",                    // Transaction ID (unique identifier)
  
  // Unit association (one of these is required)
  "unit": "string",                  // Unit ID (HOA Dues, Special Projects)
  "unitId": "string",               // Alternative unit ID field (some modules)
  
  // Financial data
  "amount": number,                  // Transaction amount (positive for income)
  
  // Date information (one of these is required)
  "date": Timestamp,                 // Firestore timestamp
  "transactionDate": Timestamp,      // Alternative date field
  
  // Transaction type
  "type": "income"                   // Must be "income" for receipts (not "expense")
}
```

### **Optional Transaction Fields**

These fields enhance the receipt but are not required (defaults will be used):

```javascript
{
  // Payment details
  "paymentMethod": "string",         // "cash", "check", "transfer", etc.
  "checkNumber": "string",           // Check number if payment method is "check"
  
  // Description and categorization
  "description": "string",           // Transaction description
  "category": "string",              // Transaction category ("HOA Dues", etc.)
  "notes": "string",                 // Additional notes
  
  // Vendor/recipient information
  "vendor": "string",                // Vendor or payer name
  "receivedFrom": "string"           // Who the payment was received from
}
```

### **Field Mapping and Defaults**

The receipt utility handles field variations and provides intelligent defaults:

| Receipt Field | Transaction Sources | Default Value |
|---------------|-------------------|---------------|
| `unitNumber` | `transaction.unitId` OR `transaction.unit` | **Error if missing** |
| `amount` | `transaction.amount` | **Error if missing** |
| `date` | `transaction.transactionDate` OR `transaction.date` | **Error if missing** |
| `amountInWords` | Generated from `transaction.amount` | Spanish words representation |
| `paymentMethod` | `transaction.paymentMethod` | "Unknown" |
| `checkNumber` | `transaction.checkNumber` | `null` |
| `description` | `transaction.description` OR `transaction.category` | "Payment" |
| `category` | `transaction.category` | "HOA Dues" |
| `notes` | `transaction.notes` | "" (empty string) |
| `receivedFrom` | Owner lookup via units data | "Unit Owner" |

### **Data Validation Rules**

The `generateReceipt()` function performs these validations:

1. **Transaction Existence**: Transaction must exist in database
2. **Unit ID Validation**: Must have non-empty unit identifier
3. **Amount Validation**: Amount must be > 0
4. **Transaction Type**: Must be "income" type (not "expense")
5. **Client Context**: Valid client must be selected

### **Example Transaction Documents**

#### HOA Dues Payment Transaction
```javascript
{
  "id": "4Tj1Du3Xr0BRn7UJ2pDt",
  "unit": "A-101",
  "amount": 2500.00,
  "date": Timestamp,
  "type": "income",
  "category": "HOA Dues",
  "paymentMethod": "check",
  "checkNumber": "12345",
  "description": "HOA Dues payment for Unit A-101 - January, February 2025",
  "notes": "Paid in full for Q1"
}
```

#### Special Project Payment Transaction
```javascript
{
  "id": "8Xk9Vy2Nm5CRd1Ef7gHi",
  "unitId": "B-205",
  "amount": 1200.00,
  "transactionDate": Timestamp,
  "type": "income",
  "category": "Special Assessment",
  "paymentMethod": "transfer",
  "description": "Pool renovation special assessment",
  "vendor": "John Smith"
}
```

#### Budget Line Item Transaction
```javascript
{
  "id": "3Lm8Qw6Tp9VsA2By4Nz",
  "unit": "C-302",
  "amount": 850.00,
  "date": Timestamp,
  "type": "income",
  "category": "Maintenance Fee",
  "paymentMethod": "cash",
  "notes": "Emergency repair contribution"
}
```

### **Supporting Data Requirements**

For complete receipt generation, ensure these related data structures exist:

#### Units Collection (`/clients/{clientId}/units/{unitId}`)
```javascript
{
  "id": "A-101",
  "owners": [
    {
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@email.com"
    }
  ],
  // OR legacy format:
  "owner": "John Smith",
  "email": "john.smith@email.com",
  "emails": ["john.smith@email.com", "alt@email.com"]
}
```

#### Client Configuration
```javascript
{
  "id": "MTC",
  "name": "Marina Turquesa Condominiums",
  "logoUrl": "/sandyland-logo.png"
}
```

### **Module-Specific Guidelines**

#### HOA Dues Module
- Use `unit` field for unit identification
- Always include `paymentMethod` and `checkNumber` (if applicable)
- Set `category` to "HOA Dues"
- Include descriptive payment period in `description`

#### Special Projects Module
- Use `unitId` or `unit` field consistently
- Set `category` to project type ("Special Assessment", "Capital Improvement", etc.)
- Include project name in `description`

#### Budget Module
- Ensure `type: "income"` for receipt-eligible transactions
- Use descriptive `category` for budget line item type
- Include budget reference in `notes`

### **Error Handling**

Common receipt generation failures and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Transaction not found" | Invalid transaction ID | Verify transaction exists in database |
| "Transaction does not have a unit ID" | Missing `unit` and `unitId` fields | Add unit identifier to transaction |
| "Invalid transaction amount" | Amount ≤ 0 or missing | Ensure positive amount value |
| "Receipts only available for income" | `type: "expense"` | Only income transactions can have receipts |

---