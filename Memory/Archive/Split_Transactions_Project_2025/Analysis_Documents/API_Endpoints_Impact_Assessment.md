# API Endpoints Impact Assessment for Split Transactions

**Document Version:** 1.0  
**Date:** 2025-01-19  
**Author:** APM Implementation Agent  
**Purpose:** Assessment of backend changes required for split transaction functionality

## Executive Summary

Implementing split transaction functionality in SAMS will require significant modifications to the current transaction architecture. The analysis identifies 12 core endpoints requiring modification, 8 new endpoints needed, and extensive changes to validation, business logic, and integration systems. The current single-category model must evolve to support multiple category allocations while maintaining backward compatibility and data integrity.

## 1. Current API Architecture Analysis

### 1.1 Core Transaction Endpoints (Requiring Major Changes)

**Base Path:** `/api/clients/:clientId/transactions`

| Endpoint | Current Function | Split Transaction Impact | Modification Level |
|----------|------------------|--------------------------|-------------------|
| `POST /` | `createTransaction` | Must handle category arrays and amount distribution | **MAJOR** |
| `PUT /:txnId` | `updateTransaction` | Must validate split allocations and recalculate | **MAJOR** |
| `GET /` | `listTransactions` | Must return aggregated category data for display | **MODERATE** |
| `GET /:txnId` | `getTransaction` | Must return complete split allocation data | **MODERATE** |
| `DELETE /:txnId` | `deleteTransaction` | Must handle split-specific cleanup logic | **MODERATE** |

### 1.2 Current Transaction Schema Changes Required

**Existing Single-Category Model:**
```javascript
{
  categoryId: "cat_utilities",      // Single category reference
  categoryName: "Utilities",        // Single category name
  amount: 25000                     // Total amount in cents
}
```

**Required Split-Transaction Model:**
```javascript
{
  // Preserve backward compatibility
  categoryId: "cat_utilities",      // Primary category for legacy compatibility
  categoryName: "Utilities",        // Primary category name for legacy
  amount: 25000,                    // Total transaction amount
  
  // New split allocation fields
  splitAllocations: [               // Array of category allocations
    {
      categoryId: "cat_utilities",
      categoryName: "Utilities",
      amount: 15000,               // $150.00 in cents
      percentage: 60.0,            // 60% of total transaction
      notes: "Electric portion"     // Optional split-specific notes
    },
    {
      categoryId: "cat_maintenance",
      categoryName: "Maintenance",
      amount: 10000,               // $100.00 in cents
      percentage: 40.0,            // 40% of total transaction
      notes: "Repair portion"      // Optional split-specific notes
    }
  ],
  
  // Split metadata
  isSplitTransaction: true,         // Flag for quick identification
  splitType: "manual"               // "manual" or "template" for future automation
}
```

## 2. Required API Endpoint Modifications

### 2.1 Transaction Creation (POST /api/clients/:clientId/transactions)

**Current Implementation:**
- Validates single category assignment
- Creates transaction with single category reference
- Updates single account balance
- Creates single audit log entry

**Required Changes:**

**Request Body Schema:**
```javascript
{
  // Existing fields (preserved for backward compatibility)
  date: "2025-01-19",
  amount: 250.00,
  type: "expense",
  accountId: "acc_checking",
  paymentMethod: "check",
  
  // Enhanced for split transactions
  categoryId: "cat_utilities",      // Primary category (for non-split)
  splitAllocations: [               // Optional - for split transactions
    {
      categoryId: "cat_utilities",
      amount: 150.00,              // Amount allocation
      notes: "Electric portion"     // Optional split notes
    },
    {
      categoryId: "cat_maintenance",
      amount: 100.00,
      notes: "Repair portion"
    }
  ]
}
```

**New Validation Logic:**
- Validate that split allocation amounts sum to total transaction amount
- Validate all category IDs exist and are active
- Validate minimum allocation amount (e.g., $0.01)
- Validate maximum number of split allocations (e.g., 10)
- Ensure no duplicate categories in split allocations

**Enhanced Business Logic:**
- Calculate percentage allocations automatically
- Populate category names for each split allocation
- Set `isSplitTransaction: true` when split allocations provided
- Maintain backward compatibility for single-category transactions

### 2.2 Transaction Update (PUT /api/clients/:clientId/transactions/:txnId)

**Current Implementation:**
- Validates category change
- Recalculates account balance based on amount change
- Updates single category assignment

**Required Changes:**

**Split-Specific Update Logic:**
- Allow conversion from single to split transaction and vice versa
- Validate split allocation changes and amount consistency
- Handle partial split allocation updates
- Recalculate percentages when amounts change

