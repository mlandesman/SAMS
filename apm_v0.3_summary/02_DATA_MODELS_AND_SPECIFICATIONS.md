# SAMS Data Models and Field Specifications
*APM v0.3 Consolidated Documentation for v0.4 System*

## Overview

This document provides comprehensive field specifications and data models for all entities in the SAMS system. These specifications have been refined through production use and represent the finalized data structures that should be maintained in v0.4.

## Core Data Principles

### Universal Field Standards

1. **Monetary Values**: Always stored as integers in cents (e.g., $100.00 = 10000)
2. **Dates**: Firestore Timestamp objects, displayed in America/Cancun timezone
3. **IDs**: System-generated unique identifiers, with display names separate
4. **Audit Fields**: Every collection includes created, updated, and lastModifiedBy
5. **Soft Deletes**: deleted flag with deletedAt timestamp instead of physical deletion
6. **Email-Based User IDs**: User documents use email as ID for consistency

### Data Integrity Rules

1. **Referential Integrity**: Foreign keys validated before write
2. **Denormalization**: Name fields cached for performance (vendorName, categoryName)
3. **Validation**: All inputs validated at API layer before database write
4. **Consistency**: Batch operations for multi-document updates
5. **Atomicity**: Transaction support for critical operations

## User Model

### Collection: `/users/{emailBasedId}`

```javascript
{
  // Identity Fields
  email: string,                      // Primary identifier, used as document ID
  displayName: string,                 // User's full name for display
  uid: string,                        // Firebase Auth UID for authentication
  
  // Access Control
  role: "superAdmin" | "admin" | "user", // Global system role
  clientAccess: {                     // Client-specific permissions
    [clientId]: {
      role: "admin" | "owner" | "manager" | "viewer",
      permissions: string[],          // Specific permissions array
      unitAssignments: [              // For unit-specific access
        {
          unitId: string,
          role: "owner" | "manager",
          permissions: string[]
        }
      ],
      active: boolean,                // Can be disabled without deletion
      assignedBy: string,             // Email of admin who granted access
      assignedDate: Timestamp
    }
  },
  
  // Profile Information
  phone: string,                      // Contact phone number
  alternateEmail: string,             // Secondary email for notifications
  preferredLanguage: "en" | "es",     // Interface language preference
  timezone: string,                   // User's timezone (e.g., "America/Cancun")
  
  // Notification Preferences
  notifications: {
    email: {
      dailyDigest: boolean,
      transactionAlerts: boolean,
      paymentReminders: boolean,
      systemUpdates: boolean
    },
    push: {
      enabled: boolean,
      token: string                   // FCM token for push notifications
    }
  },
  
  // Session Management
  lastLogin: Timestamp,
  lastActivity: Timestamp,
  loginCount: number,
  sessions: [                         // Active sessions tracking
    {
      token: string,
      device: string,
      ip: string,
      created: Timestamp,
      lastUsed: Timestamp
    }
  ],
  
  // Metadata
  created: Timestamp,
  updated: Timestamp,
  createdBy: string,                  // Email of user who created account
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration Tracking
  migrationSource: string,             // Source system if migrated
  migrationDate: Timestamp,
  migrationId: string                  // Original ID from source system
}
```

### User Role Definitions

- **superAdmin**: Complete system access across all clients
- **admin**: Full access within assigned clients
- **owner**: Unit owner with limited access to own data
- **manager**: Unit manager with operational access
- **viewer**: Read-only access to permitted data

## Client Model

### Collection: `/clients/{clientId}`

```javascript
{
  // Identity
  id: string,                          // Unique client identifier
  name: string,                        // Client display name
  legalName: string,                   // Legal entity name
  type: "HOA" | "Condo" | "Commercial", // Property type
  
  // Branding
  logo: string,                        // URL to logo image
  primaryColor: string,                // Hex color for theming
  secondaryColor: string,              // Hex color for accents
  favicon: string,                     // URL to favicon
  
  // Configuration
  settings: {
    fiscalYearStartMonth: number,     // 1-12, month fiscal year begins
    timezone: string,                  // Client timezone (e.g., "America/Cancun")
    currency: "USD" | "MXN",          // Primary currency
    language: "en" | "es",            // Default language
    dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY",
    
    // Feature Flags
    features: {
      waterBilling: boolean,
      hoaDues: boolean,
      documentManagement: boolean,
      vendorPortal: boolean,
      ownerPortal: boolean,
      projects: boolean,
      budgeting: boolean,
      voting: boolean
    },
    
    // Financial Settings
    financial: {
      accountingMethod: "cash" | "accrual",
      taxRate: number,                // Percentage as decimal
      lateFeePercentage: number,      // Monthly late fee percentage
      gracePeriodDays: number,        // Days before late fees apply
      fiscalYearEndCloseDate: Date    // When books close for fiscal year
    },
    
    // Communication Settings
    communication: {
      fromEmail: string,
      replyToEmail: string,
      supportEmail: string,
      phoneNumber: string,
      address: {
        street: string,
        city: string,
        state: string,
        zip: string,
        country: string
      }
    }
  },
  
  // Statistics (cached for performance)
  stats: {
    totalUnits: number,
    activeUnits: number,
    totalOwners: number,
    totalTransactions: number,
    lastTransactionDate: Timestamp,
    totalBalance: number,              // In cents
    lastUpdated: Timestamp
  },
  
  // Subscription Information
  subscription: {
    plan: "basic" | "professional" | "enterprise",
    status: "active" | "suspended" | "cancelled",
    startDate: Timestamp,
    endDate: Timestamp,
    seats: number,                    // Number of user licenses
    features: string[]                // Additional feature codes
  },
  
  // Metadata
  created: Timestamp,
  updated: Timestamp,
  createdBy: string,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  migrationNotes: string
}
```

