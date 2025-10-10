# Task Assignment - Web-Based Import/Purge System

**Date:** September 30, 2025  
**Priority:** HIGH - Production Infrastructure  
**Estimated Effort:** 3-4 Implementation Agent sessions  
**Agent Type:** Implementation Agent
**Branch:** Create new branch `web-based-import-system`

---

## Task Overview

Build a web-based import/purge system accessible through the Settings page for superadmin users. This provides a UI with checkboxes to selectively purge and import data components, eliminating the need for command-line access and mock objects while leveraging the full application infrastructure.

**Benefits:**
- Real API calls with proper authentication
- Full validation and audit trails
- Visual progress tracking
- Selective component control via checkboxes
- Permanent solution for client onboarding
- No mock objects or CLI complexity

---

## Phase 1: Backend Infrastructure (1 session)

### Task 1.1: Create Import Controller

**Create new file:** `backend/controllers/importController.js`

```javascript
import { DateService, getNow } from '../services/DateService.js';
import transactionsController from './transactionsController.js';
import unitsController from './unitsController.js';
import hoaDuesController from './hoaDuesController.js';
// ... other controllers

const importController = {
  // Get import configuration options
  async getImportConfig(req, res) {
    const { clientId } = req.params;
    
    try {
      const config = {
        clientId,
        components: [
          { id: 'users', label: 'Users', canPurge: true, canImport: true },
          { id: 'units', label: 'Units', canPurge: true, canImport: true },
          { id: 'categories', label: 'Categories', canPurge: true, canImport: true },
          { id: 'vendors', label: 'Vendors', canPurge: true, canImport: true },
          { id: 'transactions', label: 'Transactions', canPurge: true, canImport: true },
          { id: 'hoadues', label: 'HOA Dues', canPurge: true, canImport: true },
          { id: 'yearEndBalances', label: 'Year End Balances', canPurge: true, canImport: true }
        ],
        dataPath: `/Users/michael/.../SAMS/${clientId}data`
      };
      
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Execute purge operation
  async executePurge(req, res) {
    const { clientId } = req.params;
    const { components, dryRun = false } = req.body;
    
    // Track progress
    const progress = {
      status: 'running',
      components: {},
      startTime: getNow()
    };
    
    // Store progress in memory or Redis for status checks
    req.app.locals.importProgress = req.app.locals.importProgress || {};
    req.app.locals.importProgress[clientId] = progress;
    
    // Execute purge for each selected component
    for (const component of components) {
      progress.components[component] = { status: 'purging', count: 0 };
      
      try {
        const count = await this.purgeComponent(clientId, component, dryRun);
        progress.components[component] = { 
          status: 'completed', 
          count,
          message: `Purged ${count} ${component}`
        };
      } catch (error) {
        progress.components[component] = { 
          status: 'error', 
          error: error.message 
        };
      }
    }
    
    progress.status = 'completed';
    progress.endTime = getNow();
    
    res.json(progress);
  },

  // Execute import operation
  async executeImport(req, res) {
    const { clientId } = req.params;
    const { components, dataPath } = req.body;
    
    // Similar structure to purge
    // Call appropriate import functions for each component
  },

  // Get progress status
  async getProgress(req, res) {
    const { clientId } = req.params;
    const progress = req.app.locals.importProgress?.[clientId] || { status: 'idle' };
    res.json(progress);
  }
};
```

### Task 1.2: Add Import Routes

**Update:** `backend/routes/admin.js`

```javascript
import importController from '../controllers/importController.js';

// Import/Export routes (superadmin only)
router.get('/import/:clientId/config', authenticate, authorizeRole(['superadmin']), importController.getImportConfig);
router.post('/import/:clientId/purge', authenticate, authorizeRole(['superadmin']), importController.executePurge);
router.post('/import/:clientId/import', authenticate, authorizeRole(['superadmin']), importController.executeImport);
router.get('/import/:clientId/progress', authenticate, authorizeRole(['superadmin']), importController.getProgress);
```

### Task 1.3: Create Import Service

**Create new file:** `backend/services/importService.js`

This service handles the actual import logic, using existing controllers:

```javascript
import fs from 'fs/promises';
import path from 'path';
import { DateService } from './DateService.js';
import { augmentTransaction } from '../../scripts/data-augmentation-utils.js';

export class ImportService {
  constructor(clientId, dataPath) {
    this.clientId = clientId;
    this.dataPath = dataPath;
    this.dateService = new DateService({ timezone: 'America/Cancun' });
  }

  async importTransactions(req) {
    const data = await this.loadJsonFile('Transactions.json');
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const transaction of data) {
      try {
        // Augment transaction data
        const augmented = augmentTransaction(transaction, this.clientId);
        
        // Parse date properly
        augmented.date = this.dateService.parseFromFrontend(
          transaction.Date, 
          'M/d/yyyy'
        );
        
        // Use real controller with real req/res
        const mockReq = {
          ...req,
          params: { clientId: this.clientId },
          body: augmented
        };
        
        // Call controller method directly
        await transactionsController.createTransaction(mockReq, res);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
      }
    }
    
    return results;
  }
  
  // Similar methods for other components...
}
```

### Acceptance Criteria - Phase 1
- [ ] Import controller with all CRUD operations
- [ ] Routes properly secured for superadmin only
- [ ] Import service using real controllers
- [ ] Progress tracking mechanism
- [ ] Error handling and rollback capability

---

## Phase 2: Frontend UI Components (1.5 sessions)

### Task 2.1: Create Import Management Component