**Advanced Update Scenarios:**
```javascript
// Convert single to split
{
  "operation": "convertToSplit",
  "splitAllocations": [...]
}

// Update split allocations
{
  "operation": "updateSplit",
  "splitAllocations": [
    {
      "categoryId": "cat_utilities",
      "amount": 175.00,           // Changed amount
      "notes": "Updated electric"
    }
  ]
}

// Convert split to single
{
  "operation": "convertToSingle",
  "categoryId": "cat_utilities"
}
```

### 2.3 Transaction Query (GET /api/clients/:clientId/transactions)

**Current Implementation:**
- Returns transactions with single category data
- Supports category-based filtering
- Simple category aggregation

**Required Enhancements:**

**Response Format:**
```javascript
{
  "transactions": [
    {
      "id": "txn_123",
      "amount": 25000,
      "categoryId": "cat_utilities",      // Primary category
      "categoryName": "Utilities",
      "isSplitTransaction": true,
      "splitAllocations": [
        {
          "categoryId": "cat_utilities",
          "categoryName": "Utilities", 
          "amount": 15000,
          "percentage": 60.0,
          "notes": "Electric portion"
        },
        {
          "categoryId": "cat_maintenance",
          "categoryName": "Maintenance",
          "amount": 10000,
          "percentage": 40.0,
          "notes": "Repair portion"
        }
      ]
    }
  ]
}
```

**Enhanced Query Parameters:**
- `includeSplitDetails=true/false` - Control split allocation inclusion
- `categoryId=cat_utilities` - Filter by any category in split allocations
- `splitOnly=true/false` - Filter for split transactions only
- `primaryCategoryId=cat_utilities` - Filter by primary category only

### 2.4 Single Transaction Retrieval (GET /api/clients/:clientId/transactions/:txnId)

**Current Implementation:**
- Returns complete transaction data with single category
- Includes document references and metadata

**Required Changes:**
- Always include complete split allocation data
- Provide split allocation summary statistics
- Include category validation status for each split

## 3. New API Endpoints Required

### 3.1 Split Transaction Validation

**Endpoint:** `POST /api/clients/:clientId/transactions/validate-split`

**Purpose:** Pre-submission validation of split transaction data

**Request Body:**
```javascript
{
  "totalAmount": 250.00,
  "splitAllocations": [
    {
      "categoryId": "cat_utilities",
      "amount": 150.00
    },
    {
      "categoryId": "cat_maintenance", 
      "amount": 100.00
    }
  ]
}
```

**Response:**
```javascript
{
  "valid": true,
  "totalAllocated": 250.00,
  "remainingAmount": 0.00,
  "validationErrors": [],
  "warnings": [
    "Category 'Maintenance' budget will be exceeded by $50.00"
  ]
}
```

### 3.2 Split Transaction Templates

**Endpoint:** `GET /api/clients/:clientId/split-templates`  
**Endpoint:** `POST /api/clients/:clientId/split-templates`  
**Endpoint:** `PUT /api/clients/:clientId/split-templates/:templateId`  
**Endpoint:** `DELETE /api/clients/:clientId/split-templates/:templateId`

**Purpose:** Manage reusable split transaction templates

**Template Structure:**
```javascript
{
  "id": "template_utilities_split",
  "name": "Utilities Split (Electric + Gas)",
  "description": "Standard split for combined utility bills",
  "allocations": [
    {
      "categoryId": "cat_electric",
      "percentage": 70.0,
      "notes": "Electric portion"
    },
    {
      "categoryId": "cat_gas",
      "percentage": 30.0,
      "notes": "Gas portion"
    }
  ],
  "active": true,
  "createdBy": "user_123",
  "created": "2025-01-19T10:00:00Z"
}
```

### 3.3 Split Transaction Analytics

**Endpoint:** `GET /api/clients/:clientId/analytics/split-transactions`

**Purpose:** Analytics and reporting for split transaction usage

**Query Parameters:**
- `startDate` / `endDate` - Date range for analysis
- `categoryId` - Focus on specific category
- `groupBy` - Group by category, month, split-type

**Response:**
```javascript
{
  "summary": {
    "totalSplitTransactions": 45,
    "totalSplitAmount": 125000,
    "averageSplitsPerTransaction": 2.3,
    "mostUsedCategoryCombination": ["cat_utilities", "cat_maintenance"]
  },
  "categoryBreakdown": [
    {
      "categoryId": "cat_utilities",
      "categoryName": "Utilities",
      "totalAllocated": 67500,
      "transactionCount": 30,
      "averageAllocation": 2250
    }
  ]
}
```

