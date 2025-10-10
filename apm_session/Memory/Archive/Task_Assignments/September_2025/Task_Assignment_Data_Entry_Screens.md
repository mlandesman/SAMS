---
agent_type: Implementation_Agent
task_id: Data_Entry_Screens_Implementation
priority: HIGH
estimated_duration: 6-8 hours
mcp_tools_required: true
phase: PWA Mobile App - Field Data Entry MVP
dependencies: Firebase MCP tools, mobile app framework
---

# Implementation Agent Task Assignment: Data Entry Screens Implementation

## 🎯 Task Objective
Create maintenance worker MVP with Spanish "Tareas" interface for data entry screens (localhost:5174 testing). Build functional propane tank readings (MTC) and water meter readings (AVII) with direct Firebase MCP integration that bypasses complex dashboard systems.

## 📋 Critical Context - Maintenance Worker MVP
- **Single Client Assignment**: Workers assigned to one client (MTC or AVII), bypass client selector
- **Spanish Interface**: "Tareas" action button system for Spanish-speaking maintenance workers
- **Localhost:5174 Testing**: Independent of backend dependencies, direct Firebase MCP writing
- **No Activities Config Found**: Must create new client-specific maintenance activities structure
- **Simplified Workflow**: Focus on data entry only, skip task assignment and dashboard integration

## 🚀 Required Implementation Tasks

### **Priority 0: Spanish Tareas Menu System**
**Location:** `frontend/mobile-app/src/components/TareasMenu.jsx` (new)

**Requirements:**
- **Spanish "Tareas" main interface** for maintenance workers
- **Client-specific activity routing** - MTC shows propane options, AVII shows water meter options
- **Single client assignment workflow** - bypass client selector entirely
- **Simple action buttons** leading to data entry screens

**Tareas Menu Structure:**
```javascript
// MTC Client Tareas (Propane)
const mtcTareas = [
  {
    id: "propane_reading",
    label: "Lectura de Tanques de Gas",
    icon: "🔥",
    description: "Registrar niveles de gas propano",
    component: "PropaneReadingEntry"
  }
];

// AVII Client Tareas (Water Meters)
const aviiTareas = [
  {
    id: "water_reading", 
    label: "Lectura de Medidores de Agua",
    icon: "💧",
    description: "Registrar lecturas mensuales",
    component: "WaterMeterEntry"
  }
];
```

### **Priority 1: Propane Tank Reading Screen (MTC)**
**Location:** `frontend/mobile-app/src/components/PropaneReadingEntry.jsx` (new)

**Requirements:**
- **Mobile-optimized form** for MTC propane tank level readings
- **Tank selection interface** - Multiple tanks per property
- **Level input methods** - Percentage, gauge reading, or visual estimation
- **Photo capture capability** - Tank condition documentation
- **Offline storage** - Save readings when no internet connection
- **Direct Firebase write** - Submit readings to Firestore

**Tank Data Structure:**
```javascript
// MTC Propane Tank Configuration
const mtcPropaneTanks = [
  {
    tankId: "MTC-PROP-001",
    location: "Pool Area",
    capacity: "100lb",
    installDate: "2024-01-15",
    lastReading: "2025-01-10",
    lastLevel: 65
  },
  {
    tankId: "MTC-PROP-002", 
    location: "Clubhouse Kitchen",
    capacity: "100lb",
    installDate: "2024-01-15",
    lastReading: "2025-01-10",
    lastLevel: 40
  }
];
```

**Form Features:**
- Tank selection dropdown with location and last reading
- Level input with validation (0-100%)
- Photo capture for tank condition
- Notes field for maintenance issues
- Consumption calculation since last reading
- Refill threshold alerts

### **Priority 2: Water Meter Reading Screen (AVII)**
**Location:** `frontend/mobile-app/src/components/WaterMeterEntry.jsx` (new)

**Requirements:**
- **12-unit water meter grid** - All AVII units in one screen
- **Touch-optimized number input** - Large buttons for meter readings
- **Previous reading display** - Show last reading for validation
- **Photo capture per meter** - Document meter condition and reading
- **Batch validation** - Check for impossible readings before submit
- **Direct Firebase write** - Submit all readings to Firestore

**Water Meter Data Structure:**
```javascript
// AVII Water Meter Configuration (12 units)
const aviiWaterMeters = [
  {
    unitId: "101",
    meterId: "WM-101",
    location: "Unit 101 Patio",
    lastReading: 1767,
    lastReadingDate: "2025-01-01",
    currentReading: null
  },
  {
    unitId: "103", 
    meterId: "WM-103",
    location: "Unit 103 Patio", 
    lastReading: 1543,
    lastReadingDate: "2025-01-01",
    currentReading: null
  }
  // ... all 12 units
];
```

