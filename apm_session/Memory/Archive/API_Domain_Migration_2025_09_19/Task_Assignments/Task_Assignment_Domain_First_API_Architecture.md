# Task Assignment: Domain-First API Architecture Migration

## Mission
Transform SAMS from client-centric `/api/clients/{id}/*` routing to clean domain-first architecture with `/water/*`, `/transactions/*`, `/properties/*` patterns and centralized `/auth` middleware.

## Strategic Context
**Current Problem:** 22+ nested client endpoints create confusion, maintenance issues, and break domain separation of concerns.

**Solution:** Domain-first architecture with clean authentication flow:
- Domain routes own their logic (`/water`, `/transactions`, `/properties`)  
- `/auth` middleware handles authorization (client access + action permissions)
- Simple client selection caching (no complex nested authorization)

## Phase 1: Deep Analysis & Architecture Design (REQUIRED FIRST)

### 1.1 Current State Analysis
**Analyze existing `/api/clients/*` structure:**

**REQUIRED DELIVERABLES:**
1. **Complete endpoint inventory** with file locations and line numbers
2. **Data flow mapping** - what data each endpoint retrieves/modifies
3. **Authentication pattern analysis** - how current routes verify permissions
4. **Frontend service mapping** - which components call which endpoints

**Analysis Files to Create:**
- `CURRENT_CLIENT_ROUTES_INVENTORY.md` - Complete endpoint mapping
- `DATA_FLOW_ANALYSIS.md` - What data flows through each route
- `AUTHENTICATION_PATTERNS_ANALYSIS.md` - Current auth verification methods

### 1.2 Domain Architecture Design
**Design new domain-first patterns:**

**REQUIRED DELIVERABLES:**
1. **Domain boundary definitions** - which functionality belongs to each domain
2. **Route pattern specifications** - exact new endpoint structures  
3. **Authentication middleware design** - how `/auth` checks work
4. **Data access patterns** - how domains access their data

**Design Files to Create:**
- `DOMAIN_ARCHITECTURE_SPECIFICATION.md` - Complete new structure
- `AUTHENTICATION_MIDDLEWARE_DESIGN.md` - Auth flow specification
- `MIGRATION_IMPACT_ANALYSIS.md` - What changes where

### 1.3 Migration Strategy Planning
**Plan systematic migration approach:**

**REQUIRED DELIVERABLES:**
1. **Phase-by-phase migration plan** - order of domain migrations
2. **Backward compatibility strategy** - how to avoid breaking existing functionality
3. **Testing strategy** - how to verify each migration phase
4. **Rollback procedures** - how to revert if issues occur

**Strategy Files to Create:**
- `DOMAIN_MIGRATION_PLAN.md` - Detailed phase-by-phase approach
- `TESTING_VERIFICATION_STRATEGY.md` - How to test each domain migration

## Phase 2: Implementation (ONLY AFTER PHASE 1 APPROVAL)

### 2.1 Authentication Middleware Implementation
**Create centralized `/auth` verification system**

### 2.2 Domain Route Implementation  
**Implement domain-specific routes in priority order:**
1. `/water/*` - Water billing domain
2. `/transactions/*` - Financial transactions domain  
3. `/properties/*` - Property/unit management domain
4. `/admin/*` - Administrative functions domain

### 2.3 Frontend Service Migration
**Update frontend services to use new domain routes**

### 2.4 Legacy Route Cleanup
**Remove old `/api/clients/*` patterns after migration complete**

## Critical Success Criteria

**Phase 1 Requirements:**
- [ ] Complete analysis with file paths and line numbers
- [ ] Clear domain boundary definitions
- [ ] Detailed authentication flow design
- [ ] Migration strategy with rollback plans
- [ ] **User approval before any code changes**

**Phase 2 Requirements:**
- [ ] Working authentication middleware
- [ ] Each domain migration tested independently  
- [ ] No breaking changes to existing functionality
- [ ] Clean removal of legacy patterns

## Analysis Focus Areas

### Current `/api/clients/*` Patterns to Map:
```
/api/clients/{id}/transactions
/api/clients/{id}/units  
/api/clients/{id}/water
/api/clients/{id}/account
/api/clients/{id}/permissions
/api/clients/{id}/documents
/api/clients/{id}/vendors
/api/clients/{id}/financial
...and 15+ more patterns
```

### Target Domain Patterns:
```
/water/{unitId}/bills
/transactions/{unitId}/history
/properties/{unitId}/details  
/auth/verify/{unitId} 
/auth/permissions/{userId}
```

## Implementation Guidelines

1. **NO CODING until Phase 1 analysis is complete and approved**
2. **Document every decision** with clear rationale
3. **Maintain working functionality** throughout migration
4. **Test each domain migration** before proceeding to next
5. **Create rollback procedures** for each migration phase

## Expected Timeline
- **Phase 1 Analysis:** 2-3 sessions comprehensive analysis
- **Phase 2 Implementation:** 4-6 sessions systematic migration  
- **Total Effort:** 6-9 Implementation Agent sessions

## Next Steps
1. Begin comprehensive analysis of current `/api/clients/*` structure
2. Document findings with specific file paths and line numbers
3. Present analysis for review and approval
4. **DO NOT proceed to implementation without explicit approval**

---

*This task represents a major architectural transformation that will eliminate Implementation Agent confusion and create clean domain separation. The analysis phase is critical for success.*