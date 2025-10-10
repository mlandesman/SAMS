---
agent_type: Implementation_Agent
task_id: Domain_Specific_Endpoint_Standardization
priority: CRITICAL
estimated_duration: 4-6 hours
phase: Architecture Standardization - Domain-Specific URL Pattern Implementation
dependencies: PWA water meter screens completion, existing /water and /comm domain patterns
---

# Implementation Agent Task: Domain-Specific Endpoint Standardization

## 🎯 Task Objective
Standardize ALL API calls across the entire codebase to use proper domain-specific endpoint patterns. Eliminate old API patterns and ensure consistent routing architecture for water bills and communications domains.

## 🚨 CRITICAL BUSINESS IMPACT
**Current Issue:** PWA and frontend code using incorrect endpoint patterns causing 500 errors and system failures.
**Root Cause:** Mixed endpoint patterns across codebase - some using old `/api/clients/...` and some using correct domain-specific routing.
**Solution:** Comprehensive standardization to domain-specific patterns used by working backends.

## 📋 Endpoint Pattern Analysis

### **✅ CORRECT PATTERNS (Target Architecture):**

#### **Water Bills Domain:**
```javascript
// Aggregated data (working)
GET ${config.api.domainBaseUrl}/water/clients/{clientId}/data/{year}

// Readings operations (target pattern)
GET ${config.api.domainBaseUrl}/water/clients/{clientId}/readings/{year}-{month}
POST ${config.api.domainBaseUrl}/water/clients/{clientId}/readings
```

#### **Communications Domain:**
```javascript
// Email templates (working)
GET ${config.api.domainBaseUrl}/comm/email/config/templates/{clientId}

// Email sending (target pattern)
POST ${config.api.domainBaseUrl}/comm/email/send
```

#### **General Client APIs:**
```javascript
// Client info (working)
GET ${config.api.baseUrl}/clients/{clientId}
GET ${config.api.baseUrl}/clients/{clientId}/config
```

### **❌ INCORRECT PATTERNS (Current Problems):**

#### **PWA Water Meter Error:**
```javascript
// WRONG - Causing 500 errors
GET http://localhost:5001/api/clients/AVII/projects/waterBills/readings/2026-01

// CORRECT - Domain-specific pattern
GET ${config.api.domainBaseUrl}/water/clients/AVII/readings/2026-01
```

#### **Legacy API Patterns:**
```javascript
// WRONG - Old nested project structure
/api/clients/{clientId}/projects/waterBills/...

// WRONG - Missing domain routing
${config.api.baseUrl}/water/...

// CORRECT - Domain-specific with client context
${config.api.domainBaseUrl}/water/clients/{clientId}/...
```

## 🔍 Files Requiring Standardization

### **Frontend PWA (Mobile App):**
- `frontend/mobile-app/src/services/waterReadingService.js` - **CRITICAL (causing current errors)**
- `frontend/mobile-app/src/components/WaterMeterEntryNew.jsx` - API calls
- `frontend/mobile-app/src/utils/` - Any API utility functions

### **Frontend Main UI:**
- `frontend/sams-ui/src/views/DigitalReceiptDemo.jsx` - Water bill template fetching
- `frontend/sams-ui/src/services/` - All service files
- `frontend/sams-ui/src/api/` - API configuration and calls

### **Backend Routes (Verification):**
- `backend/routes/email.js` - Ensure domain-specific routing
- `backend/routes/emailRoutes.js` - Communications domain
- `backend/routes/water.js` - Water bills domain (if exists)

## 🚀 Implementation Plan

### **Phase 1: PWA Critical Fixes (Immediate)**

#### **Fix waterReadingService.js:**
```javascript
// Current broken pattern
const response = await fetch(`${config.api.baseUrl}/clients/${clientId}/projects/waterBills/readings/${yearMonth}`);

// Correct domain-specific pattern
const response = await fetch(`${config.api.domainBaseUrl}/water/clients/${clientId}/readings/${yearMonth}`);
```

#### **Update WaterMeterEntryNew.jsx:**
```javascript
// Ensure all water-related API calls use domain-specific pattern
import { config } from '../config.js';

// Previous readings
const previousReadings = await fetch(`${config.api.domainBaseUrl}/water/clients/${clientId}/readings/${previousPeriod}`);

// Save readings
const saveResponse = await fetch(`${config.api.domainBaseUrl}/water/clients/${clientId}/readings`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(readingsData)
});
```