## Transaction Model

### Collection: `/clients/{clientId}/transactions/{transactionId}`

```javascript
{
  // Core Transaction Data
  id: string,                          // Unique transaction ID
  date: Timestamp,                     // Transaction date
  amount: number,                      // Amount in cents (always positive)
  type: "income" | "expense",         // Transaction type
  
  // References (with denormalized data for performance)
  vendorId: string,                    // Reference to vendor
  vendorName: string,                  // Cached vendor name
  categoryId: string,                  // Reference to category
  categoryName: string,                // Cached category name
  accountId: string,                   // Reference to account
  accountName: string,                 // Cached account name
  
  // Description and Details
  description: string,                 // Transaction description
  reference: string,                   // Check number, invoice #, etc.
  notes: string,                       // Additional notes
  tags: string[],                      // Searchable tags
  
  // Payment Information
  paymentMethod: "cash" | "check" | "transfer" | "card" | "other",
  checkNumber: string,                 // If payment method is check
  
  // HOA Dues Integration (if applicable)
  hoaDues: {
    unitId: string,
    unitNumber: string,
    year: number,
    months: number[],                  // Array of month numbers paid
    creditApplied: number,             // Amount from credit balance
    penalties: number,                 // Late fees included
    principalAmount: number            // Base dues amount
  },
  
  // Water Bills Integration (if applicable)
  waterBill: {
    unitId: string,
    meterId: string,
    period: string,                    // YYYY-MM format
    consumption: number,               // Cubic meters
    previousReading: number,
    currentReading: number,
    rate: number,                      // Rate per cubic meter
    penalties: number
  },
  
  // Multi-Currency Support
  currency: "USD" | "MXN",
  exchangeRate: number,                // Rate if converted
  originalAmount: number,              // Amount in original currency
  originalCurrency: string,
  
  // Document Attachments
  attachments: [
    {
      id: string,
      name: string,
      url: string,
      type: string,                    // MIME type
      size: number,                    // Bytes
      uploadedAt: Timestamp,
      uploadedBy: string
    }
  ],
  
  // Reconciliation
  reconciled: boolean,
  reconciledDate: Timestamp,
  reconciledBy: string,
  statementDate: Timestamp,            // Bank statement date
  
  // Approval Workflow (if enabled)
  approval: {
    required: boolean,
    status: "pending" | "approved" | "rejected",
    requestedBy: string,
    requestedDate: Timestamp,
    approvedBy: string,
    approvedDate: Timestamp,
    rejectedBy: string,
    rejectedDate: Timestamp,
    rejectionReason: string
  },
  
  // Recurring Transaction Support
  recurring: {
    enabled: boolean,
    frequency: "monthly" | "quarterly" | "annually",
    endDate: Timestamp,
    nextDate: Timestamp,
    parentId: string                   // Original transaction ID
  },
  
  // Audit Trail
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  migrationBatchId: string,
  originalId: string                   // ID from source system
}
```

## Unit Model

### Collection: `/clients/{clientId}/units/{unitId}`

