---
document_type: Critical Implementation Guidelines
priority: MANDATORY
applies_to: All Implementation Agents
last_updated: 2025-12-22
enforcement: STRICT
---

# 🚨 CRITICAL IMPLEMENTATION AGENT CODING GUIDELINES

## ⛔ ABSOLUTE PROHIBITIONS

### **1. NO MCP COMMANDS IN PRODUCTION CODE**
- **MCP tools are ONLY for research and testing**
- **NEVER write production code that calls MCP functions**
- **Use ONLY approved backend API endpoints**
- **All Firebase operations must go through existing backend controllers**

**❌ FORBIDDEN:**
```javascript
// NEVER DO THIS IN PRODUCTION CODE
await mcp_firebase_firestore_get_documents(['clients/AVII/data']);
await mcp_firebase_firestore_update_document({...});
```

**✅ REQUIRED:**
```javascript
// Use existing backend endpoints
const response = await fetch(`${config.api.domainBaseUrl}/water/clients/AVII/data/2026`);
await fetch('/api/clients/AVII/readings', { method: 'POST', body: JSON.stringify(data) });
```

### **2. NO HARDCODED DATES, TIMES, OR TIMEZONES**
- **NEVER hardcode dates like "2025-09-16" or "September 2025"**
- **NEVER use `new Date()` anywhere - ALWAYS use `getNow()` from DateService**
- **NEVER assume timezone (no Date.now(), new Date() without utils)**
- **Use ONLY approved utility functions**

**❌ FORBIDDEN:**
```javascript
// NEVER DO THIS
const currentDate = new Date(); // Wrong timezone - NEVER use new Date()
const timestamp = Date.now(); // Wrong - use getNow()
const month = "September 2025"; // Hardcoded
const dueDate = "2025-09-30"; // Hardcoded
```

**✅ REQUIRED:**
```javascript
// Backend: Use DateService
import { getNow } from '../services/DateService.js';
const currentDate = getNow(); // Correct - Cancun timezone

// Frontend: Use date utilities
import { getNow } from '@/utils/dateUtils';
const currentDate = getNow(); // Correct - Cancun timezone

// Other utilities
import { getCurrentFiscalPeriod, formatFiscalMonth } from '../utils/fiscalYearUtils.js';
const currentPeriod = getCurrentFiscalPeriod(); // Proper fiscal year handling
const monthName = formatFiscalMonth(currentPeriod.month, 'es'); // Localized month names
```

### **3. NO HARDCODED CLIENT DATA**
- **NEVER hardcode client names like "Aventuras Villas II"**
- **NEVER hardcode unit numbers, logo URLs, or contact info**
- **Load ALL client data from Firebase through approved endpoints**

**❌ FORBIDDEN:**
```javascript
// NEVER DO THIS
const clientName = "Aventuras Villas II"; // Hardcoded
const logoUrl = "https://firebase..."; // Hardcoded
const units = ["101", "201", "102"]; // Hardcoded
```

**✅ REQUIRED:**
```javascript
// Load from approved endpoints
const clientResponse = await fetch(`${config.api.baseUrl}/clients/AVII`);
const clientData = clientResponse.data;
const clientName = clientData.name; // Dynamic from Firebase
const logoUrl = clientData.logoUrl; // Dynamic from Firebase
const units = Object.keys(clientData.units || {}); // Dynamic from Firebase
```

## MANDATORY DATA FLOW ARCHITECTURE

- **STORAGE LAYER (Firestore)**
    - ALL amounts stored as INTEGER CENTAVOS
    - NO floating point values in database
    _ Example: $100.00 → stored as 10000
- **BACKEND PROCESSING LAYER**
    `ALL math performed in INTEGER CENTAVOS
    - NO floating point calculations until final conversion
    - Example: 10000 + 20150 = 30150 centavos
- **API RESPONSE LAYER**
    - ALL amounts converted to PESOS (floating point)
    - Currency rounded to 2 decimal places
    - Example: 30150 centavos → 301.50 pesos
- **FRONTEND CONSUMPTION LAYER**
    - ALL money values received as PESOS
    - NO math required - display only
    - Example: Display $301.50 directly

## 📋 MANDATORY UTILITY USAGE

### **Required Imports for All Date/Time Operations:**
```javascript
// ALWAYS import these for date operations
import { getMexicoDateTime, formatMexicoDate } from '../utils/timezone.js';
import { getCurrentFiscalPeriod, getFiscalYear, formatFiscalMonth } from '../utils/fiscalYearUtils.js';
```

### **Required Imports for Currency Operations:**
```javascript
// ALWAYS import these for money operations
import { formatCurrency, centavosToPesos } from '../utils/currencyUtils.js';
```

### **Required Imports for Client Operations:**
```javascript
// ALWAYS use approved API endpoints
import { config } from '../config.js';
// Use config.api.baseUrl, config.api.domainBaseUrl
```

## 🔧 APPROVED BACKEND ENDPOINTS

### **DOMAIN-SPECIFIC PATTERN (CRITICAL):**
**Water Bills Domain:** Use `${config.api.domainBaseUrl}/water/...`
**Communications Domain:** Use `${config.api.domainBaseUrl}/comm/...`
**General APIs:** Use `${config.api.baseUrl}/...`

### **Water Bills Data (DOMAIN-SPECIFIC):**
- `GET ${config.api.domainBaseUrl}/water/clients/{clientId}/data/{year}` - Aggregated water data
- `GET ${config.api.domainBaseUrl}/water/clients/{clientId}/readings/{year}-{month}` - Load readings
- `POST ${config.api.domainBaseUrl}/water/clients/{clientId}/readings` - Save readings

### **Email/Communications (DOMAIN-SPECIFIC):**
- `GET ${config.api.domainBaseUrl}/comm/email/config/templates/{clientId}` - Email templates
- `POST ${config.api.domainBaseUrl}/comm/email/send` - Send emails

### **General Client Data:**
- `GET ${config.api.baseUrl}/clients/{clientId}` - Client info
- `GET ${config.api.baseUrl}/clients/{clientId}/config` - Client configuration

### **❌ WRONG PATTERNS (DO NOT USE):**
```javascript
// WRONG - Old API pattern
GET http://localhost:5001/api/clients/AVII/projects/waterBills/readings/2026-01