## 4. Integration Points Impact Assessment

### 4.1 HOA Dues Integration Impact

**Current Integration:**
- HOA payments create single transactions with category "hoa_dues"
- Transaction metadata includes dues distribution by month

**Split Transaction Impact:**
- **LOW IMPACT** - HOA dues typically remain single-category transactions
- **OPTIONAL ENHANCEMENT** - Could split between "HOA Dues" and "Special Assessments"

**Required Changes:**
```javascript
// Optional HOA split for special assessments
{
  categoryId: "cat_hoa_dues",        // Primary category
  splitAllocations: [
    {
      categoryId: "cat_hoa_dues",
      amount: 20000,                 // Regular dues
      notes: "Monthly HOA dues"
    },
    {
      categoryId: "cat_special_assessment",
      amount: 5000,                  // Special assessment
      notes: "Pool maintenance assessment"
    }
  ]
}
```

### 4.2 Water Bills Integration Impact

**Current Integration:**
- Water payments create single transactions with category "water-consumption"
- Rich transaction notes include bill breakdown

**Split Transaction Enhancement:**
```javascript
// Enhanced water bill splitting
{
  categoryId: "cat_water",          // Primary category
  splitAllocations: [
    {
      categoryId: "cat_water_base",
      amount: 9000,                 // Base consumption charges
      notes: "Base water charges - 18 m³"
    },
    {
      categoryId: "cat_water_penalties",
      amount: 6000,                 // Late payment penalties
      notes: "Late payment penalties"
    },
    {
      categoryId: "cat_water_extras",
      amount: 3000,                 // Car wash fees
      notes: "1 car wash fee"
    }
  ]
}
```

### 4.3 Account Balance Integration Impact

**Current System:**
- Single transaction amount affects single account balance
- Account balance recalculation processes all transactions

**Split Transaction Considerations:**
- **NO CHANGE** - Account balance affected by total transaction amount only
- Split allocations don't directly affect account balances
- Category budget tracking affected by individual split allocations

## 5. Validation and Business Logic Changes

### 5.1 Enhanced Transaction Validation

**Current Validation Rules:**
- Required fields: date, amount, type, clientId
- Single category existence validation
- Amount sign consistency with transaction type

**New Split Transaction Validation:**

**Amount Validation:**
```javascript
{
  rules: [
    "Split allocation amounts must sum exactly to transaction total",
    "Each allocation must be at least $0.01",
    "Maximum 10 split allocations per transaction",
    "No duplicate categories in split allocations"
  ],
  implementation: {
    totalCheck: "Math.abs(totalAmount - sumOfAllocations) < 0.01",
    minimumAllocation: "allocation.amount >= 0.01",
    maximumSplits: "splitAllocations.length <= 10",
    uniqueCategories: "new Set(categoryIds).size === categoryIds.length"
  }
}
```

**Category Validation:**
- All split allocation categories must exist and be active
- Category types must be compatible with transaction type
- Budget impact warnings for categories approaching limits

### 5.2 Business Logic Enhancements

**Percentage Calculation:**
```javascript
function calculatePercentages(splitAllocations, totalAmount) {
  return splitAllocations.map(allocation => ({
    ...allocation,
    percentage: (allocation.amount / totalAmount) * 100
  }));
}
```

**Backward Compatibility Logic:**
```javascript
function ensureBackwardCompatibility(transaction) {
  if (transaction.isSplitTransaction) {
    // Set primary category to largest allocation
    const primaryAllocation = transaction.splitAllocations
      .reduce((max, current) => current.amount > max.amount ? current : max);
    
    transaction.categoryId = primaryAllocation.categoryId;
    transaction.categoryName = primaryAllocation.categoryName;
  }
}
```

## 6. Database Schema Migration Strategy

### 6.1 Additive Schema Changes

**Phase 1: Add Split Fields (Non-Breaking)**
```javascript
// Add new fields without modifying existing ones
{
  // Existing fields preserved
  categoryId: "cat_utilities",
  categoryName: "Utilities",
  amount: 25000,
  
  // New fields added
  splitAllocations: [],           // Default empty array
  isSplitTransaction: false,      // Default false
  splitType: null                 // Default null
}
```

**Phase 2: Data Migration**
- Convert existing transactions to new format
- Populate `isSplitTransaction: false` for all existing transactions
- Create single-element `splitAllocations` array for existing transactions

**Phase 3: Cleanup (Optional)**
- Remove legacy fields after confirmation of successful migration
- Update all queries to use new format

### 6.2 Migration Utility Requirements

