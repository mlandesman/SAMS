---
agent_type: Implementation_Agent
task_id: Maintenance_Role_Mobile_App_Implementation
priority: HIGH
estimated_duration: 8-12 hours
mcp_tools_required: true
phase: Mobile App Enhancement - Maintenance Role Implementation
dependencies: Existing PWA mobile app infrastructure, Firebase role system
---

# Implementation Agent Task Assignment: Maintenance Role Mobile App Implementation

## 🎯 Task Objective
Implement a new "Maintenance" user role within the existing PWA mobile app with client-specific functionality. Extend the single mobile app to provide different interfaces and actions based on user access level, specifically adding maintenance worker capabilities for field operations.

## 📋 Critical Context
- **Single App Architecture**: Maintain one mobile app with role-based interface changes
- **Client-Specific Features**: MTC requires propane tank readings, AVII requires water meter readings
- **Existing Infrastructure**: PWA deployed at `mobile.sams.sandyland.com.mx` with role-based auth system
- **Current Roles**: SuperAdmin, Admin, Unit Owner, Unit Manager (need to add Maintenance)
- **Foundation Ready**: Authentication system, Firebase integration, mobile UI framework all operational

## 🚀 Required Implementation Tasks

### **Priority 1: Maintenance Role Definition & Access Control**
**Location:** Backend role system + Firebase security rules

**Requirements:**
- **Add "Maintenance" role** to existing access control matrix
- **Define specific permissions** for maintenance workers:
  - Read access to assigned client properties only
  - Write access to meter readings and maintenance tasks
  - No access to financial data or unit owner information
  - Limited to operational data relevant to field work

**Access Control Matrix Extension:**
```javascript
// New Maintenance role permissions
Maintenance: {
  clients: ['assigned'], // Only assigned client properties
  modules: {
    meterReadings: 'write',     // Can input readings
    maintenanceTasks: 'write',  // Can complete tasks
    issueReporting: 'write',    // Can report problems
    documents: 'read',          // Can view maintenance docs
    financial: 'none',          // No financial access
    unitOwners: 'none'          // No unit owner data access
  }
}
```

### **Priority 2: Client-Specific Functionality Framework**
**Location:** Mobile app routing + client configuration system

**Requirements:**
- **Extend client configuration** to define available maintenance features:
  - MTC: Propane tank readings, general maintenance tasks
  - AVII: Water meter readings, water system maintenance
  - Future clients: Configurable feature sets

**Client Configuration Structure:**
```javascript
// Firebase: /clients/{clientId}/config/maintenanceFeatures
{
  "MTC": {
    "features": ["propane_readings", "general_maintenance", "task_management"],
    "propane": {
      "tanks": [
        {"id": "tank_001", "location": "Pool Area", "capacity": "100lb"},
        {"id": "tank_002", "location": "Clubhouse", "capacity": "100lb"}
      ]
    }
  },
  "AVII": {
    "features": ["water_readings", "water_maintenance", "task_management"],
    "water": {
      "meters": [
        {"unitId": "101", "meterId": "WM-101", "location": "Unit 101 Patio"},
        {"unitId": "103", "meterId": "WM-103", "location": "Unit 103 Patio"}
        // ... all 12 units
      ]
    }
  }
}
```

### **Priority 3: Maintenance Dashboard Implementation**
**Location:** `frontend/mobile-app/src/components/MaintenanceDashboard.jsx` (new)

**Requirements:**
- **Role-based dashboard** that appears when maintenance user logs in
- **Client-specific feature display** based on assigned client
- **Today's tasks overview** and pending assignments
- **Quick action buttons** for common maintenance activities

**Dashboard Features by Client:**
```javascript
// MTC Maintenance Dashboard
- Propane Tank Readings (overdue alerts)
- General Maintenance Tasks
- Issue Reporting
- Photo Documentation

// AVII Maintenance Dashboard  
- Water Meter Readings (monthly schedule)
- Water System Tasks
- Issue Reporting
- Photo Documentation
```

### **Priority 4: Water Meter Readings Mobile Interface (AVII)**
**Location:** `frontend/mobile-app/src/components/WaterMeterReadings.jsx` (new)

