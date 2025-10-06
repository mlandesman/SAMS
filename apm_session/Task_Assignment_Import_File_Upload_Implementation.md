# Task Assignment: Import File Upload Implementation

**Task ID:** IMPORT-FILE-UPLOAD-001  
**Assigned To:** Implementation Agent  
**Priority:** High (Production Blocker)  
**Estimated Effort:** 2-3 Implementation Agent sessions  
**Created:** January 16, 2025  
**Manager Agent:** Manager Agent 13  

## Objective

Replace the current client onboarding directory path input with a file upload interface that uploads JSON files to Firebase Storage, maintaining the exact same user experience and import logic while solving the production deployment issue where Vercel servers cannot access Google Drive mounted directories.

## Background

**Current Issue:** The client onboarding process works perfectly in development (localhost) but fails in production (Vercel) because the server cannot access Google Drive mounted directories containing client JSON files.

**Current Flow:**
1. Select "-New Client-" from dropdown
2. Enter Data Path (text input: `/path/to/clientdata`)
3. Click "Preview Client" → calls `/admin/import/preview?dataPath=...`
4. Display Client Preview (Client ID, Name, Type, Units, Currency, Data Counts)
5. Click "Onboard Client" → stores in localStorage, navigates to Settings

**Target Flow:**
1. Select "-New Client-" from dropdown
2. Upload JSON Files (drag-and-drop interface)
3. Click "Preview Client" → parse client.json from uploaded files
4. Display Client Preview (same exact display as current)
5. Click "Onboard Client" → upload to Firebase Storage, start import

## Technical Requirements

### Phase 1: Create ImportFileUploader Component

**File:** `frontend/sams-ui/src/components/ImportFileUploader.jsx`

**Requirements:**
- Based on existing `DocumentUploader` component with `mode="deferred"`
- Accept only JSON files (`.json` extension)
- File size limit: 50MB per file
- Drag-and-drop interface identical to DocumentUploader
- Parse `Client.json` immediately when selected to extract clientId
- Filter out non-JSON files automatically
- Display selected files with remove capability

**Key Features:**
```jsx
const ImportFileUploader = ({ 
  onFilesSelected, 
  selectedFiles, 
  onClientDataParsed,
  mode = 'deferred' 
}) => {
  // File validation for JSON files only
  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!file.name.endsWith('.json')) {
      throw new Error('Only JSON files are allowed for import');
    }
    if (file.size > maxSize) {
      throw new Error(`File size too large. Maximum size is 50MB.`);
    }
    return true;
  };

  // Parse client.json when selected
  const handleFilesSelected = async (files) => {
    // Filter to only JSON files
    const jsonFiles = files.filter(file => 
      file.name.endsWith('.json')
    );
    
    onFilesSelected(jsonFiles);
    
    // Find and parse client.json (required for clientId)
    const clientJsonFile = jsonFiles.find(f => f.name === 'Client.json');
    if (clientJsonFile) {
      try {
        const text = await clientJsonFile.text();
        const clientData = JSON.parse(text);
        onClientDataParsed(clientData);
      } catch (error) {
        console.error('Failed to parse Client.json:', error);
      }
    }
  };
};
```

### Phase 2: Modify ClientSwitchModal Onboarding Section

**File:** `frontend/sams-ui/src/components/ClientSwitchModal.jsx`

**Changes Required:**
- Replace lines 192-210 (data path input) with ImportFileUploader component
- Add state management for selectedFiles and clientPreview
- Maintain exact same preview display logic
- Maintain exact same onboarding flow

**Implementation:**
```jsx
// Replace lines 192-210 with:
<div className="onboarding-section">
  <label className="field-label">Upload Client Data Files:</label>
  <ImportFileUploader
    onFilesSelected={setSelectedFiles}
    selectedFiles={selectedFiles}
    onClientDataParsed={setClientPreview}
    mode="deferred"
  />
  <button
    onClick={handlePreviewClient}
    disabled={isLoading || !selectedFiles?.length}
    className="primary"
    style={{ marginBottom: '15px' }}
  >
    {isLoading ? '⏳ Loading...' : '👁️ Preview Client'}
  </button>
</div>
```

### Phase 3: Modify Preview Logic

**File:** `frontend/sams-ui/src/components/ClientSwitchModal.jsx`

**Requirements:**
- Maintain exact same preview display as current implementation
- Use same dataCounts calculation logic from `previewClientData` function
- Read from selectedFiles instead of file system
- Handle missing files gracefully (show 0 count)