```javascript
{
  // Identity
  id: string,                          // System-generated unique ID
  unitNumber: string,                  // Display unit number (e.g., "105")
  displayName: string,                 // Full display name (e.g., "Unit 105")
  building: string,                    // Building identifier if applicable
  floor: number,                       // Floor number
  
  // Ownership Information
  ownershipType: "individual" | "business" | "trust" | "estate",
  ownerName: string,                   // Primary owner name
  ownerEmail: string,                  // Primary owner email
  ownerPhone: string,                  // Primary owner phone
  
  // Business/Trust Details (if applicable)
  businessName: string,                // If ownershipType is business
  taxId: string,                       // RFC or tax ID
  trustName: string,                   // If ownershipType is trust
  trustee: string,                     // Trustee name
  
  // Authorized Users
  authorizedUsers: [                   // Users with access to this unit
    {
      userId: string,                  // Email-based user ID
      name: string,
      role: "owner" | "manager" | "tenant",
      permissions: string[],           // Specific permissions
      startDate: Timestamp,
      endDate: Timestamp,              // For temporary access
      addedBy: string,
      addedDate: Timestamp
    }
  ],
  
  // Property Details
  size: {
    value: number,
    unit: "sqft" | "sqm"              // Square feet or meters
  },
  bedrooms: number,
  bathrooms: number,
  parkingSpaces: number,
  storageUnit: string,                 // Storage unit number if applicable
  
  // HOA Information
  hoaDues: {
    amount: number,                    // Monthly dues in cents
    frequency: "monthly" | "quarterly" | "annually",
    startDate: Timestamp,              // When dues began
    specialAssessment: number,         // Any special assessment
    creditBalance: number,             // Prepaid amount
    lastPaymentDate: Timestamp,
    nextDueDate: Timestamp,
    autopay: boolean,
    autopayMethod: string              // Payment method for autopay
  },
  
  // Occupancy Status
  occupancyStatus: "owner" | "rented" | "vacant" | "sale",
  tenant: {                            // If rented
    name: string,
    email: string,
    phone: string,
    leaseStart: Timestamp,
    leaseEnd: Timestamp,
    monthlyRent: number,               // In cents
    securityDeposit: number,           // In cents
    emergencyContact: {
      name: string,
      phone: string,
      relationship: string
    }
  },
  
  // Water Meter Assignment (if applicable)
  waterMeters: [
    {
      meterId: string,
      meterNumber: string,
      location: string,
      activeFrom: Timestamp,
      activeTo: Timestamp
    }
  ],
  
  // Contact Preferences
  contactPreferences: {
    primaryContact: "owner" | "manager" | "tenant",
    language: "en" | "es",
    communicationMethod: "email" | "phone" | "whatsapp",
    doNotContact: boolean,
    notes: string
  },
  
  // Emergency Information
  emergency: {
    contact: {
      name: string,
      phone: string,
      relationship: string
    },
    medicalNotes: string,
    specialNeeds: string,
    keyHolder: {
      name: string,
      phone: string
    }
  },
  
  // Voting Rights
  voting: {
    eligible: boolean,
    weight: number,                    // Voting weight if not equal
    proxy: string,                     // Email of proxy voter
    restrictions: string               // Any voting restrictions
  },
  
  // Maintenance History
  maintenanceNotes: string,
  lastInspection: Timestamp,
  nextInspection: Timestamp,
  issues: [
    {
      id: string,
      date: Timestamp,
      description: string,
      status: "open" | "inProgress" | "resolved",
      priority: "low" | "medium" | "high",
      assignedTo: string,
      resolvedDate: Timestamp,
      cost: number                     // In cents
    }
  ],
  
  // Documents
  documents: [                         // References to important docs
    {
      type: "deed" | "lease" | "insurance" | "other",
      documentId: string,
      name: string,
      uploadDate: Timestamp,
      expiryDate: Timestamp
    }
  ],
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string,
  migrationNotes: string
}
```

## Vendor Model

### Collection: `/clients/{clientId}/vendors/{vendorId}`

```javascript
{
  // Identity
  id: string,                          // System-generated ID
  name: string,                        // Vendor display name
  legalName: string,                   // Legal business name
  type: "vendor" | "contractor" | "utility" | "government" | "other",
  category: string,                    // Business category
  
  // Contact Information
  contact: {
    primaryName: string,               // Primary contact person
    primaryEmail: string,
    primaryPhone: string,
    secondaryName: string,
    secondaryEmail: string,
    secondaryPhone: string,
    website: string,
    address: {
      street: string,
      city: string,
      state: string,
      zip: string,
      country: string
    }
  },
  
  // Business Information
  taxId: string,                       // RFC or tax ID
  businessLicense: string,
  insurance: {
    carrier: string,
    policyNumber: string,
    expirationDate: Timestamp,
    coverageAmount: number             // In cents
  },
  
  // Banking Information (encrypted)
  banking: {
    accountName: string,
    bankName: string,
    accountNumber: string,              // Encrypted
    routingNumber: string,              // Encrypted
    accountType: "checking" | "savings",
    swift: string,                      // For international
    iban: string                        // For international
  },
  
  // Payment Terms
  paymentTerms: {
    method: "check" | "transfer" | "cash" | "card",
    terms: "immediate" | "net15" | "net30" | "net60",
    currency: "USD" | "MXN",
    requiresPO: boolean,                // Requires purchase order
    requiresInvoice: boolean,
    minimumOrder: number,               // Minimum order amount in cents
    discountPercentage: number,         // Early payment discount
    lateFeePercentage: number           // Late payment penalty
  },
  
  // Service Information
  services: [                          // Services provided
    {
      name: string,
      description: string,
      rate: number,                    // In cents
      rateType: "hourly" | "fixed" | "project",
      category: string
    }
  ],
  
  // Contract Information
  contracts: [
    {
      id: string,
      name: string,
      startDate: Timestamp,
      endDate: Timestamp,
      value: number,                   // Total contract value in cents
      status: "active" | "expired" | "cancelled",
      autoRenew: boolean,
      documentId: string                // Reference to contract document
    }
  ],
  
  // Performance Metrics
  metrics: {
    totalSpent: number,                // Total paid to vendor in cents
    transactionCount: number,
    averageAmount: number,              // Average transaction in cents
    lastTransactionDate: Timestamp,
    rating: number,                     // 1-5 rating
    onTimeDelivery: number,            // Percentage
    qualityScore: number,              // Percentage
    disputes: number                    // Number of disputes
  },
  
  // Compliance
  compliance: {
    w9OnFile: boolean,
    w9Date: Timestamp,
    insuranceOnFile: boolean,
    insuranceExpiry: Timestamp,
    licenseOnFile: boolean,
    licenseExpiry: Timestamp,
    backgroundCheck: boolean,
    backgroundCheckDate: Timestamp
  },
  
  // Notes and Tags
  notes: string,                       // General notes
  tags: string[],                      // Searchable tags
  preferredVendor: boolean,            // Preferred vendor flag
  blacklisted: boolean,                // Do not use flag
  blacklistReason: string,
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string
}
```

