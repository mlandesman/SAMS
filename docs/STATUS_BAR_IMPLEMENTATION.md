# Status Bar Universal Refactor - Technical Documentation

*Updated: June 13, 2025*

## Overview

This document details the refactoring of the StatusBar system to work universally across different modules and layouts.

## Goals Achieved

### 1. StatusBar Integration  
- **Problem**: Each module needed its own status display mechanism
- **Solution**: Created generic StatusBarContext for scalable status sharing
- **Result**: Any module can publish status info without scope pollution

## Technical Architecture

### Component Hierarchy
```
App (StatusBarProvider)
├── MainLayout
│   ├── Sidebar
│   ├── Content Area
│   │   └── ActivityView
│   │       └── ListManagementProvider
│   │           └── ListManagementView
│   │               ├── ActionBar
│   │               ├── Tabs
│   │               └── ModernBaseList
│   │                   └── Table (no action buttons)
│   └── StatusBar (detects route, shows appropriate content)
```

### Context Architecture

#### StatusBarContext (Global)
- **Scope**: Application-wide
- **Purpose**: Status display coordination
- **Data**: `{ type, entryCount, searchTerm, isSearchActive, ... }`
- **Usage**: Any module publishes status via `setStatusInfo()`

#### ListManagementContext (Module-scoped)
- **Scope**: List Management module only
- **Purpose**: List-specific state and search functionality
- **Data**: `{ entryCount, searchTerm, isGlobalSearchActive }`
- **Usage**: Internal list management operations

### Key Components

#### 1. StatusBarProvider (`/context/StatusBarContext.jsx`)
```javascript
// Generic status context for any module
setStatusInfo({
  type: 'listManagement',
  entryCount: 23,
  searchTerm: 'vendor',
  isSearchActive: true
});
```

#### 2. ListManagementView (`/views/ListManagementView.jsx`)
- Coordinates between ActionBar, tabs, and list components
- Publishes status information to global StatusBarContext
- Manages local state and routes actions to appropriate handlers

#### 3. StatusBar (`/layout/StatusBar.jsx`)
- Route-aware status display
- Shows appropriate content based on current page
- For `/listmanagement`: displays search icon + entry count
- Detail modal with category-specific fields
- Consistent with vendor list pattern