// WRONG - Missing domain-specific routing  
GET ${config.api.baseUrl}/water/readings

// CORRECT - Domain-specific pattern
GET ${config.api.domainBaseUrl}/water/clients/AVII/readings/2026-01
```

## 🚨 VALIDATION CHECKLIST

Before submitting any code, verify:

### **✅ Date/Time Compliance:**
- [ ] No hardcoded dates anywhere in code
- [ ] NO `new Date()` calls - all dates use `getNow()` from DateService
- [ ] All fiscal periods use `getCurrentFiscalPeriod()` utility
- [ ] All month names use `formatFiscalMonth()` with proper language

### **✅ Data Source Compliance:**
- [ ] No hardcoded client names, logos, or contact info
- [ ] All client data loaded via approved API endpoints
- [ ] No direct MCP calls in production code
- [ ] All Firebase operations go through backend controllers

### **✅ Currency Compliance:**
- [ ] All money amounts use `formatCurrency()` utility
- [ ] All centavos conversions use `centavosToPesos()` utility
- [ ] No manual currency formatting

### **✅ API Compliance:**
- [ ] All API calls use approved endpoints from this document
- [ ] All URLs use `config.api.baseUrl` or `config.api.domainBaseUrl`
- [ ] No direct Firebase SDK calls in frontend code

## 🛠️ EXISTING UTILITY FUNCTIONS REFERENCE

### **Timezone Utils (`utils/timezone.js`):**
```javascript
getMexicoDateTime() // Current time in America/Cancun
formatMexicoDate(date, locale) // Format date for Mexico timezone
```

### **Fiscal Year Utils (`utils/fiscalYearUtils.js`):**
```javascript
getCurrentFiscalPeriod() // Current fiscal year/month
getFiscalYear(date) // Get fiscal year for date
formatFiscalMonth(month, language) // Format month name (en/es)
```

### **Currency Utils (`utils/currencyUtils.js`):**
```javascript
formatCurrency(centavos, currency, showCents) // Format centavos to currency
centavosToPesos(centavos) // Convert centavos to peso amount
```

## 🎯 TESTING REQUIREMENTS

### **Browser Testing via MCP:**
**All Implementation Agents have access to browser automation via MCP:**
- **Access Method:** Use `mcp_cursor-ide-browser_*` tools for browser interaction
- **Key Tools:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_take_screenshot`
- **Mandatory for UI Tasks:** Browser testing is required for all frontend development
- **Evidence Collection:** Screenshots and test results must be documented in Memory Logs

### **Before Code Submission:**
1. **Test with real client data** (not hardcoded samples)
2. **Test with current fiscal period** (not hardcoded dates)
3. **Test in Mexico timezone** (not local developer timezone)
4. **Verify all API endpoints work** (no MCP dependencies)
5. **Use browser MCP tools to verify UI functionality** (browser_navigate, browser_snapshot, browser_take_screenshot)

### **Code Review Criteria:**
- **Zero hardcoded dates, client names, or timezones**
- **All data loaded dynamically via approved APIs**
- **Proper error handling for API failures**
- **Consistent utility function usage**

## 🚫 IMMEDIATE REJECTION CRITERIA

**Code will be IMMEDIATELY REJECTED if it contains:**
- Any MCP function calls in production code
- Any `new Date()` calls - must use `getNow()` from DateService
- Hardcoded dates like "2025-09-16" or "September 2025"
- Hardcoded client names like "Aventuras Villas II"
- Direct `Date.now()` calls without timezone utilities
- Hardcoded currency amounts or formatting
- Direct Firebase SDK calls in frontend code

## 📞 ESCALATION PROCESS

**If you need data that isn't available via approved endpoints:**
1. **Document the specific data requirement**
2. **Identify which existing endpoint should be enhanced**
3. **Request Manager Agent to create backend enhancement task**
4. **DO NOT create workarounds with MCP or hardcoded data**

---

**Remember: MCP tools are for RESEARCH and TESTING only. Production code must use approved backend endpoints and utility functions. When in doubt, ask for clarification rather than guessing or hardcoding.**