## Category Model

### Collection: `/clients/{clientId}/categories/{categoryId}`

```javascript
{
  // Identity
  id: string,                          // System-generated ID
  name: string,                        // Category name
  displayName: string,                 // Display name with hierarchy
  code: string,                        // Accounting code
  
  // Hierarchy
  parent: string,                      // Parent category ID for subcategories
  path: string[],                      // Full path of category IDs
  level: number,                       // Nesting level (0 for root)
  order: number,                       // Display order within parent
  
  // Type and Usage
  type: "income" | "expense" | "both", // Transaction types allowed
  subtype: string,                     // Further classification
  
  // Accounting Integration
  accounting: {
    glCode: string,                    // General ledger code
    taxCategory: string,               // Tax category
    taxDeductible: boolean,            // Tax deductible flag
    depreciable: boolean,              // Can be depreciated
    depreciationYears: number          // Depreciation period
  },
  
  // Budget Information
  budget: {
    annual: number,                    // Annual budget in cents
    monthly: number,                   // Monthly budget in cents
    quarterly: number,                 // Quarterly budget in cents
    alertThreshold: number,            // Percentage to trigger alert
    requiresApproval: boolean,         // Requires approval for transactions
    approvalThreshold: number          // Amount requiring approval
  },
  
  // Rules and Validations
  rules: {
    requiresVendor: boolean,           // Vendor required for transactions
    requiresReceipt: boolean,          // Receipt required
    requiresApproval: boolean,         // Approval required
    requiresProject: boolean,          // Must be linked to project
    allowedPaymentMethods: string[],   // Allowed payment methods
    maxAmount: number,                 // Maximum transaction amount
    minAmount: number                  // Minimum transaction amount
  },
  
  // Statistics (cached)
  stats: {
    currentMonthTotal: number,         // Current month spending
    currentYearTotal: number,          // Current year total
    lastMonthTotal: number,            // Last month total
    lastYearTotal: number,             // Last year total
    transactionCount: number,          // Total transactions
    averageAmount: number,             // Average transaction amount
    lastUpdated: Timestamp
  },
  
  // Display Settings
  display: {
    icon: string,                      // Icon name or URL
    color: string,                     // Hex color for UI
    description: string,               // Category description
    hidden: boolean,                   // Hide from selection lists
    inactive: boolean                  // Inactive but keep for history
  },
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string
}
```

## Account Model

### Collection: `/clients/{clientId}/accounts/{accountId}`

