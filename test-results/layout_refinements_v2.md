# Statement Layout Refinements - Version 2
## November 28, 2025

## Changes Implemented

### TOP LEFT Section

✅ **1. Owner Names - Larger & Bold**
- Changed from: 10pt regular weight
- Changed to: 12pt bold
- CSS class: `.owner-name` with `font-size: 12pt; font-weight: bold`

✅ **2. Changed "Apartment" to "Unit"**
- English: "APARTMENT:" → "Unit:"
- Spanish: "APARTAMENTO:" → "Unidad:"

✅ **3. Address Line Break at First Comma**
- Before: "Mza 20 Lote 12-13 Privada Xel-ha, Puerto Aventuras, QR, 77733"
- After: 
  ```
  Mza 20 Lote 12-13 Privada Xel-ha
  Puerto Aventuras, QR, 77733
  ```
- Implementation: JavaScript splits address at first comma and inserts `<br>` tag

✅ **4. Logo Moved to Top Left**
- Logo now appears above "STATEMENT OF ACCOUNT" title
- Logo size: max-width 150px, max-height 75px (slightly smaller)
- Owner names now vertically align with "BANKING INFORMATION" line on right

✅ **5. Changed "Expiration Date" to "Next Payment Due"**
- English: "Expiration Date:" → "Next Payment Due:"
- Spanish: "Fecha de Vencimiento:" → "Próximo Pago Vencido:"
- Current value: "TBD" (placeholder until calculation logic added)
- Note: Will need to calculate from preview payments data

### TOP RIGHT Section

✅ **6. Reduced Line Spacing in Banking Info**
- Line height: 1.6 → 1.3
- Cell padding: 2px → 1px
- Heading margin-bottom: 5px → 3px
- Result: More compact, easier to read

## Visual Comparison

**Before:**
```
STATEMENT OF ACCOUNT      [LOGO]
Miguel y Estafania...     [BANKING INFO]
APARTMENT: 102
Address:
  Full single-line address
Date: 11/28/2025
Expiration Date: 12/27/2025
```

**After:**
```
[LOGO]                    
STATEMENT OF ACCOUNT      [BANKING INFO]
                          (tighter spacing)
Miguel y Estafania...     
Unit: 102
Address:
  Mza 20 Lote 12-13...
  Puerto Aventuras, QR...
Date: 11/28/2025
Next Payment Due: TBD
```

## Technical Details

### CSS Changes
- Added `.logo-top` class for top-left logo positioning
- Added `.owner-name` class for larger, bold owner names
- Reduced line-height and padding in `.banking-info`
- Increased label width from 120px to 140px for better alignment

### HTML Structure Changes
- Logo moved from right side to top of left column
- Address split logic using JavaScript inline IIFE
- Updated translation keys for "Unit" and "Next Payment Due"

### File Sizes
- English HTML: 12.8 KB (similar size, structure changes)
- English PDF: 1.4 MB
- Spanish HTML: 13.0 KB
- Spanish PDF: 1.4 MB

## Next Steps / TODO

### Calculation Needed: Next Payment Due Date
Current status: Shows "TBD"

**Requirement:** Calculate from preview payments data (future or past due)

**Possible approaches:**
1. Find first unpaid/future charge in line items
2. Use fiscal year schedule (quarter/month due dates)
3. Query separate "next due" field from data service

**This will require:**
- Access to payment schedule data
- Logic to determine next due date
- Handle both past-due and future scenarios

## Files Updated
- `backend/services/statementHtmlService.js`

## Test Results
✅ All changes verified in generated HTML
✅ Owner names: 12pt bold ✓
✅ "Unit" instead of "Apartment" ✓
✅ Address line break ✓
✅ Logo repositioned ✓
✅ "Next Payment Due" label ✓
✅ Reduced spacing in banking info ✓

