# SAMS Shared Utilities

This directory contains shared utilities and services that are reusable across all SAMS modules (Water Bills, HOA Dues, Reports, Propane Tanks).

## Purpose

The shared utilities were extracted from the Water Bills module (Priority 0B - Phase 3A) to enable code reuse and maintain consistency across the SAMS platform.

## Directory Structure

```
shared/
├── services/          # Core services (DateService, etc.)
├── utils/             # Utility functions (currency, validation, etc.)
├── version-history/   # Version tracking data
└── README.md         # This file
```

## Core Utilities

### Services (`shared/services/`)

#### DateService.js
- **Purpose**: Timezone-aware date handling for America/Cancun
- **Key Functions**:
  - `getNow()` - MUST be used instead of `new Date()` throughout SAMS
  - `formatForFrontend()` - Convert Firestore timestamps to frontend format
  - `parseFromFrontend()` - Parse user input dates to Firestore timestamps
  - `getDateRange()` - Get date ranges for periods (today, week, month, fiscal_year)
- **Reusable by**: All modules (100%)
- **Critical**: All dates MUST use America/Cancun timezone

### Utilities (`shared/utils/`)

#### currencyUtils.js
- **Purpose**: Currency formatting and conversion for Mexican Peso (MXN)
- **Key Functions**:
  - `formatCurrency(centavos, currency, showCents)` - Format centavos to currency string
  - `centavosToPesos(centavos)` - Convert centavos to pesos
  - `pesosToCentavos(pesos)` - Convert pesos to centavos
- **Reusable by**: All financial modules (100%)
- **Critical**: All financial amounts stored as integer centavos

#### centavosValidation.js
- **Purpose**: Eliminate floating point errors in financial calculations
- **Key Functions**:
  - `validateCentavos(value, fieldName, tolerance)` - Validate single centavos value
  - `validateCentavosInObject(obj, parentPath)` - Recursively validate all centavos fields
  - `validateCentavosBatch(objects, batchName)` - Validate arrays of objects
- **Reusable by**: All financial modules (100%)
- **Critical**: Prevents floating point contamination in Firestore

#### databaseFieldMappings.js
- **Purpose**: Standardized field name mappings and database utilities
- **Key Exports**:
  - `convertToTimestamp(dateValue)` - Convert to Firestore timestamp (Cancun timezone)
  - `convertFromTimestamp(timestamp)` - Convert from Firestore timestamp
  - `dollarsToCents(dollars)` / `centsToDollars(cents)` - Legacy currency conversion
  - `generateTransactionId(isoDateString)` - Generate unique transaction IDs
  - `FIELD_STANDARDS` - Standard field naming conventions
- **Reusable by**: All modules (100%)
- **Critical**: Ensures consistent timezone and field naming

## Usage Guidelines

### Date Handling
```javascript
// CORRECT - Use getNow() from DateService
import { getNow } from '@/shared/services/DateService.js';
const currentDate = getNow();

// WRONG - Never use new Date() directly
const currentDate = new Date(); // ❌ FORBIDDEN
```

### Currency Formatting
```javascript
// Backend - All amounts stored as integer centavos
import { pesosToCentavos, centavosToPesos, formatCurrency } from '@/shared/utils/currencyUtils.js';

const amountInCentavos = pesosToCentavos(100.50); // 10050
const amountInPesos = centavosToPesos(10050); // 100.5
const formatted = formatCurrency(10050); // "$100.50"
```

### Centavos Validation
```javascript
// Before writing to Firestore
import { validateCentavosInObject } from '@/shared/utils/centavosValidation.js';

const cleanData = validateCentavosInObject(billData);
await db.collection('bills').doc(billId).set(cleanData);
```

### Database Field Mappings
```javascript
// Transaction ID generation
import { databaseFieldMappings } from '@/shared/utils/databaseFieldMappings.js';

const transactionId = await databaseFieldMappings.generateTransactionId();
// Returns: "2026-07-15_143022_847" (Cancun timezone)
```

## Architecture Principles

### 1. Timezone Consistency
- **ALL dates MUST use America/Cancun timezone**
- **NEVER use `new Date()` - ALWAYS use `getNow()` from DateService**
- Fiscal year runs July 1 - June 30

### 2. Currency Architecture
- **Storage Layer**: ALL amounts as INTEGER CENTAVOS in Firestore
- **Processing Layer**: ALL math in INTEGER CENTAVOS
- **API Response Layer**: Amounts converted to PESOS (float)
- **Frontend Layer**: Display PESOS only (no math)

### 3. ES6 Modules Only
- **NEVER use CommonJS** (`module.exports`, `require()`)
- Always use ES6 imports/exports

### 4. Validation Before Storage
- Run `validateCentavosInObject()` before ALL Firestore writes
- Prevents floating point contamination
- Logs warnings for automatic corrections

## Reusability Map

| Utility | Water Bills | HOA Dues | Reports | Propane Tanks |
|---------|-------------|----------|---------|---------------|
| DateService | ✅ | ✅ | ✅ | ✅ |
| currencyUtils | ✅ | ✅ | ✅ | ✅ |
| centavosValidation | ✅ | ✅ | ✅ | ✅ |
| databaseFieldMappings | ✅ | ✅ | ✅ | ✅ |

**100% reusability across all SAMS modules**

## Import Paths

### Backend Imports
```javascript
// From backend/services/
import { getNow, DateService } from '../../shared/services/DateService.js';

// From backend/utils/
import { formatCurrency, centavosToPesos, pesosToCentavos } from '../../shared/utils/currencyUtils.js';
import { validateCentavos, validateCentavosInObject } from '../../shared/utils/centavosValidation.js';
import { databaseFieldMappings } from '../../shared/utils/databaseFieldMappings.js';

// From backend/controllers/
import { getNow } from '../../shared/services/DateService.js';
import { formatCurrency } from '../../shared/utils/currencyUtils.js';
```

### Frontend Imports
```javascript
// From frontend/src/components/
import { getNow } from '@/shared/services/DateService.js';
import { formatCurrency } from '@/shared/utils/currencyUtils.js';
```

## Migration Status

### Phase 3A - Extract Core Utilities (Current)
- [x] Create shared directory structure
- [ ] Extract Currency Utilities
- [ ] Extract Date Service
- [ ] Extract Centavos Validation
- [ ] Extract Database Field Mappings
- [ ] Refactor Water Bills to use shared utilities

### Future Phases
- Phase 3B: Extract Payment System
- Phase 3C: Extract Penalty System
- Phase 3D: Extract UI Components
- Phase 4: HOA Dues Refactor (will consume all shared utilities)

## Testing Requirements

When modifying shared utilities:
1. **Test with real AVII client data** (not hardcoded samples)
2. **Test with current fiscal period** (not hardcoded dates)
3. **Test in Mexico timezone** (America/Cancun)
4. **Verify all API endpoints work** (no MCP dependencies)
5. **Run manual tests** (SAMS has low automated test coverage)

## Documentation

- **Reusability Analysis**: `/docs/WATER_BILLS_REUSABILITY_ANALYSIS.md`
- **Implementation Plan**: `/apm_session/Implementation_Plan.md`
- **Task Tracking**: `/PROJECT_TRACKING_MASTER.md`
- **Active Modules**: `/ACTIVE_MODULES.md`

---

**Last Updated**: October 27, 2025  
**Task**: Priority_0B_Phase_3A_Extract_Core_Utilities  
**Status**: In Progress