```javascript
{
  // Identity
  id: string,                          // System-generated ID
  name: string,                        // Account name
  displayName: string,                 // Display name
  accountNumber: string,               // Bank account number (partial)
  
  // Account Type
  type: "bank" | "cash" | "investment" | "credit" | "loan",
  subtype: string,                     // Checking, savings, etc.
  currency: "USD" | "MXN",
  
  // Bank Information
  bank: {
    name: string,                      // Bank name
    branch: string,                    // Branch name/number
    routingNumber: string,             // Routing number (encrypted)
    swift: string,                     // SWIFT code
    address: {
      street: string,
      city: string,
      state: string,
      zip: string,
      country: string
    }
  },
  
  // Balance Information
  balance: {
    current: number,                   // Current balance in cents
    available: number,                 // Available balance
    pending: number,                   // Pending transactions
    lastUpdated: Timestamp,
    lastReconciled: Timestamp,
    reconciledBalance: number,        // Balance at last reconciliation
    
    // Historical Snapshots
    snapshots: [
      {
        date: Timestamp,
        balance: number,
        type: "daily" | "monthly" | "yearEnd",
        reconciled: boolean
      }
    ]
  },
  
  // Interest and Fees
  financial: {
    interestRate: number,              // Annual interest rate
    interestType: "simple" | "compound",
    minimumBalance: number,            // Minimum balance requirement
    monthlyFee: number,                // Monthly maintenance fee
    overdraftLimit: number,            // Overdraft limit
    overdraftFee: number               // Overdraft fee
  },
  
  // Transaction Limits
  limits: {
    dailyLimit: number,                // Daily transaction limit
    monthlyLimit: number,              // Monthly transaction limit
    transactionLimit: number,          // Per transaction limit
    requiresDualApproval: number       // Amount requiring dual approval
  },
  
  // Signatories
  signatories: [
    {
      name: string,
      email: string,
      role: "primary" | "secondary" | "viewer",
      canApprove: boolean,
      approvalLimit: number,           // Individual approval limit
      addedDate: Timestamp,
      addedBy: string
    }
  ],
  
  // Integration
  integration: {
    syncEnabled: boolean,              // Bank sync enabled
    connectionId: string,              // Plaid/Yodlee connection ID
    lastSync: Timestamp,
    syncStatus: "active" | "error" | "paused",
    syncError: string
  },
  
  // Reconciliation
  reconciliation: {
    lastDate: Timestamp,
    lastBy: string,
    frequency: "daily" | "weekly" | "monthly",
    nextDue: Timestamp,
    autoReconcile: boolean,
    tolerance: number                  // Acceptable difference in cents
  },
  
  // Statistics
  stats: {
    monthlyIncome: number,             // Average monthly income
    monthlyExpense: number,            // Average monthly expense
    transactionCount: number,
    lastTransactionDate: Timestamp,
    largestTransaction: number,
    smallestTransaction: number
  },
  
  // Settings
  settings: {
    primaryAccount: boolean,           // Primary operating account
    defaultForExpenses: boolean,       // Default for expense transactions
    defaultForIncome: boolean,         // Default for income transactions
    requiresReceipt: boolean,          // All transactions need receipts
    alertLowBalance: number,           // Alert when below this amount
    alertHighBalance: number           // Alert when above this amount
  },
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  closedDate: Timestamp,               // When account was closed
  closedReason: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string
}
```

## HOA Dues Model

### Collection: `/clients/{clientId}/units/{unitId}/dues/{year}`

```javascript
{
  // Identity
  unitId: string,                      // Parent unit ID
  unitNumber: string,                  // Cached unit number
  year: number,                        // Year for these dues
  
  // Payment Configuration
  config: {
    monthlyAmount: number,             // Monthly dues amount in cents
    frequency: "monthly" | "quarterly" | "annually",
    specialAssessment: number,         // Special assessment for year
    specialAssessmentMonths: number[], // Months to apply special assessment
    startMonth: number,                // First month of dues (1-12)
    endMonth: number                   // Last month of dues (1-12)
  },
  
  // Monthly Payment Tracking
  months: {
    [month: number]: {                // 1-12 for each month
      dueAmount: number,               // Amount due for month
      paidAmount: number,              // Amount paid
      paidDate: Timestamp,             // When payment was made
      paymentMethod: string,           // How payment was made
      transactionId: string,           // Link to transaction record
      
      // Late Fees
      lateFee: number,                 // Late fee amount
      lateFeeDate: Timestamp,          // When late fee applied
      daysLate: number,                // Days past due
      
      // Credits and Adjustments
      creditApplied: number,           // Credit balance used
      adjustment: number,              // Manual adjustment
      adjustmentReason: string,        // Reason for adjustment
      adjustmentBy: string,            // Who made adjustment
      adjustmentDate: Timestamp,
      
      // Status
      status: "pending" | "paid" | "partial" | "late" | "waived",
      notes: string
    }
  },
  
  // Quarterly Summaries (if quarterly payments)
  quarters: {
    Q1: {
      dueAmount: number,
      paidAmount: number,
      status: string,
      paidDate: Timestamp
    },
    Q2: { /* same structure */ },
    Q3: { /* same structure */ },
    Q4: { /* same structure */ }
  },
  
  // Annual Summary
  summary: {
    totalDue: number,                  // Total amount due for year
    totalPaid: number,                 // Total amount paid
    totalLateFees: number,             // Total late fees
    totalCreditsApplied: number,       // Total credits used
    totalAdjustments: number,          // Total adjustments
    balance: number,                   // Outstanding balance
    
    // Payment Statistics
    onTimePayments: number,            // Number of on-time payments
    latePayments: number,              // Number of late payments
    missedPayments: number,            // Number of missed payments
    averageDaysLate: number,           // Average days late
    
    // Status
    status: "current" | "delinquent" | "paid" | "writeOff",
    lastPaymentDate: Timestamp,
    nextDueDate: Timestamp
  },
  
  // Credit Balance Management
  creditBalance: {
    startingBalance: number,           // Credit at year start
    additions: [
      {
        amount: number,
        date: Timestamp,
        source: string,                // Source of credit
        transactionId: string
      }
    ],
    usage: [
      {
        amount: number,
        date: Timestamp,
        month: number,                 // Month applied to
        transactionId: string
      }
    ],
    endingBalance: number              // Credit at year end
  },
  
  // Payment Plans (if applicable)
  paymentPlan: {
    active: boolean,
    startDate: Timestamp,
    endDate: Timestamp,
    monthlyAmount: number,
    totalAmount: number,
    paidAmount: number,
    missedPayments: number,
    status: "active" | "completed" | "defaulted",
    notes: string
  },
  
  // Legal Actions
  legal: {
    lienFiled: boolean,
    lienDate: Timestamp,
    lienAmount: number,
    lienNumber: string,
    collectionAgency: string,
    collectionDate: Timestamp,
    attorneyInvolved: boolean,
    legalNotes: string
  },
  
  // Audit Trail
  history: [
    {
      date: Timestamp,
      action: string,
      month: number,
      amount: number,
      by: string,
      notes: string
    }
  ],
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalData: object                 // Original data structure if migrated
}
```

