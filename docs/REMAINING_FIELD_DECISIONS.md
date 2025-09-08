# Remaining Field Standard Decisions

**Date**: 2025-01-03  
**Purpose**: Final decisions needed before import script updates

## Decisions Still Needed

### 1. User Collection Structure
**Context**: Do we need multi-unit support for users?

**Option A: Simple Structure** (Current)
```javascript
{
  email: "owner@example.com",
  clientId: "MTC",
  unitId: "1A",
  role: "Owner",
  firstName: "John",
  lastName: "Doe"
}
```

**Option B: Multi-Unit Support**
```javascript
{
  email: "owner@example.com",
  profile: {
    firstName: "John",
    lastName: "Doe"
  },
  clientAccess: {
    "MTC": {
      role: "Owner",
      units: ["1A", "2B", "3C"]
    }
  }
}
```

**Consideration**: Some owners have multiple units. Current system assumes one unit per user account.

### 2. Amount Storage Format
**Context**: Prevent floating point issues

**Recommendation**: Store as **cents** (integers)
```javascript
{
  amount: 150000,  // $1,500.00
  // Display logic: amount / 100
}
```
**Benefits**: No floating point errors, easier calculations

### 3. Soft Delete Pattern
**Context**: How to handle deleted records

**Option A: Timestamp-based**
```javascript
{
  isActive: true,  // or false
  deletedAt: null, // or "2025-01-03T14:30:00.000-05:00"
  deletedBy: null  // or "userId"
}
```

**Option B: Status field**
```javascript
{
  status: "active" | "deleted" | "archived"
}
```

**Recommendation**: Option A for richer audit trail

### 4. ID Generation Pattern
**Context**: Consistent, readable IDs

**Recommendation**: **Prefixed IDs**
```javascript
{
  vendorId: "ven_abc123xyz",
  categoryId: "cat_maintenance",
  userId: "usr_john_doe",
  transactionId: "trn_2025_0001"
}
```

**Benefits**: 
- Human readable
- Type obvious from ID
- Sortable if needed

### 5. Document Deletion Policy
**Context**: What happens to related data when parent deleted?

**Questions**:
- Delete vendor → what happens to transactions with that vendor?
- Delete unit → what happens to transactions for that unit?
- Delete user → what happens to their created transactions?

**Options**:
1. **Soft delete only** - Never actually delete, just mark inactive
2. **Cascade soft delete** - Mark parent and children as deleted
3. **Preserve history** - Delete parent but keep historical transactions

### 6. Multi-Client Considerations
**Context**: Preparing for multiple clients

**Questions**:
1. Can vendors be shared across clients? (Probably no)
2. Can categories be standardized across clients? (Maybe yes)
3. Can users access multiple clients? (SuperAdmin yes, others no)
4. Should we have global vs client-specific categories?

### 7. Currency and Internationalization
**Context**: Mexico deployment but USD currency

**Decisions Needed**:
1. Store currency code with amounts? `{ amount: 150000, currency: "MXN" }`
2. Exchange rate handling for reports?
3. Decimal places (MXN uses 2, same as USD)

### 8. Validation Rules
**Context**: Standardize what's valid

**Questions**:
1. Minimum/maximum transaction amounts?
2. Date ranges (how far back/forward)?
3. Required fields by transaction type?
4. Character limits for descriptions?

### 9. Performance Indexes
**Context**: Which fields need Firestore indexes?

**Likely Candidates**:
- transactions: date + clientId
- transactions: unitId + date
- transactions: vendorId + date
- transactions: categoryId + type
- users: email + clientId

### 10. Audit Trail Depth
**Context**: How much history to keep?

**Options**:
1. **Minimal**: Just createdAt/By, updatedAt/By
2. **Medium**: Above + version number
3. **Full**: Above + change history array

```javascript
// Full audit example
{
  audit: {
    createdAt: "...",
    createdBy: "...",
    updatedAt: "...",
    updatedBy: "...",
    version: 3,
    changes: [
      {
        timestamp: "...",
        userId: "...",
        fields: ["amount", "description"],
        oldValues: { amount: 100000 },
        newValues: { amount: 150000 }
      }
    ]
  }
}
```

## Quick Decision Matrix

| Decision | Recommendation | Why |
|----------|----------------|-----|
| User Structure | Multi-unit support | Owners have multiple units |
| Amount Format | Cents (integer) | Avoid float errors |
| Soft Delete | Timestamp-based | Better audit trail |
| ID Pattern | Prefixed | Human readable |
| Document Deletion | Soft delete only | Preserve history |
| Vendor Sharing | No | Client isolation |
| Currency Field | Yes | Future-proofing |
| Audit Depth | Medium | Balance of info vs storage |

## Next Steps

Once these decisions are made:
1. Update FIELD_STANDARDS_DECISIONS.md
2. Create validation rule document
3. Update import scripts
4. Create data dictionary entries

---

**Please confirm or adjust these recommendations so we can proceed with implementation.**