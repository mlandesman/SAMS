# Unified baseURL Configuration Design

## Overview

This document details the design for eliminating the dual baseURL configuration pattern and implementing a single, predictable API configuration approach.

## Current Problem Summary

**Root Issue**: The system forces agents to choose between:
- `config.api.baseUrl` → Results in `/api/xyz` (legacy)
- `config.api.domainBaseUrl` → Results in `/xyz` (clean domain)

**Consequences**:
- Double-prefix errors (`/api/api/`)
- Authentication contamination across modules
- Mobile/desktop configuration drift
- Implementation Agent confusion

## Unified Configuration Strategy

### Core Principle: Single Decision Point

Instead of dual baseURL patterns, implement **one clean baseURL** that works with domain-specific routing.

```javascript
// NEW: Single baseURL approach
export const config = {
  api: {
    baseUrl: getDomainApiUrl(), // Clean base URL (no /api suffix)
    timeout: 30000,
  }
}

// Usage becomes predictable:
// {baseUrl}/auth/login
// {baseUrl}/accounting/clients/123/transactions  
// {baseUrl}/water/clients/123/data
// {baseUrl}/public/exchangeRates
```

## Implementation Plan

### 1. Configuration File Changes

#### Desktop Configuration (frontend/sams-ui/src/config/index.js)

**BEFORE**:
```javascript
const getApiUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (import.meta.env.PROD) {
    return 'https://backend-liart-seven.vercel.app/api';  // Legacy with /api
  }
  return 'http://localhost:5001/api';  // Legacy with /api
};

const getDomainApiUrl = () => {
  if (import.meta.env.VITE_DOMAIN_API_BASE_URL) {
    return import.meta.env.VITE_DOMAIN_API_BASE_URL;
  }
  if (import.meta.env.PROD) {
    return 'https://backend-liart-seven.vercel.app';  // Clean domain
  }
  return 'http://localhost:5001';  // Clean domain
};

export const config = {
  api: {
    baseUrl: getApiUrl(),                    // PROBLEMATIC: Legacy /api
    domainBaseUrl: getDomainApiUrl(),       // PROBLEMATIC: Clean domain
  }
}
```

**AFTER**:
```javascript
// Unified configuration approach
const getUnifiedApiUrl = () => {
  // 1. Explicit environment variable (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 2. Production environment auto-detection
  if (import.meta.env.PROD) {
    return 'https://backend-liart-seven.vercel.app';  // Clean base (no /api)
  }
  
  // 3. Development fallback
  return 'http://localhost:5001';  // Clean base (no /api)
};

export const config = {
  api: {
    baseUrl: getUnifiedApiUrl(),  // SINGLE baseURL - no choice required
    timeout: 30000,
  },
  
  // Rest of config remains the same...
  firebase: { /* ... */ },
  environment: { /* ... */ },
  features: { /* ... */ },
  app: { /* ... */ }
}
```

#### Mobile PWA Configuration

**BEFORE** (hardcoded):
```javascript
// mobile-app/src/api/waterAPI.js
const API_CONFIG = {
  baseUrl: 'http://localhost:5001/api',      // PROBLEMATIC: Hardcoded + legacy
  domainBaseUrl: 'http://localhost:5001'     // PROBLEMATIC: Hardcoded + dual
};
```

**AFTER** (centralized):
```javascript
// mobile-app/src/config/index.js (NEW FILE)
import { config } from '../../../sams-ui/src/config/index.js';

// Reuse desktop configuration for consistency
export { config };

// mobile-app/src/api/waterAPI.js  
import { config } from '../config/index.js';

class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;  // SINGLE baseURL, centralized
  }
}
```

### 2. API Service Updates

#### Water API Service Standardization

**BEFORE** (mixed patterns):
```javascript
class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;                // Legacy /api/
    this.domainBaseUrl = config.api.domainBaseUrl;    // Clean domain
  }

  async getMeters(clientId) {
    // PROBLEMATIC: Uses legacy baseUrl
    const response = await fetch(
      `${this.baseUrl}/clients/${clientId}/projects/waterBills/meters`
    );
  }

  async getConfig(clientId) {
    // PROBLEMATIC: Uses domain baseUrl  
    const response = await fetch(
      `${this.domainBaseUrl}/water/clients/${clientId}/config`
    );
  }
}
```