**Form Features:**
- 12-unit grid layout optimized for mobile
- Current reading input with previous reading reference
- Photo capture button for each meter
- Validation for backwards readings or excessive usage
- Consumption calculation display
- Batch submit for all 12 readings

### **Priority 3: Firebase Integration with MCP Tools**
**Location:** Data submission and storage logic

**Requirements:**
- **Use Firebase MCP tools** for direct Firestore writes
- **Create proper document structure** for readings data
- **Implement data validation** before Firebase submission
- **Handle offline scenarios** - Store locally, sync when online
- **Error handling and retry logic** for failed submissions

**Firestore Collections Structure:**
```javascript
// Propane Tank Readings Collection
/propaneReadings/{clientId}/{readingId}
{
  tankId: "MTC-PROP-001",
  clientId: "MTC",
  readingDate: "2025-01-15T10:30:00Z",
  levelPercentage: 75,
  consumption: 10, // calculated from last reading
  photos: ["gs://bucket/propane/MTC-PROP-001-20250115.jpg"],
  notes: "Tank condition good, no leaks observed",
  readBy: "maintenance_worker_123",
  location: "Pool Area",
  submitted: true,
  timestamp: "2025-01-15T10:30:00Z"
}

// Water Meter Readings Collection  
/waterMeterReadings/{clientId}/{readingBatchId}
{
  clientId: "AVII",
  readingDate: "2025-01-15T14:00:00Z",
  readBy: "maintenance_worker_456",
  submitted: true,
  readings: [
    {
      unitId: "101",
      meterId: "WM-101",
      currentReading: 1785,
      previousReading: 1767,
      consumption: 18,
      photo: "gs://bucket/water/WM-101-20250115.jpg",
      notes: ""
    },
    {
      unitId: "103",
      meterId: "WM-103", 
      currentReading: 1561,
      previousReading: 1543,
      consumption: 18,
      photo: "gs://bucket/water/WM-103-20250115.jpg",
      notes: "Meter slightly dirty, cleaned before reading"
    }
    // ... all 12 units
  ],
  totalConsumption: 216,
  averageConsumption: 18,
  timestamp: "2025-01-15T14:00:00Z"
}
```

### **Priority 4: Mobile UI Components**
**Location:** Mobile-optimized form components

**Requirements:**
- **Touch-friendly input fields** - Large buttons, proper spacing
- **Camera integration** - Photo capture and preview
- **Loading states** - Clear feedback during submission
- **Error handling** - User-friendly error messages
- **Offline indicators** - Show when data stored locally vs submitted

**UI Component Features:**
```javascript
// Touch-optimized number input
<TouchNumberInput 
  value={reading}
  onChange={setReading}
  min={0}
  max={9999}
  placeholder="Enter meter reading"
  previousValue={lastReading}
/>

// Photo capture component
<PhotoCapture
  onCapture={handlePhotoCapture}
  maxPhotos={1}
  compressionQuality={0.8}
  previewSize="thumbnail"
/>

// Validation component
<ReadingValidation
  currentReading={reading}
  previousReading={lastReading}
  threshold={500} // warn if consumption > 500% increase
  onValidationChange={setIsValid}
/>
```

## 🔧 Technical Implementation Requirements

### **Firebase MCP Integration**
**Required MCP Commands:**
```javascript
// Write propane tank reading
await firebase_create_document({
  collection: `propaneReadings/MTC`,
  document: readingData
});

// Write water meter readings batch
await firebase_create_document({
  collection: `waterMeterReadings/AVII`,
  document: batchReadingData
});

// Upload photos to Firebase Storage
await firebase_upload_file({
  bucket: "sams-readings",
  path: `propane/MTC-PROP-001-${timestamp}.jpg`,
  file: photoBlob
});
```

### **Offline Storage Implementation**
**Location:** Local storage and sync logic

**Requirements:**
- **IndexedDB integration** - Store readings offline
- **Background sync** - Auto-submit when connection restored
- **Conflict resolution** - Handle duplicate readings
- **Storage cleanup** - Remove successfully submitted readings

### **Mobile-Specific Features**
**Location:** PWA capabilities and mobile optimization