**Create new file:** `frontend/sams-ui/src/components/Settings/ImportManagement.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle,
  Checkbox, Button, Progress, Alert,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';

export function ImportManagement({ clientId }) {
  const [config, setConfig] = useState(null);
  const [selectedPurge, setSelectedPurge] = useState([]);
  const [selectedImport, setSelectedImport] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const api = useApi();

  useEffect(() => {
    loadConfig();
  }, [clientId]);

  const loadConfig = async () => {
    const response = await api.get(`/admin/import/${clientId}/config`);
    setConfig(response.data);
  };

  const handlePurge = async () => {
    if (!selectedPurge.length) return;
    
    if (!confirm(`This will DELETE ${selectedPurge.join(', ')} data. Continue?`)) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await api.post(`/admin/import/${clientId}/purge`, {
        components: selectedPurge,
        dryRun: false
      });
      
      // Start polling for progress
      pollProgress();
    } catch (error) {
      console.error('Purge failed:', error);
    }
  };

  const pollProgress = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/admin/import/${clientId}/progress`);
        setProgress(response.data);
        
        if (response.data.status === 'completed') {
          clearInterval(interval);
          setIsProcessing(false);
        }
      } catch (error) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Purge Section */}
      <Card>
        <CardHeader>
          <CardTitle>Selective Data Purge</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Warning: Purging will permanently delete selected data components.
              Always backup before purging production data.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            {config?.components.map(component => (
              <label key={component.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedPurge.includes(component.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPurge([...selectedPurge, component.id]);
                    } else {
                      setSelectedPurge(selectedPurge.filter(c => c !== component.id));
                    }
                  }}
                  disabled={!component.canPurge || isProcessing}
                />
                <span>{component.label}</span>
              </label>
            ))}
          </div>
          
          <Button
            variant="destructive"
            onClick={handlePurge}
            disabled={!selectedPurge.length || isProcessing}
            className="mt-4"
          >
            Execute Purge
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle>Selective Data Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium">Data Path</label>
            <input
              type="text"
              value={config?.dataPath || ''}
              className="w-full mt-1 p-2 border rounded"
              readOnly
            />
          </div>
          
          <div className="space-y-2">
            {config?.components.map(component => (
              <label key={component.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedImport.includes(component.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedImport([...selectedImport, component.id]);
                    } else {
                      setSelectedImport(selectedImport.filter(c => c !== component.id));
                    }
                  }}
                  disabled={!component.canImport || isProcessing}
                />
                <span>{component.label}</span>
              </label>
            ))}
          </div>
          
          <Button
            onClick={handleImport}
            disabled={!selectedImport.length || isProcessing}
            className="mt-4"
          >
            Execute Import
          </Button>
        </CardContent>
      </Card>

      {/* Progress Section */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Operation Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(progress.components || {}).map(([component, status]) => (
                <div key={component}>
                  <div className="flex justify-between text-sm">
                    <span>{component}</span>
                    <span className={
                      status.status === 'error' ? 'text-red-500' :
                      status.status === 'completed' ? 'text-green-500' :
                      'text-yellow-500'
                    }>
                      {status.status}
                    </span>
                  </div>
                  {status.message && (
                    <p className="text-sm text-muted-foreground">{status.message}</p>
                  )}
                  {status.error && (
                    <p className="text-sm text-red-500">{status.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Task 2.2: Add to Settings Page

**Update:** `frontend/sams-ui/src/pages/Settings.jsx`

Add a new tab for "Data Management" that includes the ImportManagement component:

```jsx
{user.role === 'superadmin' && (
  <TabPanel value="data-management">
    <ImportManagement clientId={selectedClient.docId} />
  </TabPanel>
)}
```

### Acceptance Criteria - Phase 2
- [ ] Checkbox UI for selective purge/import
- [ ] Real-time progress display
- [ ] Error handling and user feedback
- [ ] Confirmation dialogs for destructive operations
- [ ] Responsive design

---

## Phase 3: Integration and Testing (1 session)

### Task 3.1: Connect Frontend to Backend

Ensure all API calls work correctly:
- Test authentication flow
- Verify superadmin authorization
- Check progress updates
- Handle errors gracefully

### Task 3.2: Test Complete Workflow

1. **Test Purge Operations:**
   - Select individual components
   - Verify data is actually deleted
   - Check rollback capability

2. **Test Import Operations:**
   - Import single components
   - Import multiple components
   - Verify dependencies are handled

3. **Test Progress Tracking:**
   - Real-time updates work
   - Error states display correctly
   - Completion states clear properly

### Task 3.3: Add Advanced Features

**Optional enhancements:**
1. Dry run mode checkbox
2. Import history log
3. Backup before purge option
4. Import validation preview
5. Scheduling for regular imports

### Acceptance Criteria - Phase 3
- [ ] Complete workflow tested end-to-end
- [ ] All error cases handled
- [ ] Performance acceptable for large datasets
- [ ] UI responsive during operations
- [ ] Audit trail complete

---

## Phase 4: Production Readiness (0.5 sessions)

### Task 4.1: Add Safety Features

1. **Automatic Backups:**
   - Before purge operations
   - Snapshot of current state
   - Rollback capability

2. **Validation Reports:**
   - Pre-import data validation
   - Post-import integrity checks
   - Discrepancy reporting

3. **Operation Logs:**
   - Detailed audit trail
   - Who did what when
   - Success/failure metrics

### Task 4.2: Documentation

Create user documentation:
1. How to prepare data files
2. Import/purge best practices
3. Troubleshooting guide
4. Video walkthrough

### Task 4.3: Performance Optimization

- Batch operations for large datasets
- Progress chunking
- Memory management
- Timeout handling

### Acceptance Criteria - Phase 4
- [ ] All safety features implemented
- [ ] Documentation complete
- [ ] Performance tested with large datasets
- [ ] Ready for production use

---

## Technical Considerations

### State Management
```javascript
// Consider using React Query or SWR for:
- Progress polling
- Optimistic updates
- Cache management
- Error recovery
```

### Security
```javascript
// Ensure all operations:
- Require superadmin role
- Are fully audited
- Have confirmation steps
- Support rollback
```

### Scalability
```javascript
// For large imports:
- Use streaming for large files
- Implement job queues
- Add progress persistence
- Support resume capability
```

---

## Definition of Done

### Core Requirements
- [ ] Web UI with checkbox selection
- [ ] Real API calls (no mock objects)
- [ ] Full audit trail
- [ ] Progress tracking
- [ ] Error handling

### Quality Requirements
- [ ] No data corruption
- [ ] Atomic operations
- [ ] Comprehensive validation
- [ ] Performance acceptable
- [ ] Security enforced

### User Experience
- [ ] Intuitive interface
- [ ] Clear feedback
- [ ] Responsive design
- [ ] Helpful error messages
- [ ] Progress visibility

---

## Success Metrics

- Zero data loss incidents
- Import time < 5 minutes for typical dataset
- All operations fully audited
- No manual CLI access required
- Suitable for non-technical users

This creates a permanent, user-friendly solution for client data management that leverages the full application infrastructure.