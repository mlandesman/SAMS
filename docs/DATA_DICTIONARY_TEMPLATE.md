# SAMS Data Dictionary Template

**Version**: 1.0  
**Last Updated**: [Date]  
**Purpose**: Single source of truth for all data field definitions in SAMS

## How to Use This Dictionary
1. When creating new features, reference this for field names
2. When importing data, use these exact field names
3. When debugging, check if field names match these definitions
4. Update this document when adding new fields (with version bump)

## Standard Naming Conventions
- **Fields**: camelCase (e.g., `firstName`, `dueDate`)
- **IDs**: Always use `{entity}Id` format (e.g., `userId`, `vendorId`)
- **Dates**: ISO 8601 format (YYYY-MM-DD or full timestamp)
- **Amounts**: Always in cents (integer)
- **Booleans**: Use `is` or `has` prefix (e.g., `isActive`, `hasAccess`)

---

## Core Entities

### 1. Transaction
**Collection**: `transactions`  
**Purpose**: Financial transactions for all clients

| Field Name | Type | Required | Description | Example | Validation |
|------------|------|----------|-------------|---------|------------|
| id | string | Yes* | Auto-generated Firestore ID | "abc123def456" | Generated |
| unitId | string | Yes | Reference to units.id | "1A" | Must exist in units |
| clientId | string | Yes | Reference to clients.id | "MTC" | Must exist in clients |
| amount | number | Yes | Amount in cents | 150000 | Min: 1 |
| date | ISO date | Yes | Transaction date | "2025-01-03" | Valid date |
| category | string | Yes | Transaction category | "HOA Dues" | From category list |
| vendorId | string | No | Reference to vendors.id | "vendor123" | Must exist if provided |
| description | string | No | Transaction description | "Monthly dues" | Max 500 chars |
| type | string | Yes | income/expense | "expense" | Enum: income, expense |
| paymentMethod | string | No | Payment method used | "check" | From payment methods |
| checkNumber | string | No | Check number if applicable | "1234" | Numeric string |
| reference | string | No | External reference | "INV-2025-001" | |
| notes | string | No | Internal notes | "Paid late" | |
| createdAt | timestamp | Yes* | Creation timestamp | "2025-01-03T10:30:00Z" | Auto-generated |
| createdBy | string | Yes* | User who created | "user123" | From auth |
| updatedAt | timestamp | No | Last update timestamp | "2025-01-03T11:00:00Z" | Auto-updated |
| updatedBy | string | No | User who last updated | "user456" | From auth |

**Relationships**:
- `unitId` → `units.id`
- `clientId` → `clients.id`
- `vendorId` → `vendors.id` (optional)
- `category` → `categories.name`

**Notes**:
- Previously used `unit` field - now standardized to `unitId`
- Amount is always positive, type determines if income/expense

---

### 2. Unit
**Collection**: `units`  
**Purpose**: Property units within each client

| Field Name | Type | Required | Description | Example | Validation |
|------------|------|----------|-------------|---------|------------|
| id | string | Yes | Unit identifier | "1A" | Unique per client |
| clientId | string | Yes | Parent client | "MTC" | Must exist |
| unitNumber | string | Yes | Display number | "1A" | |
| building | string | No | Building identifier | "A" | |
| floor | number | No | Floor number | 1 | |
| bedrooms | number | No | Number of bedrooms | 2 | Min: 0 |
| bathrooms | number | No | Number of bathrooms | 1.5 | Min: 0 |
| squareFeet | number | No | Square footage | 1200 | Min: 1 |
| monthlyDues | number | Yes | HOA dues in cents | 50000 | Min: 0 |
| owner | object | Yes | Owner information | See below | |
| owner.firstName | string | Yes | Owner first name | "John" | |
| owner.lastName | string | Yes | Owner last name | "Doe" | |
| owner.email | string | No | Owner email | "john@example.com" | Valid email |
| owner.phone | string | No | Owner phone | "+1234567890" | |
| isRented | boolean | No | Rental status | false | Default: false |
| tenant | object | No | Tenant info if rented | See owner structure | |

---

### 3. Vendor
**Collection**: `vendors`  
**Purpose**: Service providers and payees

