# ISSUE: Multi-Unit Context Switching for Mobile

**Date**: June 26, 2025  
**Identified By**: Project Owner / APM Manager  
**Priority**: 🔴 **HIGH** - Affects all mobile unit-specific features  
**Category**: Architecture Gap  

---

## 🔍 **ISSUE DESCRIPTION**

We have discovered a significant logic gap in our mobile architecture. When a user has multiple roles within the same client (e.g., owner of one unit AND manager of another unit), we lack a mechanism to switch context between these different units.

### **Example Scenario**
- User email: michael@example.com
- Client: MTC
- Roles:
  - Owner of Unit PH4D
  - Manager of Unit 1C
- Problem: How does the user view Unit Report for PH4D vs 1C?

---

## 🎯 **IMPACT**

### **Affected Features**
1. **Unit Report** (currently being built)
2. **Unit-specific transactions**
3. **Unit-specific documents**
4. **Future unit-specific features**

### **User Experience Impact**
- Users with multiple units cannot easily switch between them
- Confusion about which unit's data is being displayed
- Potential for viewing wrong unit's information

---

## 💡 **PROPOSED SOLUTIONS**

### **Option 1: Unit Selector in Mobile Header**
```
┌─────────────────────────┐
│ SAMS    [Unit: PH4D ▼] │  ← Dropdown selector
├─────────────────────────┤
│                         │
│    Unit PH4D Report     │
│    ...                  │
└─────────────────────────┘
```

### **Option 2: Unit Selection Screen**
- After login, if user has multiple units
- Show unit selection screen
- Store selected unit in session/context
- Add "Switch Unit" option in menu

### **Option 3: Combined View with Tabs**
```
┌─────────────────────────┐
│    Your Units           │
├─────────────────────────┤
│ [PH4D] | [1C (Mgr)]    │  ← Tabs
├─────────────────────────┤
│    Unit PH4D Report     │
│    ...                  │
└─────────────────────────┘
```

---

## 🔧 **TECHNICAL REQUIREMENTS**

### **Context Management**
1. Create `UnitContext` provider
2. Store currently selected unit
3. Persist selection across sessions
4. Update all unit-specific queries to use context

### **API Modifications**
```javascript
// Add to user data
GET /api/user/units
Response: {
  units: [
    { unitId: "PH4D", unitNumber: "PH4D", role: "owner" },
    { unitId: "1C", unitNumber: "1C", role: "manager" }
  ]
}
```

### **UI Components Needed**
1. Unit selector component
2. Unit switching interface
3. Current unit indicator
4. Role badge (Owner/Manager)

---

## 📋 **IMMEDIATE WORKAROUND**

For the Unit Report being built today:

### **Mobile Approach**
1. If user has only one unit → Show that unit's report
2. If user has multiple units → Show unit selector first
3. Default to first unit in their list
4. Add temporary unit switching in report header

### **Desktop Approach** (Per Owner Decision)
- **EXCLUDE Unit Report from Desktop UI**
- Unit reports will be:
  - Emailed with digital receipts
  - Included in monthly reports
- This avoids the context switching issue on desktop

---

## 🚨 **IMPLEMENTATION PRIORITY**

### **Phase 1: Immediate (Today)**
- Implement basic unit selection for mobile Unit Report
- Document the limitation clearly
- Ensure single-unit users have seamless experience

### **Phase 2: Short-term (This Week)**
- Design comprehensive unit context system
- Implement UnitContext provider
- Add unit selector to mobile header

### **Phase 3: Long-term (Post-Launch)**
- Refine UI/UX based on user feedback
- Consider desktop implementation if needed
- Extend to all unit-specific features

---

## ✅ **ACCEPTANCE CRITERIA**

1. Users with multiple units can:
   - [ ] See all their units listed
   - [ ] Select which unit to view
   - [ ] Switch between units easily
   - [ ] See their role for each unit

2. System correctly:
   - [ ] Filters data by selected unit
   - [ ] Maintains selection across pages
   - [ ] Shows role-appropriate information
   - [ ] Prevents cross-unit data leakage

---

## 📝 **NOTES**

- This is an architectural gap discovered during Unit Report implementation
- Affects all mobile features that are unit-specific
- Desktop UI will avoid this by not showing unit-specific views
- Must be addressed for good mobile UX
- Consider this pattern for future multi-context scenarios

**Decision Made**: Desktop UI will NOT include unit-specific reports to avoid this complexity. Mobile MUST handle it for core functionality.
### Resolution - 2025-07-05 13:36
**Status**: ✅ RESOLVED
**Resolution**: Configuration file was added back in and tested.
**Resolved by**: Product Manager

