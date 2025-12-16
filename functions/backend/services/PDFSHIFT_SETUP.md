# PDFShift Setup Instructions

## Current Status
PDFShift integration is implemented but requires valid API key to function.

## Setup Steps

### 1. Get API Key
1. Go to https://pdfshift.io
2. Sign up for free account (100 PDFs/month free)
3. Navigate to Dashboard
4. Copy your actual API Key

### 2. Add to Environment
Add to `/Users/michael/Projects/SAMS/backend/.env`:

```
PDFSHIFT_KEY=your_actual_api_key_here
```

### 3. Restart Backend
```bash
cd /Users/michael/Projects/SAMS
./stop_sams.sh
./start_sams.sh
```

## Testing PDFShift

Once key is configured, test with:

```bash
cd /Users/michael/Projects/SAMS/backend/testing
node -e "
import { generatePdf } from '../services/pdfService.js';
import fs from 'fs';

const testHtml = '<html><body><h1>Test</h1><p>Page content</p></body></html>';
const pdf = await generatePdf(testHtml, {
  footerMeta: {
    statementId: 'TEST-UNIT',
    generatedAt: '11/30/2025 12:00',
    language: 'english'
  }
});
fs.writeFileSync('test_pdfshift.pdf', pdf);
console.log('✅ PDFShift working!');
"
```

## Benefits Over Puppeteer

✅ **Dynamic page numbers** - PDFShift injects `pageNumber`/`totalPages` placeholders  
✅ **Footer on every page** - Using `footer.source` option  
✅ **Better page breaks** - Proper paged-media support  
✅ **Smaller files** - Better compression  
✅ **No system dependencies** - No Chrome/Chromium needed  
✅ **Simpler code** - Just API call, no browser management  

## Current Implementation

File: `backend/services/pdfService.js`

Features:
- Uses PDFShift API v3
- Injects footer HTML with statement metadata (`footer.source`)
- Reserves consistent margins via `margin: { top/right/bottom/left }` (bottom = 40 mm for footer clearance)
- Dynamic page numbering via PDFShift placeholders
- Footer on every page ready

Ready to use once API key is configured!