**Requirements:**
- **Field-optimized mobile interface** for 12-unit water meter readings
- **Touch-friendly input forms** with large touch targets
- **Offline reading storage** with sync when connection available
- **Camera integration** for meter photos and issue documentation
- **Validation logic** to prevent impossible readings (backwards, too high increases)

**Technical Implementation:**
```javascript
// Water meter reading form features
- Unit-by-unit reading entry
- Previous reading display for validation
- Photo capture for each meter
- Notes field for maintenance issues
- Batch submission when complete
- Offline storage with IndexedDB
- Automatic sync when online
```

### **Priority 5: Propane Tank Readings Mobile Interface (MTC)**
**Location:** `frontend/mobile-app/src/components/PropaneTankReadings.jsx` (new)

**Requirements:**
- **Tank-specific reading interface** for MTC propane system
- **Level indicator input** (percentage or gauge reading)
- **Refill scheduling alerts** based on consumption patterns
- **Safety checks and inspection notes**
- **Photo documentation** for tank condition

**Technical Implementation:**
```javascript
// Propane tank reading features
- Tank-by-tank level readings
- Consumption calculation since last reading
- Refill threshold alerts
- Safety inspection checklist
- Photo capture for tank condition
- Maintenance notes and issues
- Scheduled reading reminders
```

### **Priority 6: Task Management System for Maintenance**
**Location:** `frontend/mobile-app/src/components/MaintenanceTasks.jsx` (new)

**Requirements:**
- **Assigned task list** for maintenance workers
- **Task completion workflow** with photo documentation
- **Issue escalation system** for problems requiring admin attention
- **Communication interface** to report completed work or problems

**Task Management Features:**
```javascript
// Task management functionality
- Today's assigned tasks
- Overdue task alerts
- Task completion with photos
- Issue reporting with severity levels
- Communication with office/admin
- Work order reference numbers
- Time tracking for tasks
```

## 🔧 Technical Requirements

### **Mobile App Routing Enhancement**
**Location:** `frontend/mobile-app/src/App.jsx` + route files

**Requirements:**
- **Extend existing role-based routing** to include Maintenance role
- **Client-specific route configuration** based on maintenance features
- **Fallback handling** for unavailable features per client

**Routing Structure:**
```javascript
// Role-based routing extension
const getRoutesForRole = (userRole, clientId, clientConfig) => {
  switch(userRole) {
    case 'Maintenance':
      return getMaintenanceRoutes(clientId, clientConfig.maintenanceFeatures);
    case 'Admin':
      return getAdminRoutes();
    case 'UnitOwner':
      return getOwnerRoutes();
    // existing roles...
  }
};

// Client-specific maintenance routes
const getMaintenanceRoutes = (clientId, features) => {
  const routes = ['/maintenance/dashboard', '/maintenance/tasks'];
  
  if (features.includes('water_readings')) {
    routes.push('/maintenance/water-readings');
  }
  if (features.includes('propane_readings')) {
    routes.push('/maintenance/propane-readings');
  }
  
  return routes;
};
```

### **Firebase Integration Enhancement**
**Location:** Backend Firebase functions + security rules

**Requirements:**
- **Extend user creation** to support Maintenance role assignment
- **Client-specific permissions** in Firestore security rules
- **Maintenance data collections** for readings and tasks

**Firestore Collections:**
```javascript
// New collections for maintenance functionality
/maintenanceUsers/{userId} - Maintenance user profiles with client assignments
/maintenanceTasks/{clientId}/tasks/{taskId} - Assigned tasks per client
/meterReadings/{clientId}/readings/{readingId} - Water/propane readings
/maintenanceReports/{clientId}/reports/{reportId} - Issue reports and photos
```

### **Offline Functionality Enhancement**
**Location:** Service worker + IndexedDB integration

**Requirements:**
- **Offline reading storage** for areas with poor connectivity
- **Photo storage and sync** when connection restored
- **Task completion offline** with automatic sync
- **Conflict resolution** for concurrent data changes

## ✅ Success Criteria

### **Role Implementation:**
- ✅ Maintenance role defined in access control system
- ✅ Client-specific permissions working correctly
- ✅ Role-based mobile app interface functioning
- ✅ Secure access to assigned client data only