## Water Bill Model (AVII Implementation)

### Collection: `/clients/{clientId}/projects/waterBills/`

The water bills implementation uses a project-based structure with three main subcollections: bills, meters, and readings.

#### Water Meter Reading
Path: `/clients/{clientId}/projects/waterBills/readings/{readingId}`

```javascript
{
  // Identity (from screenshots: readings are stored by year-month like "2026-01")
  month: number,                       // Month number (1-12)
  year: number,                        // Year (e.g., 2026)
  timestamp: string,                   // ISO timestamp when recorded
  
  // Readings by unit (nested object with unit numbers as keys)
  reading: {
    "101": number,                     // Reading for unit 101 (e.g., 1774)
    "102": number,                     // Reading for unit 102 (e.g., 30)
    "103": number,                     // Reading for unit 103 (e.g., 850)
    "104": number,                     // Reading for unit 104 (e.g., 1497)
    "105": number,                     // Reading for unit 105 (e.g., 850)
    "106": number,                     // Reading for unit 106 (e.g., 1362)
    "201": number,                     // Reading for unit 201 (e.g., 1084)
    "202": number,                     // Reading for unit 202 (e.g., 330)
    "203": number,                     // Reading for unit 203 (e.g., 1433)
    "204": number,                     // Reading for unit 204 (e.g., 1824)
    // ... additional units as needed
  },
  
  // Additional metadata
  buildingMeter: number,               // Building master meter reading if applicable
  commonArea: number                   // Common area meter reading if applicable
}
```

#### Water Bill
Path: `/clients/{clientId}/projects/waterBills/bills/{billId}`

```javascript
{
  // Identity (from screenshot: billId format like "2025-09-07T22:16:08.212Z")
  billDate: string,                    // Bill generation date identifier
  billingPeriod: string,               // e.g., "July 2025"
  
  // Associated Units and Bills (array of unit bills)
  bills: [
    {
      units: number,                  // Unit number (e.g., 101, 102)
      basePaid: boolean,              // Base charge paid status (NaN shown if not applicable)
      consumption: number,             // Cubic meters consumed
      currentCharge: number,           // Current month charge in cents
      currentReading: number,          // Current meter reading
      lastPayment: number,             // Last payment amount in cents
      amount: number,                  // Total amount due in cents
      baseChargePaid: boolean,         // Whether base charge is paid (NaN if not applicable)
      paymentDate: string,             // Payment date (e.g., "2025-07-07")
      paymentMethod: string,           // Payment method (e.g., "eftransfer")
      penaltyPaid: number,             // Penalty amount paid
      receivedAt: string,              // When payment was received
      reference: string,               // Payment reference
      transactionId: string,           // Linked transaction ID
      lastPenaltyUpdate: string,       // Last penalty calculation date
      paidAmount: number,              // Amount paid in cents
      penaltyAmount: number,           // Penalty amount in cents
      penaltyPaid: number,             // Penalty paid amount
      priorReading: number,            // Previous meter reading
      status: string,                  // Payment status (e.g., "paid")
      totalAmount: number              // Total amount including penalties
    }
  ]
}
```

#### Water Meter Configuration
Path: `/clients/{clientId}/projects/waterBills/meters/{meterId}`

```javascript
{
  // Identity
  id: string,                          // Meter ID
  meterNumber: string,                 // Physical meter number
  unitId: string,                      // Associated unit
  unitNumber: string,                  // Cached unit number
  
  // Configuration
  active: boolean,                     // Whether meter is active
  installDate: Timestamp,              // When meter was installed
  lastReadingDate: Timestamp,          // Last reading date
  lastReading: number,                 // Last reading value
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string
}
```

### Water Bills Implementation Notes

1. **NO Tiered Rates**: Simple flat rate of 50 MXN per cubic meter
2. **Project-Based Structure**: Bills stored under `/projects/waterBills/` with subcollections
3. **Fiscal Year Based**: AVII uses July-June fiscal year (year named by ending year)
4. **Compound Penalties**: 5% monthly compound interest after 10-day grace period
5. **Integration**: Payments create transactions with proper cross-references
6. **Domain-Specific APIs**: Uses `/water/` routes for clean URL structure instead of traditional REST

## Document Model

### Collection: `/clients/{clientId}/documents/{documentId}`