| Field Name | Type | Required | Description | Example | Validation |
|------------|------|----------|-------------|---------|------------|
| id | string | Yes* | Auto-generated ID | "vendor123" | Generated |
| clientId | string | Yes | Client association | "MTC" | Must exist |
| name | string | Yes | Vendor name | "ABC Plumbing" | Max 200 chars |
| category | string | No | Vendor category | "Maintenance" | |
| email | string | No | Contact email | "info@abc.com" | Valid email |
| phone | string | No | Contact phone | "+1234567890" | |
| address | object | No | Vendor address | | |
| address.street | string | No | Street address | "123 Main St" | |
| address.city | string | No | City | "Miami" | |
| address.state | string | No | State/Province | "FL" | |
| address.zip | string | No | Postal code | "33101" | |
| address.country | string | No | Country | "USA" | Default: "USA" |
| taxId | string | No | Tax ID number | "12-3456789" | |
| isActive | boolean | Yes | Active status | true | Default: true |
| notes | string | No | Internal notes | "Preferred vendor" | |

---

### 4. Category
**Collection**: `categories`  
**Purpose**: Transaction categorization

| Field Name | Type | Required | Description | Example | Validation |
|------------|------|----------|-------------|---------|------------|
| id | string | Yes* | Auto-generated ID | "cat123" | Generated |
| clientId | string | Yes | Client association | "MTC" | Must exist |
| name | string | Yes | Category name | "Maintenance" | Unique per client |
| type | string | Yes | Category type | "expense" | Enum: income, expense |
| description | string | No | Category description | "Building maintenance" | |
| parentId | string | No | Parent category | "cat456" | For subcategories |
| isActive | boolean | Yes | Active status | true | Default: true |
| sortOrder | number | No | Display order | 1 | For UI sorting |

---

### 5. HOA Dues
**Collection**: `clients/{clientId}/units/{unitId}/dues/{year}`  
**Purpose**: HOA payment tracking by unit and year

| Field Name | Type | Required | Description | Example | Validation |
|------------|------|----------|-------------|---------|------------|
| scheduledAmount | number | Yes | Monthly due amount | 50000 | In cents |
| creditBalance | number | Yes | Credit balance | 10000 | Can be negative |
| payments | array | Yes | Payment records | See below | |
| payments[].month | number | Yes | Month (1-12) | 7 | 1-12 |
| payments[].paid | number | Yes | Amount paid | 50000 | In cents |
| payments[].date | ISO date | No | Payment date | "2025-07-15" | |
| payments[].transactionId | string | No | Link to transaction | "trans123" | |
| payments[].notes | string | No | Payment notes | "Late payment" | |
| creditBalanceHistory | array | No | Credit changes | | |

---

## Import Scripts Field Mappings

### Transaction Import
**Script**: `/scripts/import-transactions.js`
**CSV Headers** → **Database Fields**:
- `Date` → `date`
- `Unit` → `unitId` (was `unit`, now fixed)
- `Amount` → `amount` (multiply by 100 for cents)
- `Description` → `description`
- `Vendor` → `vendorId` (lookup required)
- `Category` → `category`
- `Check #` → `checkNumber`
- `Type` → `type`

### Unit Import
**Script**: `/scripts/import-units.js`
**CSV Headers** → **Database Fields**:
- `Unit Number` → `id` and `unitNumber`
- `Owner First` → `owner.firstName`
- `Owner Last` → `owner.lastName`
- `Monthly Dues` → `monthlyDues` (multiply by 100)
- `Email` → `owner.email`
- `Phone` → `owner.phone`

---

## Field History & Changes

### Version 1.1 (2025-01-03)
- Changed `unit` to `unitId` in transactions
- Standardized all ID fields to use `{entity}Id` format
- Added validation rules

### Version 1.0 (Initial)
- Base field definitions from original implementation

---

## Validation Rules

### Global Rules
1. All required fields must be present
2. String fields are trimmed of whitespace
3. Email fields must match RFC 5322 format
4. Phone numbers stored in E.164 format
5. Dates in ISO 8601 format
6. Amounts always in cents (integer)

### Cross-Entity Rules
1. Foreign keys must reference existing records
2. Deletion cascades must be handled
3. Client isolation must be maintained

---

**Maintenance Notes**:
- Review quarterly for accuracy
- Update when adding new fields
- Version bump for breaking changes
- Keep import scripts synchronized