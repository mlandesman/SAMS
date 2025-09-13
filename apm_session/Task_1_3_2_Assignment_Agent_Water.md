# Task 1.3.2 Assignment - Agent_Water

**Date:** 2025-01-10  
**Phase:** 1 - Water Bills Completion  
**Task:** 1.3.2 - Complete Water Bills Aggregator for Nested Structure  
**Agent:** Agent_Water  
**Priority:** High  

## Task Overview
Complete the water bills aggregator updates to fully support nested reading structure for bills generation and additional service charges. Task 1.3.1 partially updated the aggregator for form loading - now complete the bills calculation logic with notes storage and UI hover functionality.

## Context from Task 1.3.1
✅ **Completed:** Frontend reading/loading logic updated  
✅ **Completed:** Aggregator returns nested `currentReading` objects  
❌ **Remaining:** Bills generation logic still expects flat reading values  
❌ **Remaining:** Car/boat wash billing calculations not implemented  
❌ **Remaining:** Bill notes storage and hover display not implemented  

## Problem Statement
The bills generation and calculation logic needs updates to:
1. Extract reading values from nested `currentReading` objects
2. Implement car wash and boat wash billing charges
3. Generate and store bill notes in billing documents
4. Add hover functionality to display notes in Bills and History tabs

## Current Data Structures

**Aggregated Data Output (Partially Updated):**
```javascript
{
  month: 0,
  units: {
    "101": {
      priorReading: 1749,
      currentReading: {reading: 1767, carWashCount: 1, boatWashCount: 0}, // Nested object
      // Bills calculation logic needs to extract reading: 1767
    }
  }
}
```

**Bills Document Should Store:**
```javascript
{
  "101": {
    priorReading: 1749,
    currentReading: 1767,
    consumption: 18,
    currentCharge: 25.50,
    carWashCharge: 2.00,
    boatWashCharge: 0.00,
    totalAmount: 27.50,
    billNotes: "Water Consumption for Aug 2025 - 0018 m³, 1 Car wash", // NEW FIELD
    // ... other billing fields
  }
}
```

## Required Actions

### 1. Update Bills Calculation Logic
- Locate the bills generation/calculation functions in waterDataService or related files
- Update consumption calculations to extract `currentReading.reading` from nested objects
- Ensure bills are calculated correctly: `(currentReading.reading || 0) - (priorReading || 0)`

### 2. Implement Additional Service Charges
- Add car wash billing: `carWashCount × rateCarWash` (from config, in centavos)
- Add boat wash billing: `boatWashCount × rateBoatWash` (from config, in centavos)  
- Include service charges in total bill amount
- Ensure rates are converted from centavos to pesos for billing

### 3. Generate and Store Bill Notes
Create the `generateWaterBillNotes()` function and store in billing documents:

```javascript
function generateWaterBillNotes(consumption, carWash, boatWash, period) {
  const consumptionFormatted = consumption.toString().padStart(4, '0');
  
  let notes = `Water Consumption for ${period} - ${consumptionFormatted} m³`;
  
  const washServices = [];
  if (carWash > 0) washServices.push(`${carWash} Car wash${carWash > 1 ? 'es' : ''}`);
  if (boatWash > 0) washServices.push(`${boatWash} Boat wash${boatWash > 1 ? 'es' : ''}`);
  
  if (washServices.length > 0) {
    notes += `, ${washServices.join(', ')}`;
  }
  
  return notes;
}

// Store in billing document
bills[unitId] = {
  // ... existing fields
  billNotes: generateWaterBillNotes(consumption, carWashCount, boatWashCount, period)
};
```

### 4. Add UI Hover Functionality
Update frontend components to show bill notes on hover:

**Bills Tab:**
- Add `title` attribute to Monthly Charge field: `title={bill.billNotes}`
- Shows detailed breakdown when hovering over charge amount

**History Tab:**
- Add `title` attribute to grid cells showing bill amounts
- Enables quick reference to service details from history view

### 5. Verify Complete Integration
- Ensure the Bills tab in WaterBillsViewV3 shows calculated amounts with hover details
- Test that History tab displays stored notes on hover
- Verify notes are available for receipt generation and client billing

## Success Criteria
1. **Bills Calculate:** Water consumption extracted correctly from nested `currentReading.reading`
2. **Service Charges:** Car wash and boat wash charges calculated and included in totals
3. **Notes Storage:** Bill notes generated and stored in billing documents
4. **Bills Tab Hover:** Monthly Charge field shows detailed breakdown on hover
5. **History Tab Hover:** Bill amount cells show service details on hover
6. **Receipt Ready:** Notes available for external billing and receipt generation
7. **No Regression:** Existing bill calculations continue to work for units without wash services

## Critical Notes
- **DO** store billNotes field in billing documents for persistence
- **DO** ensure notes are descriptive and client-friendly
- **DO** add hover functionality to both Bills and History tabs
- **DO NOT** work with archived components - use ACTIVE_MODULES.md
- **DO** test calculations with real config rates (rateCarWash, rateBoatWash in centavos)

## Key Files to Reference
- `ACTIVE_MODULES.md` - For correct component identification
- Backend water bills calculation/aggregation logic
- Config service for car/boat wash rates
- Bills display components (WaterBillsList.jsx)
- History display components (WaterHistoryGrid.jsx)

## Configuration Requirements
Ensure car/boat wash rates are available:
- `rateCarWash` (centavos per wash)
- `rateBoatWash` (centavos per wash)

---
**Dependencies:** This completes the nested structure support and enables full Water Bills functionality including additional service billing with detailed UI feedback.