**Requirements:**
- **Camera API integration** - Access device camera for photos
- **Geolocation capture** - Record reading location for validation
- **Touch gestures** - Swipe between units, pinch to zoom photos
- **Vibration feedback** - Confirm successful readings submission

## ✅ Success Criteria

### **Functional Requirements:**
- ✅ Propane tank reading form captures level, photos, notes
- ✅ Water meter reading grid handles all 12 AVII units
- ✅ Camera integration captures and compresses photos
- ✅ Firebase MCP writes data to correct Firestore collections
- ✅ Offline storage saves readings when no internet connection

### **Technical Requirements:**
- ✅ Touch-optimized UI works on mobile devices
- ✅ Data validation prevents impossible readings
- ✅ Photo compression keeps file sizes reasonable
- ✅ Error handling provides clear user feedback
- ✅ Background sync submits offline readings when online

### **Data Integrity:**
- ✅ Readings stored with proper timestamps and user attribution
- ✅ Photo association with correct tanks/meters
- ✅ Consumption calculations accurate
- ✅ No duplicate readings in Firebase
- ✅ All required fields validated before submission

## 🔍 Testing Requirements

### **Data Entry Testing:**
1. **Propane Tank Testing:**
   - Test all tank selection and level input scenarios
   - Verify photo capture and notes functionality
   - Test consumption calculations
   - Validate refill threshold alerts

2. **Water Meter Testing:**
   - Test all 12-unit reading entry
   - Verify previous reading display and validation
   - Test batch submission of all readings
   - Validate consumption calculations per unit

### **Firebase Integration Testing:**
1. **Data Writing:**
   - Test Firebase MCP document creation
   - Verify data structure matches design
   - Test photo upload to Firebase Storage
   - Validate error handling for failed writes

2. **Offline Functionality:**
   - Test offline reading storage
   - Verify background sync when connection restored
   - Test conflict resolution for duplicate readings
   - Validate storage cleanup after successful submission

### **Mobile UI Testing:**
1. **Touch Interface:**
   - Test number input on various mobile devices
   - Verify photo capture functionality
   - Test form validation and error display
   - Validate loading states and feedback

## 📂 File References

### **New Components to Create:**
- `PropaneReadingEntry.jsx` - MTC propane tank reading form
- `WaterMeterEntry.jsx` - AVII water meter reading grid
- `TouchNumberInput.jsx` - Mobile-optimized number input
- `PhotoCapture.jsx` - Camera integration component
- `ReadingValidation.jsx` - Data validation component
- `OfflineStorage.js` - Local storage and sync utilities

### **Firebase MCP Integration:**
- Firestore document creation for readings
- Firebase Storage for photo uploads
- Error handling and retry logic
- Offline sync capabilities

### **Configuration Files:**
- Tank and meter configuration data
- Validation rules and thresholds
- Photo compression settings
- Offline storage configuration

## 🎯 Business Value

### **Immediate Operational Benefits:**
- **Digital Data Collection** - Eliminates paper-based reading logs
- **Photo Documentation** - Visual evidence for maintenance issues
- **Real-Time Data** - Immediate availability for billing and monitoring
- **Error Reduction** - Digital validation prevents common mistakes

### **Client-Specific Value:**
- **MTC** - Automated propane level monitoring and refill scheduling
- **AVII** - Streamlined monthly water meter reading process
- **Both Clients** - Professional maintenance documentation and tracking

### **Foundation for Production:**
- **Maintenance Worker Capability** - Essential functionality for field operations
- **Data Integration Ready** - Structured data for billing and reporting systems
- **Scalable Architecture** - Framework for additional reading types and clients

## 📞 Manager Agent Coordination

**Status Updates Required:**
- Report progress on propane and water meter form development
- Provide screenshots of mobile UI on actual devices
- Confirm Firebase MCP integration working with test data
- Document any challenges with camera or offline functionality

**Completion Verification:**
- Demonstrate propane tank reading submission to Firebase
- Show 12-unit water meter reading batch submission
- Verify offline storage and sync functionality
- Confirm photo capture and Firebase Storage integration

**Technical Validation:**
- Firebase collections contain properly structured reading data
- Photos successfully uploaded to Firebase Storage with correct associations
- Offline functionality works reliably in poor connectivity scenarios
- Mobile UI responsive and touch-friendly on target devices

---

**Implementation Agent Instructions:** Focus on creating functional data entry screens that work independently of other PWA systems. Use Firebase MCP tools for direct Firestore integration. Prioritize mobile-optimized UI and reliable data submission over complex workflows.