```javascript
{
  // Identity
  id: string,                          // System-generated ID
  name: string,                        // Document name
  displayName: string,                 // Display name
  
  // File Information
  file: {
    originalName: string,              // Original filename
    mimeType: string,                  // MIME type
    size: number,                      // Size in bytes
    extension: string,                 // File extension
    url: string,                       // Firebase Storage URL
    thumbnailUrl: string,              // Thumbnail for images/PDFs
    checksum: string                   // MD5 or SHA hash
  },
  
  // Document Classification
  type: "invoice" | "receipt" | "contract" | "report" | "correspondence" | "legal" | "financial" | "other",
  category: string,                    // User-defined category
  tags: string[],                      // Searchable tags
  
  // Linked Entities
  linkedEntities: [
    {
      type: "transaction" | "unit" | "vendor" | "project" | "user",
      id: string,
      name: string,                    // Cached name
      linkedDate: Timestamp,
      linkedBy: string
    }
  ],
  
  // Version Control
  version: {
    number: number,                    // Version number
    previousVersionId: string,         // Previous version document ID
    changes: string,                   // Description of changes
    versionDate: Timestamp,
    versionedBy: string
  },
  
  // Document Metadata
  metadata: {
    title: string,
    description: string,
    author: string,
    documentDate: Timestamp,           // Date of document (not upload)
    expiryDate: Timestamp,             // When document expires
    confidential: boolean,
    keywords: string[]
  },
  
  // Access Control
  access: {
    public: boolean,                   // Publicly accessible
    sharedWith: [                      // Specific users with access
      {
        userId: string,
        name: string,
        permission: "view" | "edit" | "delete",
        sharedDate: Timestamp,
        sharedBy: string,
        expiryDate: Timestamp          // When access expires
      }
    ],
    requiresApproval: boolean,         // Requires approval to view
    approvedBy: string,
    approvalDate: Timestamp
  },
  
  // Processing Status
  processing: {
    status: "pending" | "processing" | "completed" | "failed",
    ocrProcessed: boolean,             // OCR text extraction done
    extractedText: string,             // OCR extracted text
    thumbnailGenerated: boolean,
    virusScan: {
      scanned: boolean,
      scanDate: Timestamp,
      clean: boolean,
      threat: string
    }
  },
  
  // Retention Policy
  retention: {
    policy: "permanent" | "years" | "months" | "days",
    duration: number,                  // Duration based on policy
    deleteAfter: Timestamp,            // Calculated deletion date
    legalHold: boolean,                // Prevent deletion
    archived: boolean,
    archivedDate: Timestamp
  },
  
  // Audit Trail
  auditLog: [
    {
      action: "upload" | "view" | "download" | "edit" | "share" | "delete",
      date: Timestamp,
      by: string,
      ip: string,
      details: string
    }
  ],
  
  // Statistics
  stats: {
    views: number,
    downloads: number,
    lastViewed: Timestamp,
    lastViewedBy: string,
    lastDownloaded: Timestamp,
    lastDownloadedBy: string
  },
  
  // Metadata
  uploaded: Timestamp,
  uploadedBy: string,
  updated: Timestamp,
  lastModifiedBy: string,
  deleted: boolean,
  deletedAt: Timestamp,
  deletedBy: string,
  
  // Migration
  migrationSource: string,
  migrationDate: Timestamp,
  originalId: string
}
```

## Exchange Rate Model

### Collection: `/clients/{clientId}/config/exchangeRates/{date}`

```javascript
{
  // Identity
  date: string,                        // YYYY-MM-DD format as document ID
  timestamp: Timestamp,                // Full timestamp
  
  // Rate Information
  rates: {
    USD_to_MXN: number,               // USD to MXN rate
    MXN_to_USD: number,               // MXN to USD rate (1/USD_to_MXN)
    
    // Additional Rates (if needed)
    EUR_to_MXN: number,
    EUR_to_USD: number,
    CAD_to_MXN: number,
    CAD_to_USD: number
  },
  
  // Source Information
  source: {
    provider: "banxico" | "manual" | "api",
    url: string,                      // Source URL if applicable
    fetchedAt: Timestamp,
    rawData: object                   // Original API response
  },
  
  // Rate Types
  rateTypes: {
    official: number,                  // Official bank rate
    buy: number,                       // Bank buying rate
    sell: number,                      // Bank selling rate
    average: number                    // Average of buy/sell
  },
  
  // Historical Context
  historical: {
    previousRate: number,              // Previous day's rate
    change: number,                    // Change from previous
    changePercent: number,             // Percentage change
    weekAverage: number,               // 7-day average
    monthAverage: number,              // 30-day average
    yearHigh: number,                  // 52-week high
    yearLow: number                    // 52-week low
  },
  
  // Validation
  validation: {
    valid: boolean,
    reasonableRange: boolean,          // Within expected range
    manualOverride: boolean,
    overrideReason: string,
    overrideBy: string,
    overrideDate: Timestamp
  },
  
  // Usage Statistics
  usage: {
    transactionCount: number,          // Transactions using this rate
    totalConverted: number,            // Total amount converted
    lastUsed: Timestamp
  },
  
  // Metadata
  created: Timestamp,
  createdBy: string,
  updated: Timestamp,
  lastModifiedBy: string
}
```

