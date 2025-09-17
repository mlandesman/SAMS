# Water Readings Data Writing Analysis

## Current Data Writing Endpoints

### Primary Service: `waterReadingsService.js`
**Function**: `saveReadings(clientId, year, month, readings)`
**Firestore Path**: `clients/{clientId}/projects/waterBills/readings/{year-month}`
**Current Behavior**: 
```javascript
// Line 31: Store readings exactly as received from frontend
readings, // Contains nested objects: {"101": {reading: 1780, carWashCount: 2, boatWashCount: 1}}
```

### Alternative Service: `projectsService.js` 
**Function**: `updateReadings(clientId, projectType, year, monthIndex, readings)`
**Firestore Path**: `clients/{clientId}/projects/{projectType}/{year}/data`
**Structure**: Different format - stores in annual documents with monthly arrays

## CRITICAL ISSUE IDENTIFIED

### The Problem
The **waterReadingsService** (line 31) has this comment:
```javascript
readings, // Now contains nested objects: {"101": {reading: 1780, carWashCount: 2, boatWashCount: 1}}
```

**This is exactly the legacy format we're trying to eliminate!**

### Current Data Flow
1. **PWA/UI** → Sends readings with `carWashCount`/`boatWashCount` 
2. **waterReadingsService** → Saves data "exactly as received" (including legacy fields)
3. **Aggregator** → Processes this mixed data, causing legacy fields to appear

### Required Changes

#### 1. Update waterReadingsService.saveReadings()
**File**: `/backend/services/waterReadingsService.js`
**Lines**: 27-33

**Current Code**:
```javascript
const data = {
  year,
  month,
  readings, // Stores whatever frontend sends (including legacy fields)
  timestamp: admin.firestore.FieldValue.serverTimestamp()
};
```

**Needs to become**:
```javascript
const data = {
  year,
  month,
  readings: this.transformToCleanFormat(readings), // Transform to clean structure
  timestamp: admin.firestore.FieldValue.serverTimestamp()
};

// Add commonArea and buildingMeter if provided
if (readings.commonArea !== undefined) {
  data.commonArea = readings.commonArea;
}
if (readings.buildingMeter !== undefined) {
  data.buildingMeter = readings.buildingMeter;
}
```

#### 2. Add Data Transformation Function
**New Function Needed**:
```javascript
transformToCleanFormat(inputReadings) {
  const cleanReadings = {};
  
  for (const [unitId, unitData] of Object.entries(inputReadings)) {
    // Skip special meters - they go to root level
    if (unitId === 'commonArea' || unitId === 'buildingMeter') {
      continue;
    }
    
    if (typeof unitData === 'number') {
      // Legacy flat number format
      cleanReadings[unitId] = unitData;
    } else if (typeof unitData === 'object') {
      // Build clean structure
      const cleanUnit = { reading: unitData.reading };
      
      // Convert legacy wash counts to washes array
      const washes = [];
      if (unitData.carWashCount > 0) {
        for (let i = 0; i < unitData.carWashCount; i++) {
          washes.push({ type: 'car', date: new Date().toISOString().split('T')[0] });
        }
      }
      if (unitData.boatWashCount > 0) {
        for (let i = 0; i < unitData.boatWashCount; i++) {
          washes.push({ type: 'boat', date: new Date().toISOString().split('T')[0] });
        }
      }
      
      // Include washes array only if there are washes
      if (washes.length > 0) {
        cleanUnit.washes = washes;
      }
      
      cleanReadings[unitId] = cleanUnit;
    }
  }
  
  return cleanReadings;
}
```

#### 3. Frontend/PWA Updates Required
The PWA needs to either:
- **Option A**: Send clean format directly (`{reading: number, washes: array}`)
- **Option B**: Continue sending legacy format, let backend transform it

### Data Structure Comparison

#### Current (Problematic):
```javascript
// What PWA sends & backend stores
{
  "101": { reading: 1767, carWashCount: 1, boatWashCount: 0 },
  "103": { reading: 842, carWashCount: 3, boatWashCount: 0 }
}
```

#### Target (Clean):
```javascript
// What should be stored in Firebase
{
  "101": { reading: 1767 },
  "103": { 
    reading: 842,
    washes: [
      { type: 'car', date: '2025-09-05' },
      { type: 'car', date: '2025-09-10' },
      { type: 'car', date: '2025-09-16' }
    ]
  }
}
```

## Endpoints Analysis

### Active Write Endpoints:
1. **`POST /water/clients/:clientId/readings/:year/:month`** 
   - **Controller**: `waterReadingsController.saveReadings`
   - **Service**: `waterReadingsService.saveReadings` ⚠️ **NEEDS UPDATE**

2. **`POST /api/clients/:clientId/projects/waterBills/:year/:month/readings`**
   - **Controller**: `projectsDataController.submitWaterReadings`
   - **Service**: `projectsService.updateReadings` ⚠️ **MAY NEED UPDATE**

### Testing Required:
- Identify which endpoint the PWA actually uses
- Test data transformation with both legacy and new format inputs
- Ensure aggregator works with transformed data

## Root Cause of Legacy Fields in Output

The August data shows:
```javascript
"priorReading": {
  "reading": 1767,
  "carWashCount": 1,  // ← This shouldn't be here
  "boatWashCount": 0  // ← This shouldn't be here
}
```

**This happens because:**
1. PWA sends legacy format to backend
2. Backend saves it "exactly as received" 
3. Aggregator uses prior month's data as-is
4. Legacy fields from July appear in August's priorReading

## Next Steps Priority:
1. **High**: Update `waterReadingsService.saveReadings()` with data transformation
2. **High**: Test with both legacy and new format inputs  
3. **Medium**: Coordinate with PWA team on data format
4. **Medium**: Update `projectsService` if needed
5. **Low**: Add validation to reject malformed data

## Testing Strategy:
1. Create test data with legacy format
2. Pass through updated saveReadings function
3. Verify clean format stored in Firebase
4. Test aggregator with clean data
5. Confirm no legacy fields in API output