**Endpoint:** `POST /api/admin/migrate-split-transactions`

**Migration Process:**
1. Backup existing transaction data
2. Add new schema fields to all transactions
3. Convert single-category transactions to split format
4. Validate data integrity
5. Update application code to use new format
6. Monitor for issues and rollback capability

## 7. Performance and Scalability Considerations

### 7.1 Query Performance Impact

**Current Queries:**
- Simple category filtering: `WHERE categoryId = 'cat_utilities'`
- Category aggregation: `GROUP BY categoryId`

**Split Transaction Queries:**
- Category filtering requires array queries: `WHERE categoryId IN splitAllocations`
- Aggregation requires flattening: complex aggregation across split allocations

**Required Firestore Index Changes:**
```javascript
// New compound indexes required
indexes: [
  {
    collection: "transactions",
    fields: ["clientId", "isSplitTransaction", "date"]
  },
  {
    collection: "transactions", 
    fields: ["clientId", "splitAllocations.categoryId", "date"]
  }
]
```

### 7.2 Response Size Considerations

**Current Response Size:** ~500 bytes per transaction
**Split Transaction Response:** ~800-1200 bytes per transaction (depending on split count)

**Optimization Strategies:**
- Optional split detail inclusion in list queries
- Pagination limits may need adjustment
- Client-side caching of split allocation data

## 8. Security and Authorization Impact

### 8.1 Permission Model Changes

**Current Permissions:**
- Transaction creation requires client access
- Category assignment requires category access

**Split Transaction Permissions:**
- User must have access to ALL categories in split allocation
- Enhanced permission checking for category combinations
- Audit trail must capture all category assignments

### 8.2 Audit Trail Enhancements

**Current Audit Trail:**
- Transaction creation/update/deletion logged
- Single category change tracked

**Enhanced Audit Trail:**
```javascript
{
  auditEvent: "split_transaction_created",
  transactionId: "txn_123",
  userId: "user_456",
  timestamp: "2025-01-19T10:00:00Z",
  details: {
    totalAmount: 25000,
    splitCount: 2,
    allocations: [
      {
        categoryId: "cat_utilities",
        amount: 15000,
        percentage: 60.0
      },
      {
        categoryId: "cat_maintenance", 
        amount: 10000,
        percentage: 40.0
      }
    ]
  }
}
```

## 9. Error Handling and Edge Cases

### 9.1 Split Transaction Error Scenarios

**Validation Errors:**
- Split amounts don't sum to total
- Invalid category references
- Insufficient permissions for categories
- Budget limit violations

**Business Logic Errors:**
- Circular split dependencies (future consideration)
- Invalid split conversion requests
- Template application failures

**Data Integrity Errors:**
- Split allocation corruption
- Category reference inconsistencies
- Percentage calculation errors

### 9.2 Rollback and Recovery

**Transaction Rollback:**
- Atomic split transaction creation/update
- Rollback capability for failed split conversions
- Data repair utilities for corrupted split allocations

**Error Recovery:**
```javascript
// Split allocation repair utility
POST /api/admin/repair-split-allocations/:transactionId
{
  "repairType": "recalculate_percentages" | "fix_amounts" | "rebuild_split"
}
```

## 10. Testing Strategy Requirements

### 10.1 Unit Test Coverage

**Split Transaction Creation:**
- Valid split allocation combinations
- Invalid amount distributions
- Category permission validation
- Backward compatibility preservation

**Split Transaction Updates:**
- Split to single conversion
- Single to split conversion
- Split allocation modifications
- Error handling scenarios

### 10.2 Integration Test Requirements

**End-to-End Workflows:**
- Complete split transaction creation workflow
- HOA/Water bill integration with split transactions
- Account balance accuracy with split transactions
- Category budget tracking with split allocations

**Performance Testing:**
- Large split transaction queries
- Category filtering with split allocations
- Report generation with split transaction data

## Implementation Priority Matrix

| Change Category | Priority | Complexity | Risk Level | Implementation Order |
|-----------------|----------|------------|------------|---------------------|
| Core Transaction CRUD | HIGH | HIGH | MEDIUM | 1 |
| Database Schema Migration | HIGH | MEDIUM | HIGH | 2 |
| Split Validation Logic | HIGH | MEDIUM | LOW | 3 |
| UI Integration Points | MEDIUM | HIGH | MEDIUM | 4 |
| Analytics Endpoints | LOW | LOW | LOW | 5 |
| Template System | LOW | MEDIUM | LOW | 6 |

The split transaction implementation requires careful planning and phased rollout to maintain system stability while adding comprehensive new functionality to the transaction management system.