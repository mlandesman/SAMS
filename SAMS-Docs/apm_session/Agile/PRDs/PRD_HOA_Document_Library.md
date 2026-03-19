# PRD — HOA Document Library (DOC-LIB)

**Status:** TEMPLATE — To be fleshed out in a future planning session  
**Created:** March 19, 2026  
**Sprint:** DOC-LIB (not yet scheduled)  
**Issue:** TBD

---

## 1. Objective

Provide centralized, access-controlled document storage for HOA communities. Two tiers of documents with distinct visibility rules:

1. **HOA-Level Documents** (Admin-managed) — visible to all owners and managers across the HOA
2. **Unit-Level Documents** (User-uploaded) — shared only between owners and managers assigned to a specific unit, hidden from all other units

---

## 2. Document Categories

### HOA-Level (Admin-Managed)

| Category | Examples | Upload By |
|----------|----------|-----------|
| Rules & Regulations | HOA bylaws, community rules, parking policies | Admin |
| Bank Statements | Monthly bank account statements | Admin |
| Official Letters & Notices | Assembly notices, rule violation notices, legal correspondence | Admin |
| Newsletters | Community updates, event announcements | Admin |
| Meeting Minutes | Assembly minutes, board meeting records | Admin |
| Financial Reports | Annual budgets, audit reports | Admin |

### Unit-Level (User-Uploaded)

| Category | Examples | Upload By |
|----------|----------|-----------|
| Management Agreements | Property management contracts | Owner, Manager |
| Contracts | Rental agreements, maintenance contracts | Owner, Manager |
| Correspondence | Unit-specific letters, requests | Owner, Manager, Admin |
| Other | Miscellaneous unit-specific documents | Owner, Manager |

---

## 3. Access Control Model

| Document Tier | Admin | Unit Owner | Unit Manager | Other Units |
|---------------|-------|------------|--------------|-------------|
| HOA-Level | Read/Write/Delete | Read | Read | Read |
| Unit-Level (own unit) | Read/Write/Delete | Read/Write/Delete | Read/Write/Delete | **No Access** |
| Unit-Level (other unit) | Read | **No Access** | **No Access** | **No Access** |

Key rules:
- Admins can see and manage all documents across all tiers
- Owners and managers of a unit share full access to that unit's documents
- Unit-level documents are invisible to owners/managers of other units
- The existing `propertyAccess` and unit role assignment model provides the permission foundation

---

## 4. Data Model (Preliminary)

### Firestore Collection: `clients/{clientId}/documents/{docId}`

```
{
  id: string,               // auto-generated
  title: string,             // user-provided or derived from filename
  category: string,          // from predefined categories above
  tier: 'hoa' | 'unit',     // access tier
  unitId: string | null,     // null for HOA-level, unit ID for unit-level
  fileName: string,          // original file name
  fileType: string,          // mime type (application/pdf, image/jpeg, etc.)
  fileSize: number,          // bytes
  storagePath: string,       // Firebase Storage path
  storageUrl: string,        // public or signed URL
  uploadedBy: string,        // UID of uploader
  uploadedByName: string,    // display name at time of upload
  uploadedAt: timestamp,
  updatedAt: timestamp,
  description: string,       // optional notes
  tags: string[],            // optional search tags
  isArchived: boolean        // soft delete
}
```

### Firebase Storage Path Pattern

```
clients/{clientId}/documents/hoa/{category}/{fileName}
clients/{clientId}/documents/units/{unitId}/{category}/{fileName}
```

---

## 5. UI Components (To Be Designed)

### Desktop (Admin)

- **Document Manager view** — new tab or view in the admin interface
- Upload interface with drag-and-drop, category selection, tier/unit assignment
- Table view with filtering (by category, tier, unit, date, uploader)
- Preview for PDF and image documents (existing viewer infrastructure)
- Bulk upload capability
- Archive/delete with confirmation

### Desktop (Owner/Manager)

- Read-only view of HOA documents
- Read/write view of own unit documents (if accessed via unit context)

### Mobile (Owner/Manager)

- Document browsing grouped by category
- Tap to open PDF/image viewer (existing mobile viewer)
- Upload from camera or file picker for unit-level documents
- Filter by category

### Mobile (Admin)

- Full document list with filters
- Upload capability
- Quick access to recent uploads

---

## 6. Existing Code to Leverage

| Capability | Existing Code | Notes |
|------------|--------------|-------|
| File upload | Expense document upload (`U1` sprint) | Upload UI, Storage integration |
| PDF viewing | Statement of Account viewer | PDF display in modal |
| Image viewing | Expense receipt viewer | Image display in modal |
| Storage integration | `bulkStatementController.js` | Upload to client buckets |
| Firestore indexing | `accountStatements` collection | Metadata pattern |
| Permission checks | `requirePermission` middleware | Role-based access |
| Unit role lookup | `propertyAccess` model | Owner/Manager/Admin role |

---

## 7. Open Questions

1. **File size limits** — what maximum file size per document? Per unit? Per HOA?
2. **Retention policy** — should documents auto-archive after N years?
3. **Version control** — do we need document versioning (e.g., updated Rules & Regs)?
4. **Notifications** — should owners be notified when new HOA documents are posted?
5. **Search** — full-text search within documents, or just metadata search?
6. **Offline access** — should the mobile app cache documents for offline viewing?
7. **Signed URLs vs public** — security model for Storage access (signed URLs preferred for unit-level)

---

## 8. Estimated Effort

| Component | Estimate |
|-----------|----------|
| Backend: Firestore model, CRUD endpoints, permission middleware | 3-4h |
| Backend: Storage upload/download with signed URLs | 2-3h |
| Desktop Admin: Document Manager view (upload, browse, filter, delete) | 4-6h |
| Desktop Owner: Read-only HOA docs view | 1-2h |
| Mobile Owner: Document browsing + unit-level upload | 3-4h |
| Mobile Admin: Full document management | 2-3h |
| Testing + BugBot | 2-3h |
| **Total** | **17-25h** |

---

## 9. Dependencies

- Sprint MOBILE-OWNER-UX ✅ (mobile viewer patterns)
- Sprint MOBILE-ADMIN-UX ✅ (admin mobile patterns)
- Sprint U1 ✅ (document upload infrastructure)

---

*This PRD is a template. Schedule a planning session to finalize scope, prioritize MVP features, and create sprint tasks.*
