# Car/Boat Wash Configuration Fields Specification

## Overview
Configuration fields specification for car and boat wash rates to enable usage-based billing in the Water Bills module.

## Field Specifications

### Field Definitions
- **Field Name**: `rateCarWash`
  - **Type**: Integer
  - **Storage Format**: Centavos (following existing monetary field patterns)
  - **Default Value**: 10000 (represents 100 pesos)
  - **Description**: Rate charged per car wash service

- **Field Name**: `rateBoatWash`
  - **Type**: Integer
  - **Storage Format**: Centavos (following existing monetary field patterns)
  - **Default Value**: 20000 (represents 200 pesos)
  - **Description**: Rate charged per boat wash service

### Configuration Location
Based on analysis of existing waterbills configuration structure, these fields should be added to:

**Primary Location**: `/clients/{clientId}/config/waterBills`
- This aligns with existing rate fields like `ratePerM3` and `minimumCharge`
- Maintains consistency with current monetary field storage patterns
- Rate fields will sort together: `rateBoatWash`, `rateCarWash`, `ratePerM3`

**Configuration Structure**:
```javascript
{
  // Existing fields
  ratePerM3: 2739,              // Rate per cubic meter in centavos
  minimumCharge: 0,             // Minimum charge in centavos
  
  // NEW FIELDS TO ADD
  rateCarWash: 10000,           // Car wash rate in centavos (100 pesos)
  rateBoatWash: 20000,          // Boat wash rate in centavos (200 pesos)
  
  // Other existing configuration fields...
  ivaRate: 0,
  penaltyRate: 0.05,
  // etc.
}
```

## Implementation Instructions for Firebase Console

### Step 1: Navigate to Configuration Document
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to: `clients/{your-client-id}/config/waterBills`

### Step 2: Add New Fields
In the configuration document, add these two new fields:

**Field 1: rateCarWash**
- Field name: `rateCarWash`
- Field type: `number`
- Field value: `10000`

**Field 2: rateBoatWash**
- Field name: `rateBoatWash`
- Field type: `number` 
- Field value: `20000`

### Step 3: Update Metadata (Optional but Recommended)
If the document has an `updated` timestamp field, update it to current timestamp to track when these fields were added.

## Monetary Storage Pattern Compliance
These fields follow the established pattern where:
- All monetary values are stored as integers in centavos
- 100 pesos = 10000 centavos
- 200 pesos = 20000 centavos
- This matches the existing `ratePerM3` field storage format

## Integration Notes
When these fields are implemented in application code:
- Convert from centavos to pesos for display: `rateCarWash / 100`
- Convert from pesos to centavos for storage: `pesos * 100`
- Use existing currency formatting utilities that handle centavo conversion

## Field Usage Context
These fields will be used for:
- Calculating charges for car wash services
- Calculating charges for boat wash services
- Generating usage-based bills for water amenity services
- Displaying rates in user interfaces and reports