**Implementation:**
```jsx
const handlePreviewClient = async () => {
  if (!selectedFiles?.length) {
    alert('Please upload client data files first');
    return;
  }
  
  if (!clientPreview) {
    alert('Could not parse Client.json from uploaded files');
    return;
  }
  
  // Use the SAME logic as previewClientData function
  const dataCounts = {};
  const dataFiles = [
    { key: 'config', file: 'Config.json' },
    { key: 'paymentMethods', file: 'paymentMethods.json' },
    { key: 'categories', file: 'Categories.json' },
    { key: 'vendors', file: 'Vendors.json' },
    { key: 'units', file: 'Units.json' },
    { key: 'transactions', file: 'Transactions.json' },
    { key: 'hoadues', file: 'HOADues.json' },
    { key: 'yearEndBalances', file: 'YearEndBalances.json' }
  ];
  
  for (const { key, file } of dataFiles) {
    const fileData = selectedFiles.find(f => f.name === file);
    if (fileData) {
      try {
        const text = await fileData.text();
        const data = JSON.parse(text);
        dataCounts[key] = Array.isArray(data) ? data.length : Object.keys(data).length;
      } catch (e) {
        dataCounts[key] = 'Error reading file';
      }
    } else {
      dataCounts[key] = 0;
    }
  }
  
  // Update clientPreview with dataCounts
  setClientPreview({
    ...clientPreview,
    dataCounts
  });
};
```

### Phase 4: Modify Onboard Logic

**File:** `frontend/sams-ui/src/components/ClientSwitchModal.jsx`

**Requirements:**
- Delete existing files from `/imports/{clientId}/` before upload
- Upload all selected files to Firebase Storage with progress
- Start import process (same as current)
- Maintain exact same localStorage storage and navigation

**Implementation:**
```jsx
const handleOnboardClient = async () => {
  if (!clientPreview || !selectedFiles?.length) {
    alert('Please preview the client data first');
    return;
  }
  
  try {
    setIsLoading(true);
    
    // 1. Delete existing files from /imports/{clientId}/
    await deleteImportFiles(clientPreview.clientId);
    
    // 2. Upload files to /imports/{clientId}/ with progress
    await uploadImportFilesWithProgress(clientPreview.clientId, selectedFiles);
    
    // 3. Start import process (SAME as current)
    await startImportProcess(clientPreview.clientId);
    
    // 4. Store onboarding info (SAME as current)
    localStorage.setItem('onboardingClient', JSON.stringify({
      clientId: clientPreview.clientId,
      displayName: clientPreview.displayName,
      dataPath: 'firebase_storage', // Updated to indicate Firebase Storage
      preview: clientPreview
    }));
    
    // 5. Create temp client and navigate (SAME as current)
    const tempClient = {
      id: clientPreview.clientId,
      basicInfo: {
        fullName: clientPreview.displayName,
        clientId: clientPreview.clientId,
        displayName: clientPreview.displayName,
        clientType: clientPreview.clientType,
        status: 'onboarding'
      },
      branding: {
        logoUrl: null,
        iconUrl: null
      },
      configuration: {
        timezone: 'America/Cancun',
        currency: clientPreview.preview?.currency || 'MXN',
        language: 'es-MX',
        dateFormat: 'DD/MM/YYYY'
      },
      contactInfo: {
        primaryEmail: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'MX'
        }
      },
      _isOnboarding: true
    };
    
    setClient(tempClient);
    onClose();
    navigate('/settings');
    
  } catch (error) {
    console.error('Onboarding failed:', error);
    alert(`Onboarding failed: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
};
```

### Phase 5: Create Firebase Storage Upload Functions

**File:** `frontend/sams-ui/src/api/importStorage.js`

**Requirements:**
- Create functions to upload files to Firebase Storage
- Create functions to delete existing import files
- Handle progress tracking for small files (simple counter)
- Error handling and retry logic

**Implementation:**
```javascript
import { getStorage, ref, uploadBytes, deleteObject, listAll } from 'firebase/storage';

const storage = getStorage();

export const uploadFileToFirebaseStorage = async (filePath, file) => {
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  return filePath;
};

export const deleteImportFiles = async (clientId) => {
  const importRef = ref(storage, `imports/${clientId}`);
  const listResult = await listAll(importRef);
  
  const deletePromises = listResult.items.map(item => deleteObject(item));
  await Promise.all(deletePromises);
};