**AFTER** (unified pattern):
```javascript
class WaterAPI {
  constructor() {
    this.baseUrl = config.api.baseUrl;  // SINGLE baseURL
  }

  async getMeters(clientId) {
    // CLEAN: Predictable domain route
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/meters`
    );
  }

  async getConfig(clientId) {
    // CLEAN: Consistent pattern
    const response = await fetch(
      `${this.baseUrl}/water/clients/${clientId}/config`
    );
  }
}
```

#### User API Service Updates

**BEFORE**:
```javascript
const API_BASE_URL = config.api.baseUrl;  // → '/api/user/profile'

export const userAPI = {
  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/user/profile`);
  }
}
```

**AFTER**:
```javascript
const API_BASE_URL = config.api.baseUrl;  // → '/auth/user/profile'

export const userAPI = {
  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/auth/user/profile`);
  }
}
```

### 3. Backend Route Migration Coordination

The frontend changes must coordinate with backend route migration:

#### Legacy Routes (To Be Migrated)
```javascript
// Current backend mounting
app.use('/api/user', userRoutes);           // → /auth/user
app.use('/api/clients', clientRoutes);      // → /accounting/clients or /properties/clients  
app.use('/api/admin', adminRoutes);         // → /admin
```

#### Target Routes (After Migration)
```javascript
// New backend mounting
app.use('/auth', authRoutes);               // User + authentication
app.use('/accounting', accountingRoutes);   // Transactions, balances
app.use('/properties', propertiesRoutes);   // Units, vendors, documents
app.use('/admin', adminRoutes);             // Administrative functions

// Already migrated (good examples)
app.use('/water', waterRoutes);             // ✅ Water billing
app.use('/system', systemRoutes);           // ✅ System services  
app.use('/comm', commRoutes);               // ✅ Communications
```

## Environment Variable Strategy

### Development Environment
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:5001
```

### Production Environment  
```bash
# .env.production
VITE_API_BASE_URL=https://backend-liart-seven.vercel.app
```

### Environment-Specific Overrides
```bash
# Custom deployment
VITE_API_BASE_URL=https://custom-backend.example.com
```

## Migration Benefits

### For Implementation Agents
- ✅ **Single Decision Point**: Only `config.api.baseUrl` exists
- ✅ **Predictable Patterns**: Always `{baseUrl}/{domain}/{resource}`
- ✅ **No Double-Prefix Errors**: Impossible to create `/api/api/`
- ✅ **Domain Isolation**: Changes to one domain don't affect others
- ✅ **Consistent Mobile/Desktop**: Same configuration approach

### For Development Teams
- ✅ **Simplified Configuration**: One baseURL to manage
- ✅ **Environment Consistency**: Same pattern across dev/staging/prod
- ✅ **Reduced Debugging**: No confusion about which URL to use
- ✅ **Maintainable Code**: Clear domain boundaries

## Rollout Strategy

### Phase 2A: Configuration Preparation
1. Update desktop config to single baseURL pattern
2. Create mobile config that reuses desktop configuration
3. Update environment variables to clean base URLs

### Phase 2B: Service Standardization  
1. Update all frontend API services to use single baseURL
2. Remove all references to `domainBaseUrl`
3. Standardize endpoint patterns to domain-specific routes

### Phase 2C: Verification
1. Test that all API calls use consistent baseURL
2. Verify no double-prefix errors are possible
3. Confirm mobile/desktop configuration alignment

## Success Criteria

1. **Zero baseURL Decision Points**: Agents never choose between URLs
2. **Impossible Double-Prefix**: No `/api/api/` errors can occur
3. **Domain Predictability**: All endpoints follow `/{domain}/{resource}`
4. **Configuration Unification**: Mobile and desktop use same approach
5. **Implementation Agent Clarity**: Clear, predictable API patterns

This unified design eliminates the root cause of Implementation Agent confusion while maintaining backward compatibility during the migration period.