### **Phase 2: Main UI Standardization**

#### **DigitalReceiptDemo.jsx:**
```javascript
// Email templates (already correct)
const response = await fetch(`${config.api.domainBaseUrl}/comm/email/config/templates/AVII`, { headers });

// Water data (verify pattern)
const waterData = await fetch(`${config.api.domainBaseUrl}/water/clients/AVII/data/2026`, { headers });
```

#### **Service Files Audit:**
- Review ALL service files for API calls
- Standardize to domain-specific patterns
- Update import statements for config usage

### **Phase 3: Backend Route Verification**

#### **Ensure Backend Supports Patterns:**
- Verify `/water/clients/{clientId}/readings` endpoints exist
- Confirm `/comm/email/send` endpoints are implemented
- Add missing routes if domain-specific patterns not fully supported

## 🔧 Configuration Requirements

### **Config Import Pattern:**
```javascript
// Ensure all files import config correctly
import { config } from '../config.js'; // Adjust path as needed

// Use proper config properties
const waterApiUrl = config.api.domainBaseUrl; // For /water and /comm
const generalApiUrl = config.api.baseUrl; // For general /clients
```

### **Environment Configuration:**
```javascript
// Verify config.js contains both properties
export const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001',
    domainBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'
  }
};
```

## ✅ Success Criteria

### **Functional Requirements:**
- ✅ PWA water meter screens load previous readings without 500 errors
- ✅ All water bill API calls use `/water/clients/{clientId}/...` pattern
- ✅ All communication API calls use `/comm/email/...` pattern
- ✅ No hardcoded localhost URLs anywhere in code
- ✅ Consistent config.api usage across all files

### **Architecture Requirements:**
- ✅ Domain-specific routing pattern implemented consistently
- ✅ No legacy `/api/clients/{clientId}/projects/...` patterns remaining
- ✅ Clear separation between domain-specific and general APIs
- ✅ All service files follow same endpoint patterns

### **Testing Requirements:**
- ✅ PWA water meter entry loads without errors
- ✅ Water bill template demo works correctly
- ✅ Email sending functionality maintains domain-specific routing
- ✅ No 404 or 500 errors from endpoint pattern mismatches

## 🔍 Testing Protocol

### **Immediate Testing (Phase 1):**
1. **Test PWA water meter entry**: Verify previous readings load correctly
2. **Check browser network logs**: Confirm domain-specific URLs being called
3. **Test readings save functionality**: Ensure POST requests use correct pattern

### **Full System Testing (Phase 2-3):**
1. **Water bill template demo**: Verify all API calls work
2. **Email functionality**: Test template fetching and sending
3. **Cross-client testing**: Verify patterns work for both AVII and MTC
4. **Error handling**: Ensure proper error messages for failed requests

## 📞 Manager Agent Coordination

### **Completion Verification Required:**
- **Network logs screenshots**: Show domain-specific URLs being called
- **PWA functionality demo**: Water meter entry working without errors
- **Code review confirmation**: All files using correct patterns
- **Backend route verification**: Confirm all required endpoints exist

### **Escalation Criteria:**
- **Missing backend routes**: If domain-specific patterns not supported
- **Config issues**: If environment variables need adjustment
- **Cross-domain problems**: If domain-specific routing causes CORS issues

## 🎯 Business Priorities

### **Immediate (Critical):**
1. **Fix PWA 500 errors** - Water meter entry must work for field workers
2. **Standardize water bill APIs** - Ensure billing system reliability

### **Short-term (High):**
1. **Communications domain consistency** - Email system reliability
2. **Remove legacy patterns** - Prevent future confusion and errors

### **Long-term (Medium):**
1. **Documentation update** - Ensure coding guidelines reflect reality
2. **Developer training** - Prevent regression to old patterns

---

**Implementation Agent Instructions:** Focus on eliminating the immediate PWA 500 errors first, then systematically standardize all endpoint patterns. Use the working domain-specific examples (like DigitalReceiptDemo water data fetching) as reference patterns. Test thoroughly to ensure all changes work correctly before marking complete.