export const uploadImportFilesWithProgress = async (clientId, files) => {
  console.log(`Uploading ${files.length} JSON files to /imports/${clientId}/`);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
    await uploadFileToFirebaseStorage(`imports/${clientId}/${file.name}`, file);
  }
  
  console.log('✅ All files uploaded successfully');
};
```

### Phase 6: Modify Import Service

**File:** `backend/services/importService.js`

**Requirements:**
- Modify file reading functions to read from Firebase Storage instead of file system
- Maintain exact same import logic and validation
- Handle Firebase Storage authentication
- Preserve all existing error handling

**Implementation:**
```javascript
// Replace fs.readFileSync calls with Firebase Storage reads
const readFileFromFirebaseStorage = async (filePath) => {
  const storage = getStorage();
  const fileRef = ref(storage, filePath);
  
  try {
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    const text = await response.text();
    return text;
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
};

// Update all file reading functions to use Firebase Storage
// Example: Replace fs.readFileSync(filePath, 'utf8') with await readFileFromFirebaseStorage(filePath)
```

## Testing Requirements

### Phase 1: Component Testing
- [ ] ImportFileUploader component renders correctly
- [ ] File validation works (JSON only, size limits)
- [ ] Drag-and-drop functionality works
- [ ] Client.json parsing works correctly
- [ ] File removal functionality works

### Phase 2: Integration Testing
- [ ] ClientSwitchModal onboarding section displays correctly
- [ ] Preview logic works with uploaded files
- [ ] Data counts display correctly
- [ ] Error handling works for invalid files

### Phase 3: End-to-End Testing
- [ ] Complete onboarding flow works
- [ ] Files upload to Firebase Storage correctly
- [ ] Import process reads from Firebase Storage
- [ ] Generated files (cross-reference) get overwritten correctly
- [ ] Navigation to Settings works correctly

### Phase 4: Production Testing
- [ ] Test with MTC client data (all JSON files)
- [ ] Test with AVII client data (subset of files)
- [ ] Test with new client data (minimal files)
- [ ] Verify import process completes successfully
- [ ] Verify data integrity in Firebase

## Success Criteria

1. **Exact User Experience Match**: Onboarding flow looks and feels identical to current
2. **Production Deployment**: Works on Vercel servers (no file system access needed)
3. **File Flexibility**: Handles any client's JSON file structure
4. **Import Logic Preservation**: All existing import logic remains unchanged
5. **Error Handling**: Graceful handling of missing files and upload errors
6. **Performance**: Upload progress for small files (1 of 9, 2 of 9, etc.)

## Dependencies

- Existing `DocumentUploader` component (for UI patterns)
- Existing `ClientSwitchModal` component (for integration)
- Existing `importService.js` (for import logic)
- Firebase Storage (for file storage)
- Existing import preview logic (for data counts)

## Risk Mitigation

1. **Backup Current Implementation**: Keep current directory path input as fallback
2. **Gradual Rollout**: Test with development environment first
3. **File Validation**: Strict JSON file validation to prevent errors
4. **Error Recovery**: Clear error messages and retry mechanisms
5. **Import Logic Preservation**: Minimal changes to proven import logic

## Deliverables

1. **ImportFileUploader Component**: Complete with validation and parsing
2. **Modified ClientSwitchModal**: Updated onboarding section
3. **Firebase Storage API**: Upload and delete functions
4. **Modified Import Service**: Firebase Storage integration
5. **Test Results**: Comprehensive testing documentation
6. **Production Deployment**: Working solution on Vercel

## Notes

- **File Size**: MTCdata directory is under 500kB total, so progress bars will be minimal
- **Generated Files**: Cross-reference files get overwritten anyway, so including them is harmless
- **Flexibility**: Loading all JSON files makes this work with any client structure
- **Logic Preservation**: Only file location changes, not import logic
- **User Experience**: Maintains exact same flow and display as current implementation

## Next Steps After Completion

1. **Test with Production Data**: Verify with real client data
2. **Monitor Performance**: Ensure upload/import performance is acceptable
3. **Documentation Update**: Update onboarding documentation
4. **Training**: Brief users on new file upload process
5. **Cleanup**: Remove old directory path input code after successful deployment

---

**Manager Agent Notes:**
This task addresses the critical production blocker identified in Phase 12 where the import functionality fails on Vercel servers due to inability to access Google Drive mounted directories. The solution maintains the exact same user experience while moving file storage to Firebase Storage, making it production-ready.
