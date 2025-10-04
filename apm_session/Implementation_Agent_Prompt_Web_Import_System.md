# Implementation Agent Task Assignment - Web-Based Import/Purge System

**Manager Agent:** Manager_6  
**Task Assignment:** Build Web-Based Import/Purge System  
**Priority:** HIGH - Production Infrastructure  
**Branch:** `web-based-import-system`  
**Task File:** `/apm_session/Task_Assignment_Web_Based_Import_System.md`  

---

## Your Mission

You are being tasked to build a web-based import/purge system that will allow superadmin users to selectively refresh data through the UI. This eliminates the need for command-line scripts and mock objects, providing a permanent solution for data management.

## Context

The project has been struggling with import scripts that use mock objects which can't serialize to Firebase. The solution is to build a proper web-based UI that uses real API calls, eliminating all the architectural issues with the previous approach.

**Key Requirements:**
- Web UI accessible from Settings page (superadmin only)
- Checkbox selection for each data component (purge/import)
- Real-time progress tracking
- Full audit trail and error handling
- No mock objects - use real API endpoints

## Task Details

**Read the complete task assignment at:** `/apm_session/Task_Assignment_Web_Based_Import_System.md`

This document contains:
- 4 implementation phases with detailed code examples
- Backend controller and service architecture
- Frontend React component design
- Integration and testing requirements
- Production readiness checklist

## Critical Guidelines

Before starting, you MUST read:
1. `/apm/prompts/Implementation_Agent/CRITICAL_CODING_GUIDELINES.md` - MANDATORY coding standards
2. Review the task assignment file for complete implementation details

**Key Rules:**
- NO MCP commands in production code
- NO hardcoded dates - use DateService.getNow()
- NO hardcoded client data
- Use approved API endpoints only
- Test with Chrome DevTools MCP

## Implementation Phases

### Phase 1: Backend Infrastructure (1 session)
- Create importController.js with purge/import operations
- Add routes to admin.js (superadmin only)
- Create importService.js using real controllers
- Implement progress tracking

### Phase 2: Frontend UI Components (1.5 sessions)
- Create ImportManagement.jsx component
- Add checkbox UI for selective operations
- Implement real-time progress display
- Add to Settings page for superadmin users

### Phase 3: Integration and Testing (1 session)
- Connect frontend to backend APIs
- Test complete purge/import workflows
- Verify progress tracking
- Add error handling

### Phase 4: Production Readiness (0.5 sessions)
- Add safety features (backups, validation)
- Create operation logs
- Performance optimization
- Documentation

## Memory Log Requirements

Create your progress log at:
`/apm_session/Memory/Phase_Import_Tools_Modernization/Implementation_Log_Web_Import_System_[timestamp].md`

Include:
- Implementation progress for each phase
- Code snippets created/modified
- Test results with screenshots
- Any blockers or issues encountered
- Completion status

## Definition of Done

✅ Web UI with checkbox selection working  
✅ All backend endpoints implemented and tested  
✅ Real-time progress tracking functional  
✅ Full error handling and validation  
✅ Tested with actual client data (MTC)  
✅ No mock objects used anywhere  
✅ All operations properly audited  
✅ Chrome DevTools testing completed  

## Getting Started

1. Create branch: `web-based-import-system`
2. Read the task assignment file completely
3. Start with Phase 1 (Backend Infrastructure)
4. Test each phase before moving to the next
5. Use MTC client for testing (more stable than AVII)

Remember: This is a critical infrastructure component that will be used for all future data refreshes. Take time to build it properly with full error handling and user feedback.

**Questions before starting?** Please ask for clarification on any requirements.