### **Client-Specific Functionality:**
- ✅ MTC: Propane tank reading interface working
- ✅ AVII: Water meter reading interface working
- ✅ Client feature configuration system operational
- ✅ Future client extensibility prepared

### **Mobile App Experience:**
- ✅ Maintenance dashboard displays relevant client features
- ✅ Touch-optimized forms for field operations
- ✅ Camera integration for photo documentation
- ✅ Offline functionality for poor connectivity areas
- ✅ Task management and communication systems working

### **Technical Excellence:**
- ✅ Single app architecture maintained
- ✅ Role-based routing working correctly
- ✅ Firebase integration secure and efficient
- ✅ Offline sync functionality reliable
- ✅ Performance optimized for mobile devices

## 🔍 Testing Requirements

### **Role-Based Testing:**
1. **Test Maintenance user login** and proper dashboard display
2. **Verify client-specific features** show only for assigned clients
3. **Test role permissions** - no access to financial or owner data
4. **Validate cross-client isolation** - MTC user can't see AVII data

### **Client-Specific Feature Testing:**
1. **MTC Propane Testing**: Tank reading interface, level calculations, alerts
2. **AVII Water Testing**: 12-unit meter readings, validation, photo capture
3. **Task Management Testing**: Assignment, completion, reporting workflows
4. **Communication Testing**: Issue reporting and escalation systems

### **Mobile-Specific Testing:**
1. **Offline functionality** - readings stored and synced when online
2. **Camera integration** - photos captured and associated with readings
3. **Touch interface** - forms optimized for mobile finger interaction
4. **Performance testing** - app responsive on mobile devices

## 📂 File References

### **Existing Infrastructure to Extend:**
- `frontend/mobile-app/src/App.jsx` - Main app routing and role logic
- `frontend/mobile-app/src/components/Dashboard.jsx` - Role-based dashboard
- `backend/middleware/clientAuth.js` - Authentication and role verification
- Firebase collections - User profiles and permissions

### **New Components to Create:**
- `MaintenanceDashboard.jsx` - Main interface for maintenance users
- `WaterMeterReadings.jsx` - AVII water meter reading interface
- `PropaneTankReadings.jsx` - MTC propane tank reading interface
- `MaintenanceTasks.jsx` - Task management and communication
- `MaintenanceCamera.jsx` - Photo capture for documentation

### **Backend Extensions Needed:**
- Role definition updates in access control matrix
- Client configuration API for maintenance features
- Maintenance task assignment and tracking API
- Photo storage and management API

## 🎯 Business Value

### **Operational Efficiency:**
- **Field Data Collection**: Direct mobile input eliminates manual data transfer
- **Real-Time Updates**: Immediate data availability for billing and maintenance
- **Reduced Errors**: Touch-optimized forms with validation reduce input mistakes
- **Photo Documentation**: Visual evidence for maintenance issues and completed work

### **Client-Specific Benefits:**
- **MTC**: Automated propane level monitoring and refill scheduling
- **AVII**: Streamlined water meter reading process for monthly billing
- **Both Clients**: Professional maintenance task management and communication

### **Scalability:**
- **Future Clients**: Configurable feature system allows easy addition of new clients
- **New Features**: Framework ready for additional maintenance capabilities
- **Role Extensions**: Architecture supports additional specialized roles

## 📞 Manager Agent Coordination

**Status Updates Required:**
- Report progress on role implementation and access control
- Provide screenshots of maintenance dashboard for each client
- Confirm client-specific feature configuration working
- Document any challenges with single-app architecture

**Completion Verification:**
- Demonstrate maintenance user login with appropriate dashboard
- Show client-specific features (MTC propane vs AVII water readings)
- Verify offline functionality and photo integration
- Confirm task management and communication systems operational

**Architecture Validation:**
- Single mobile app maintained with role-based functionality
- Client-specific feature system extensible for future needs
- Security model properly isolates maintenance users from financial data
- Performance acceptable for field operations on mobile devices

---

**Implementation Agent Instructions:** Extend the existing mobile app infrastructure to support the new Maintenance role while maintaining the single-app architecture. Focus on client-specific feature configuration and field-optimized mobile interfaces for maintenance operations.