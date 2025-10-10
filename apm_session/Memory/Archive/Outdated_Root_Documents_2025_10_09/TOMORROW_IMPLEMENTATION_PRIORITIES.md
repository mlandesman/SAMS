---
date: 2025-09-17
session_type: Implementation Planning
priority_order: Business Impact & System Consistency
---

# Tomorrow's Implementation Priorities

## 🎯 Completed Today - PWA Water Meter Success ✅
- **PWA Water Meter Data Entry**: Complete with Spanish interface and wash tracking
- **Backend Data Structure**: Fixed payload handling and Firebase document organization
- **Clean Architecture**: DRY data model eliminates legacy field pollution
- **Production Ready**: Field workers can digitally collect water meter readings
- **MTC PaymentMethods Import Fix**: Fixed collection name mismatch (paymentTypes → paymentMethods)

## 📋 Tomorrow's Priority Queue

### **🔥 CRITICAL PRIORITY 1: Desktop UI Wash Array Support**
**Task**: `/apm/Task_Assignment_Desktop_UI_Wash_Array_Support.md`
**Impact**: Desktop water bills UI must handle new `washes[]` data format
**Status**: Ready for Implementation Agent assignment
**Duration**: 4-6 hours

**Why Critical:**
- Desktop UI will break with new wash array data structure
- Need modal/hover interface for wash details with dates
- Helper functions required for backward compatibility
- Business users depend on desktop interface for water bills management

### **🟡 HIGH PRIORITY 2: Propane Tank PWA Entry (MTC)**
**Status**: Design phase - need tank identification details
**Impact**: Parallel data entry capability for MTC client
**Duration**: 4-6 hours after design completion

**Requirements Pending:**
- How many propane tanks does MTC have?
- Tank identification system (T01, T02, etc.?)
- Physical inspection route order for maintenance worker
- Safety protocol requirements for "Danger" status

**Design Framework Ready:**
- Spanish interface with % Available and Tank Status
- Simple data model (much simpler than water meters)
- Firebase structure: `/clients/MTC/projects/propaneTanks/readings/{year-month}`

### **🟡 HIGH PRIORITY 3: Domain-Specific Endpoint Standardization**
**Task**: `/apm/Task_Assignment_Domain_Specific_Endpoint_Standardization.md`
**Impact**: System-wide API consistency and reliability
**Status**: Ready for Implementation Agent assignment
**Duration**: 4-6 hours

**Scope:**
- Fix all `/comm` and `/water` endpoint patterns across frontend
- Eliminate legacy `/api/clients/{clientId}/projects/...` patterns
- Ensure consistent `${config.api.domainBaseUrl}` usage
- Update service files and component API calls

### **🟢 MEDIUM PRIORITY 4: Backend Water Readings Aggregator**
**Task**: `/apm/Task_Assignment_Backend_Water_Readings_Aggregator_Fix.md`
**Impact**: Backend consistency with new data structure
**Status**: May be partially complete from today's fixes
**Duration**: 2-4 hours

**Verify/Complete:**
- Backend aggregator handles new commonArea/buildingMeter object structure
- Helper functions for wash count calculations
- Template variable processing updates

## 🎯 Recommended Execution Strategy

### **Morning Session (First IA):**
**Priority 1: Desktop UI Wash Array Support**
- **Immediate business need**: Desktop users need working water bills interface
- **Clear requirements**: Modal/hover for wash details, helper functions for counts
- **Well-defined scope**: Update existing UI components to handle new data format

### **Afternoon Session (Second IA or same):**
**Priority 3: Domain-Specific Endpoint Standardization**
- **System reliability**: Consistent API patterns prevent future confusion
- **Clear examples**: Working `/water` patterns to replicate for `/comm`
- **Measurable success**: All endpoints use proper domain-specific routing

### **Parallel Design Work:**
**Priority 2: Propane Tank Design Completion**
- **Gather requirements**: Tank identification and inspection workflow
- **Create task assignment**: Ready for next Implementation Agent
- **Simple implementation**: Much easier than water meter complexity

## 📊 Success Metrics for Tomorrow

### **Critical Success:**
- ✅ Desktop water bills UI displays wash details correctly
- ✅ No breaking changes to existing desktop functionality
- ✅ Modal/hover interface shows individual wash dates

### **High Value Success:**
- ✅ All API endpoints use consistent domain-specific patterns  
- ✅ No legacy `/api/clients/.../projects/...` patterns remaining
- ✅ Propane tank requirements gathered and task created

### **System Health:**
- ✅ Backend aggregator fully compatible with new data structure
- ✅ Helper functions eliminate need for legacy wash count fields
- ✅ Template processing uses dynamic wash calculations

## 🔧 Implementation Notes

### **Desktop UI Task Specifics:**
- **Start with helper functions**: Ensure backward compatibility first
- **Modal implementation**: Clean, mobile-friendly wash details popup
- **CSS styling**: Professional appearance matching existing UI
- **Spanish labels**: "Auto", "Barco", date formatting

### **Endpoint Standardization Specifics:**
- **Search pattern**: Find all `/comm/` and legacy API pattern usage
- **Working examples**: Use successful `/water` endpoints as templates
- **Config usage**: Ensure proper `config.api.domainBaseUrl` imports
- **Test thoroughly**: Verify no 404/500 errors after changes

### **Propane Tank Design Questions:**
1. Tank count and identification system
2. Worker inspection route order  
3. Safety protocol requirements
4. Historical data comparison needs
5. Notes field requirements

---

**Tomorrow's Goal**: Complete desktop UI compatibility and achieve system-wide endpoint consistency. Propane tank design completion enables third parallel data entry capability.