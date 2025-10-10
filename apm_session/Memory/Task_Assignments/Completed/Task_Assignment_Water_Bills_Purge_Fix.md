---
task_id: WB-Purge-001
priority: 🔥 HIGH
agent_type: Implementation Agent
status: ASSIGNED
created: 2025-10-10
estimated_effort: 2-3 hours
memory_log_path: apm_session/Memory/Task_Completion_Logs/Water_Bills_Purge_Fix_2025-10-10.md
---

# Task Assignment: Fix Water Bills Purge System

## Objective
Fix the purge system to properly delete water bills collections (`/projects/waterBills/bills` and `/projects/waterBills/readings`) which are currently being left behind as ghost documents.

## Background
- **Issue:** When purging AVII client, water bills collections remain as ghosts
- **Impact:** Manual cleanup required after every purge
- **User Report:** "it leaves behind /projects/waterBills/bills and readings which creates ghosts at the client level"
- **Root Cause:** Purge system doesn't know about water bills nested structure

## Current Behavior
```
/clients/AVII/ (deleted) ✅
  /projects/ (ghost - exists but empty) ❌
    /waterBills/ (ghost) ❌
      /bills/ (ghost with documents) ❌
      /readings/ (ghost with documents) ❌
```

## Analysis

### Current Purge Implementation
**File:** `backend/controllers/importController.js`

The recursive `deleteSubCollectionsWithProgress()` (line 903) should delete all subcollections, but it's missing the water bills collections.

**Likely Issues:**
1. The `/projects` subcollection might not be enumerated properly
2. Error handling might be swallowing failures silently
3. The deeply nested structure might exceed recursion expectations

---

## Task Requirements

### Step 1: Debug Current Purge Behavior
Add comprehensive logging to understand why water bills aren't being deleted:

```javascript
// In deleteSubCollectionsWithProgress, after line 909:
console.log(`🗑️ Found subcollection: ${subCollection.path}`);

// After line 918:
console.log(`🗑️ Purging subcollection: ${collectionName} at path: ${subCollection.path}`);

// In the error handler (line 960):
console.error(`❌ Detailed error for ${subCollection.path}:`, error);
```

### Step 2: Add Explicit Water Bills Purge
**Option A: Add to component-specific purge**

Create a dedicated water bills purge function:
```javascript
async function purgeWaterBills(db, clientId, dryRun = false) {
  console.log(`💧 Purging Water Bills for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    // Purge bills collection
    const billsRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    const billsSnapshot = await billsRef.get();
    console.log(`📊 Found ${billsSnapshot.size} water bill documents`);
    
    for (const doc of billsSnapshot.docs) {
      if (!dryRun) {
        // Delete any subcollections first (payments, etc.)
        await deleteSubCollections(doc.ref);
        await doc.ref.delete();
      }
      deletedCount++;
    }
    
    // Purge readings collection
    const readingsRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    const readingsSnapshot = await readingsRef.get();
    console.log(`📊 Found ${readingsSnapshot.size} water reading documents`);
    
    for (const doc of readingsSnapshot.docs) {
      if (!dryRun) {
        await doc.ref.delete();
      }
      deletedCount++;
    }
    
    // Delete the waterBills document itself
    const waterBillsDoc = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    if (!dryRun) {
      await waterBillsDoc.delete();
    }
    deletedCount++;
    
    // Delete the projects document if empty
    const projectsDoc = db.collection('clients').doc(clientId)
      .collection('projects');
    
    const remainingProjects = await projectsDoc.get();
    if (remainingProjects.empty && !dryRun) {
      // No documents left, safe to delete collection
      console.log(`🗑️ Removing empty projects collection`);
    }
    
  } catch (error) {
    errors.push(`Water Bills purge failed: ${error.message}`);
    console.error(`❌ Water Bills purge error:`, error);
  }
  
  return { deletedCount, errors };
}
```

**Option B: Fix recursive deletion**

Ensure the recursive function properly handles the `/projects` path:
```javascript
// In deleteSubCollectionsWithProgress, add special handling:
if (collectionName === 'projects') {
  console.log(`🎯 Special handling for projects collection`);
  // Ensure waterBills subcollection is found
}
```

### Step 3: Add to Purge Sequence
In `executePurge()` around line 380, add water bills to the sequence:

```javascript
const purgeSteps = [
  { id: 'importMetadata', name: 'Import Metadata' },
  { id: 'waterBills', name: 'Water Bills' },  // Add this
  { id: 'transactions', name: 'Transactions' },
  // ... rest of steps
];

// In the switch statement (line 402):
case 'waterBills':
  result = await purgeWaterBills(db, clientId, dryRun);
  break;
```

### Step 4: Handle Ghost Documents
Ensure complete cleanup:

```javascript
// After all purges complete, check for ghosts:
async function cleanupGhostCollections(db, clientId, dryRun = false) {
  // Check if projects collection has any documents
  const projectsRef = db.collection('clients').doc(clientId).collection('projects');
  const projectsDocs = await projectsRef.listDocuments();
  
  for (const docRef of projectsDocs) {
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`👻 Found ghost document: ${docRef.path}`);
      if (!dryRun) {
        await deleteSubCollections(docRef);
        await docRef.delete();
      }
    }
  }
}
```

---

## Testing Requirements

### Step 1: Test Current Behavior
1. Import AVII client with water bills
2. Run purge with enhanced logging
3. Document which collections are found/skipped
4. Check Firebase Console for remaining collections

### Step 2: Test Fix
1. Apply the fix (either Option A or B)
2. Import AVII client again
3. Run purge
4. Verify in Firebase Console:
   - No `/projects` collection remains
   - No `/waterBills` documents
   - No ghost documents at any level

### Step 3: Test Other Clients
1. Ensure MTC client (no water bills) still purges correctly
2. Verify no side effects on other collections

---

## Success Criteria
- [ ] Water bills collections are completely deleted during purge
- [ ] No ghost documents remain after purge
- [ ] No manual cleanup required
- [ ] Purge completes without errors
- [ ] Progress tracking shows water bills deletion

## Deliverables
1. Updated purge system with water bills support
2. Enhanced logging for debugging
3. Test results showing complete cleanup
4. Memory log documenting the fix

## References
- Original purge fix: `apm_session/Memory/Task_Completion_Logs/Fix_Purge_System_Ghost_Documents_2025-10-02.md`
- Current purge implementation: `backend/controllers/importController.js`

## Notes
- The October 2 purge fix was comprehensive but didn't account for water bills
- Water bills were added October 7, after the purge system was last updated
- Consider making purge system more generic to handle future collections

---

**Manager Agent Note:** This is a HIGH priority issue affecting production operations. The fix should ensure complete cleanup without requiring manual intervention.