## Audit Log Model

### Collection: `/clients/{clientId}/auditLogs/{logId}`

```javascript
{
  // Identity
  id: string,                          // Unique log ID
  timestamp: Timestamp,                // When action occurred
  
  // Actor Information
  actor: {
    userId: string,                    // User who performed action
    email: string,
    name: string,
    role: string,
    ip: string,                        // IP address
    userAgent: string,                 // Browser/device info
    sessionId: string                  // Session identifier
  },
  
  // Action Details
  action: {
    type: "create" | "read" | "update" | "delete" | "login" | "logout" | "export" | "import",
    category: "transaction" | "user" | "unit" | "vendor" | "document" | "system",
    description: string,               // Human-readable description
    method: string,                    // HTTP method if applicable
    endpoint: string                   // API endpoint if applicable
  },
  
  // Target Entity
  target: {
    type: string,                      // Entity type
    id: string,                        // Entity ID
    name: string,                      // Entity name/description
    collection: string,                // Firestore collection
    path: string                       // Full document path
  },
  
  // Changes Made
  changes: {
    before: object,                    // State before change
    after: object,                     // State after change
    fields: string[],                  // Changed field names
    summary: string                    // Summary of changes
  },
  
  // Result
  result: {
    success: boolean,
    errorCode: string,
    errorMessage: string,
    duration: number                   // Operation duration in ms
  },
  
  // Context
  context: {
    clientId: string,
    environment: "development" | "staging" | "production",
    version: string,                   // Application version
    feature: string,                   // Feature flag if applicable
    metadata: object                   // Additional context
  },
  
  // Security
  security: {
    authenticated: boolean,
    authorized: boolean,
    suspicious: boolean,               // Flagged as suspicious
    riskScore: number,                // Risk assessment score
    alerts: string[]                  // Security alerts triggered
  },
  
  // Metadata
  created: Timestamp,
  indexed: boolean,                   // Whether indexed for search
  retained: boolean,                  // Whether to retain long-term
  expiresAt: Timestamp               // When to auto-delete
}
```

## Data Validation Rules

### Universal Validation Rules

1. **Required Fields**: All entities must have id, created, createdBy
2. **Email Format**: All email fields validated against RFC 5322
3. **Phone Format**: Support international formats with country code
4. **Amount Fields**: Must be non-negative integers (cents)
5. **Date Fields**: Must be valid Firestore Timestamps
6. **String Length**: Max 500 chars unless specified otherwise
7. **Array Limits**: Max 100 items unless specified otherwise

### Field-Specific Validations

```javascript
// Transaction Validations
- amount: Required, > 0, <= 999999999 (max $9,999,999.99)
- type: Required, must be "income" or "expense"
- date: Required, cannot be future date
- vendorId: Required for expenses
- categoryId: Required

// Unit Validations
- unitNumber: Required, unique within client
- hoaDuesAmount: >= 0
- authorizedUsers: At least one required

// User Validations
- email: Required, valid format, unique
- role: Required, valid role value
- displayName: Required, 2-100 characters

// Vendor Validations
- name: Required, unique within client
- taxId: Format validation based on country

// Document Validations
- file.size: Max 50MB
- file.mimeType: Must be allowed type
- linkedEntities: At least one required
```

## Migration Considerations

### Data Migration Rules

1. **Preserve Original IDs**: Store in originalId field
2. **Track Migration Source**: Always populate migrationSource
3. **Maintain Audit Trail**: Set migrationDate and migrationBatchId
4. **Validate After Import**: Run validation scripts post-migration
5. **Handle Missing Data**: Use sensible defaults for required fields

### Legacy Data Mapping

```javascript
// Common field mappings from legacy systems
{
  // Legacy → SAMS mapping
  "client_id" → "clientId",
  "trans_date" → "date",
  "trans_amount" → "amount",
  "vendor_name" → "vendorName + vendorId lookup",
  "category" → "categoryName + categoryId lookup",
  "check_num" → "checkNumber",
  "memo" → "description",
  "created_on" → "created",
  "modified_on" → "updated"
}
```

## Performance Indexes

### Required Firestore Indexes

```
// Composite Indexes
transactions: [clientId, date DESC]
transactions: [clientId, type, date DESC]
transactions: [clientId, vendorId, date DESC]
transactions: [clientId, categoryId, date DESC]
transactions: [clientId, accountId, date DESC]

units: [clientId, deleted, unitNumber]
units: [clientId, occupancyStatus]

vendors: [clientId, deleted, name]
vendors: [clientId, type, name]

documents: [clientId, type, uploaded DESC]
documents: [clientId, linkedEntities.type, linkedEntities.id]

auditLogs: [clientId, timestamp DESC]
auditLogs: [clientId, actor.userId, timestamp DESC]
auditLogs: [clientId, action.type, timestamp DESC]
```

This comprehensive data model documentation provides the complete field specifications and relationships needed for the v0.4 system to maintain and extend the SAMS platform.