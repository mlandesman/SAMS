# SAMS API Endpoints by Domain Route

**Document Version:** 1.0  
**Last Updated:** October 12, 2025  
**Purpose:** Complete API reference for all endpoints used by SAMS frontend applications

---

## Table of Contents

1. [System Domain](#system-domain-system)
2. [Authentication Domain](#authentication-domain-apiauth--authuser)
3. [Water Domain](#water-domain-water)
4. [HOA Dues Domain](#hoa-dues-domain-hoadues)
5. [Client Domain](#client-domain-clients)
6. [Admin Domain](#admin-domain-admin)
7. [Communication Domain](#communication-domain-comm)
8. [Error Response Format](#error-response-format)
9. [Authentication Requirements](#authentication-requirements)

---

## System Domain (`/system/*`)
*Public endpoints - no authentication required*

### Exchange Rates
- **GET** `/system/exchange-rates/` - Get all exchange rate records
- **GET** `/system/exchange-rates/date/:date` - Get exchange rates for specific date
- **GET** `/system/exchange-rates/check` - Check if exchange rates exist for today
- **POST** `/system/exchange-rates/fetch` - Fetch and store exchange rates
- **POST** `/system/exchange-rates/fill-missing` - Fill missing exchange rates
- **POST** `/system/exchange-rates/daily-update` - Daily exchange rates update
- **POST** `/system/exchange-rates/manual-update` - Manual exchange rates update

### Version & Health
- **GET** `/system/version/` - Get version information
- **GET** `/system/version/health` - Health check with version info
- **GET** `/system/health` - System health check

**Return Structure:**
```json
{
  "status": "ok",
  "timestamp": "2025-07-15T12:00:00Z",
  "environment": "production",
  "version": "0.4.0",
  "build": "2025.07.15"
}
```

---

## Authentication Domain (`/api/auth/*` & `/auth/user/*`)
*Authentication and user management*

### Authentication
- **POST** `/api/auth/reset-password` - Reset password for forgotten password requests

**Request Body:**
```json
{
  "email": "user@example.com",
  "requestType": "forgot-password"
}
```

**Return Structure:**
```json
{
  "success": true,
  "message": "Temporary password has been sent to your email address",
  "email": "user@example.com"
}
```

### User Management
- **GET** `/auth/user/profile` - Get user profile with client access information
- **GET** `/auth/user/list` - Get all users (SuperAdmin only)
- **GET** `/auth/user/clients` - Get available clients for authenticated user
- **POST** `/auth/user/select-client` - Select a client for current session

**Return Structure (Profile):**
```json
{
  "user": {
    "id": "firebase-uid",
    "uid": "firebase-uid",
    "email": "user@example.com",
    "name": "John Doe",
    "globalRole": "admin",
    "propertyAccess": {
      "MTC": {
        "role": "admin",
        "unitId": "unit-101"
      }
    },
    "preferredClient": "MTC",
    "isActive": true,
    "accountState": "active",
    "createdAt": "2025-01-01T00:00:00Z",
    "lastLogin": "2025-07-15T12:00:00Z"
  }
}
```

---

## Water Domain (`/water/*`)
*Water billing and meter management*

### Data Aggregation
- **GET** `/water/clients/:clientId/data/:year?` - Get water data for year

**Return Structure:**
```json
{
  "success": true,
  "data": {
    "fiscalYear": 2025,
    "months": {
      "7": {
        "month": 7,
        "monthName": "July",
        "hasReadings": true,
        "hasBills": true,
        "totalConsumption": 145,
        "totalCharges": 725000,
        "totalPenalties": 36250,
        "totalPaid": 500000,
        "totalUnpaid": 261250,
        "units": {
          "unit-101": {
            "status": "paid",
            "transactionId": "txn-123",
            "payments": [...]
          }
        }
      }
    },
    "yearTotals": {
      "consumption": 1450,
      "charges": 7250000,
      "penalties": 362500,
      "paid": 5000000,
      "unpaid": 2612500
    }
  }
}
```

### Readings
- **GET** `/water/clients/:clientId/readings/:year/:month` - Get water meter readings
- **POST** `/water/clients/:clientId/readings/:year/:month` - Save water meter readings

**Request Body (POST):**
```json
{
  "readings": {
    "unit-101": {
      "currentReading": 1234,
      "previousReading": 1200,
      "consumption": 34,
      "readingDate": "2025-07-15T00:00:00Z",
      "notes": "Normal reading"
    }
  }
}
```

### Bills
- **POST** `/water/clients/:clientId/bills/generate` - Generate water bills
- **POST** `/water/clients/:clientId/bills/recalculate-penalties` - Recalculate penalties
- **GET** `/water/clients/:clientId/bills/penalty-summary` - Get penalty summary
- **GET** `/water/clients/:clientId/bills/unpaid/:unitId` - Get unpaid bills summary
- **GET** `/water/clients/:clientId/bills/:year/:month` - Get water bills for period

**Return Structure (Bills):**
```json
{
  "success": true,
  "data": {
    "bills": [
      {
        "id": "bill-123",
        "unitId": "unit-101",
        "unitNumber": "101",
        "baseAmount": 170000,
        "penaltyAmount": 8500,
        "totalAmount": 178500,
        "isPaid": false,
        "consumption": 34,
        "billDate": "2025-07-01T00:00:00Z",
        "dueDate": "2025-07-10T00:00:00Z"
      }
    ]
  }
}
```

### Payments
- **POST** `/water/clients/:clientId/payments/record` - Record water payment
- **GET** `/water/clients/:clientId/payments/history/:unitId` - Get payment history

**Request Body (Payment):**
```json
{
  "unitId": "unit-101",
  "paymentAmount": 500000,
  "paymentDate": "2025-07-15T00:00:00Z",
  "paymentMethod": "Bank Transfer",
  "referenceNumber": "REF123456",
  "selectedBills": ["bill-123", "bill-124"],
  "notes": "July payment"
}
```

### Configuration & Cache
- **GET** `/water/clients/:clientId/config` - Get billing configuration
- **POST** `/water/clients/:clientId/cache/clear` - Clear water cache
- **POST** `/water/clients/:clientId/cache/clear-all` - Clear all water cache

---

## HOA Dues Domain (`/hoadues/*`)
*HOA dues and assessments*

### Data Access
- **GET** `/hoadues/:clientId/debug/connection` - Debug Firestore connection
- **GET** `/hoadues/:clientId/year/:year` - Get all dues data for year
- **GET** `/hoadues/:clientId/unit/:unitId/:year` - Get dues data for specific unit

### Payments
- **POST** `/hoadues/:clientId/payment/:unitId/:year` - Record dues payment
- **PUT** `/hoadues/:clientId/credit/:unitId/:year` - Update credit balance

**Request Body (Payment):**
```json
{
  "paymentData": {
    "amount": 75000,
    "date": "2025-07-15T00:00:00Z",
    "method": "Credit Card",
    "referenceNumber": "HOA-REF-123",
    "notes": "Q3 2025 payment"
  },
  "distribution": [
    { "month": 7, "amount": 25000 },
    { "month": 8, "amount": 25000 },
    { "month": 9, "amount": 25000 }
  ]
}
```

**Return Structure:**
```json
{
  "success": true,
  "transaction": {
    "id": "txn-789",
    "amount": 75000,
    "timestamp": "2025-07-15T00:00:00Z"
  },
  "duesUpdated": {
    "payments": [25000, 25000, 25000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "unpaidBalance": 225000,
    "monthsBehind": 9
  },
  "creditBalance": 0
}
```

### Cross-Module Credit
- **GET** `/hoadues/:clientId/units/:unitId/credit-balance/:year` - Get credit balance for any module
- **PUT** `/hoadues/:clientId/units/:unitId/credit-balance/:year` - Update credit balance from any module

---

## Client Domain (`/clients/*`)
*Client-specific operations*

### Client Information
- **GET** `/clients/` - List authorized clients for authenticated user
- **GET** `/clients/:id` - Get specific client by ID

**Return Structure:**
```json
{
  "success": true,
  "client": {
    "id": "MTC",
    "name": "Marina Turquesa Condominiums",
    "timezone": "America/Cancun",
    "currency": "MXN",
    "fiscalYearStart": 7,
    "settings": {
      "waterBilling": {
        "enabled": true,
        "ratePerM3": 5000
      },
      "hoaDues": {
        "enabled": true,
        "defaultAmount": 25000
      }
    }
  }
}
```

### Transactions (`/clients/:clientId/transactions`)
- **GET** `/clients/:clientId/transactions` - List/query transactions
- **POST** `/clients/:clientId/transactions` - Create transaction
- **GET** `/clients/:clientId/transactions/:txnId` - Get transaction by ID
- **PUT** `/clients/:clientId/transactions/:txnId` - Update transaction
- **DELETE** `/clients/:clientId/transactions/:txnId` - Delete transaction

**Query Parameters (GET):**
- `category` - Filter by category
- `subcategory` - Filter by subcategory
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)
- `minAmount` - Minimum amount (in cents)
- `maxAmount` - Maximum amount (in cents)
- `method` - Payment method filter

**Return Structure:**
```json
{
  "transactions": [
    {
      "id": "txn-123",
      "date": "2025-07-15T00:00:00Z",
      "amount": 50000,
      "category": "water_payments",
      "subcategory": "consumption",
      "vendor": "Water Department",
      "description": "July water payment",
      "method": "Bank Transfer",
      "currency": "MXN",
      "clientId": "MTC"
    }
  ],
  "count": 1,
  "totalAmount": 50000
}
```

### Units (`/clients/:clientId/units`)
- **GET** `/clients/:clientId/units` - List all units
- **POST** `/clients/:clientId/units` - Create unit
- **PUT** `/clients/:clientId/units/:unitId` - Update unit
- **DELETE** `/clients/:clientId/units/:unitId` - Delete unit
- **PUT** `/clients/:clientId/units/:unitId/managers` - Update unit managers
- **POST** `/clients/:clientId/units/:unitId/emails` - Add email to unit
- **GET** `/clients/:clientId/units/user-access` - Get units accessible by current user

**Return Structure:**
```json
{
  "success": true,
  "units": [
    {
      "id": "unit-101",
      "unitNumber": "101",
      "owner": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "scheduledAmount": 25000,
      "creditBalance": 0,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Accounts (`/clients/:clientId/accounts`)
- **GET** `/clients/:clientId/accounts` - Get all accounts
- **POST** `/clients/:clientId/accounts` - Create account
- **PUT** `/clients/:clientId/accounts/:accountName` - Update account
- **DELETE** `/clients/:clientId/accounts/:accountName` - Delete account
- **PATCH** `/clients/:clientId/accounts/:accountName/balance` - Update account balance
- **PUT** `/clients/:clientId/accounts/:accountName/balance` - Set account balance
- **GET** `/clients/:clientId/accounts/year-end-snapshots` - List year-end snapshots
- **GET** `/clients/:clientId/accounts/year-end-snapshots/:year` - Get year-end snapshot
- **POST** `/clients/:clientId/accounts/year-end-snapshots/:year` - Create year-end snapshot
- **POST** `/clients/:clientId/accounts/rebuild` - Rebuild account balances

### Vendors (`/clients/:clientId/vendors`)
- **GET** `/clients/:clientId/vendors` - List vendors
- **POST** `/clients/:clientId/vendors` - Create vendor
- **PUT** `/clients/:clientId/vendors/:vendorId` - Update vendor
- **DELETE** `/clients/:clientId/vendors/:vendorId` - Delete vendor

### Categories (`/clients/:clientId/categories`)
- **GET** `/clients/:clientId/categories` - List categories
- **POST** `/clients/:clientId/categories` - Create category
- **PUT** `/clients/:clientId/categories/:categoryId` - Update category
- **DELETE** `/clients/:clientId/categories/:categoryId` - Delete category

### Payment Methods (`/clients/:clientId/paymentMethods`)
- **GET** `/clients/:clientId/paymentMethods` - List payment methods
- **POST** `/clients/:clientId/paymentMethods` - Create payment method
- **PUT** `/clients/:clientId/paymentMethods/:methodId` - Update payment method
- **DELETE** `/clients/:clientId/paymentMethods/:methodId` - Delete payment method

### Email (`/clients/:clientId/email`)
- **GET** `/clients/:clientId/email/config/:templateType?` - Get email configuration
- **POST** `/clients/:clientId/email/config/:configType?` - Set email configuration
- **POST** `/clients/:clientId/email/send-receipt` - Send receipt email
- **POST** `/clients/:clientId/email/test` - Test email configuration
- **POST** `/clients/:clientId/email/initialize` - Initialize default email config
- **POST** `/clients/:clientId/email/send-water-bill` - Send water bill email
- **POST** `/clients/:clientId/email/test-water-bill` - Test water bill email

### Reports (`/clients/:clientId/reports`)
- **GET** `/clients/:clientId/reports/unit/:unitId` - Get unit-specific financial report

**Return Structure:**
```json
{
  "unit": {
    "unitNumber": "101",
    "unitId": "unit-101",
    "owners": [{"name": "John Doe"}],
    "managers": [{"name": "Jane Smith"}]
  },
  "currentStatus": {
    "amountDue": 1500.00,
    "paidThrough": "June 2025",
    "creditBalance": 500.00,
    "ytdPaid": {
      "hoaDues": 15000.00,
      "projects": 0
    }
  },
  "paymentCalendar": {
    "1": {"paid": 2500, "date": "2025-01-15T00:00:00Z", "transactionId": "txn-123"},
    "2": {"paid": 2500, "date": "2025-02-15T00:00:00Z", "transactionId": "txn-124"}
  },
  "transactions": [
    {
      "id": "txn-123",
      "date": "2025-07-15T00:00:00Z",
      "amount": 2500,
      "description": "HOA Dues Payment",
      "category": "HOA Dues",
      "account": "Bank Account",
      "paymentMethod": "Bank Transfer"
    }
  ]
}
```

### Balances (`/clients/:clientId/balances`)
- **GET** `/clients/:clientId/balances/current` - Get current account balances
- **GET** `/clients/:clientId/balances/year-end/:year` - Get year-end balances
- **POST** `/clients/:clientId/balances/recalculate` - Recalculate balances
- **POST** `/clients/:clientId/balances/year-end-close/:year` - Create year-end snapshot

### Projects (`/clients/:clientId/projects`)
- **GET** `/clients/:clientId/projects/:projectType/:year/:month` - Get project data for period
- **POST** `/clients/:clientId/projects/:projectType/:year/:month/data` - Update project data
- **POST** `/clients/:clientId/projects/:projectType/:year/:month/payments` - Process project payment
- **GET** `/clients/:clientId/projects/:projectType/:year` - Get all project data for year
- **GET** `/clients/:clientId/projects/:projectType/config` - Get project configuration
- **POST** `/clients/:clientId/projects/:projectType/config` - Set project configuration
- **POST** `/clients/:clientId/projects/:projectType/:year/initialize` - Initialize project structure

### Configuration (`/clients/:clientId/config`)
- **GET** `/clients/:clientId/config/emailTemplates` - Get email templates
- **GET** `/clients/:clientId/config/:configDoc` - Get any config document

### Documents (`/clients/:clientId/documents`)
- **POST** `/clients/:clientId/documents/upload` - Upload document
- **GET** `/clients/:clientId/documents` - List documents
- **GET** `/clients/:clientId/documents/:documentId` - Get document
- **DELETE** `/clients/:clientId/documents/:documentId` - Delete document
- **PUT** `/clients/:clientId/documents/:documentId/metadata` - Update document metadata

---

## Admin Domain (`/admin/*`)
*Administrative functions*

### User Management
- **GET** `/admin/users` - Get all users
- **POST** `/admin/users` - Create new user
- **PUT** `/admin/users/:userId` - Update user profile and permissions
- **POST** `/admin/users/:userId/clients` - Add client access to user
- **DELETE** `/admin/users/:userId/clients/:clientId` - Remove client access from user
- **POST** `/admin/users/:userId/unit-roles` - Add unit role assignment
- **DELETE** `/admin/users/:userId/unit-roles` - Remove unit role assignment
- **DELETE** `/admin/users/:userId` - Delete user (SuperAdmin only)

### Client Management
- **GET** `/admin/onboarding/*` - Client onboarding routes
- **GET** `/admin/client-management/*` - Client management routes
- **GET** `/admin/import/*` - Data import/purge operations

### System Administration
- **GET** `/admin/stats` - Get system statistics
- **GET** `/admin/audit-logs` - Get audit logs
- **GET** `/admin/enable-unit-management` - Enable unit management for all clients
- **GET** `/admin/test-unit-management` - Test unit management configuration

---

## Communication Domain (`/comm/*`)
*Communication and email functionality*

### Email Communication
- **POST** `/comm/email/send` - Send email

**Request Body:**
```json
{
  "to": ["recipient@example.com"],
  "cc": [],
  "bcc": [],
  "subject": "HOA Payment Receipt",
  "body": "Payment confirmation...",
  "attachments": [
    {
      "filename": "receipt.pdf",
      "content": "base64-encoded-content",
      "contentType": "application/pdf"
    }
  ],
  "metadata": {
    "transactionId": "txn-123",
    "category": "receipts"
  }
}
```

---

## Error Response Format

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes:
- `UNAUTHORIZED` (401) - Missing or invalid authentication
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `VALIDATION_ERROR` (400) - Invalid request data
- `INVALID_JSON` (400) - Malformed JSON in request
- `CONFLICT` (409) - Resource conflict (duplicate)
- `SERVER_ERROR` (500) - Internal server error
- `RATE_LIMITED` (429) - Too many requests

---

## Authentication Requirements

All endpoints except those in the `/system/*` domain require:
- **Authorization Header**: `Bearer ${firebaseIdToken}`
- **Content-Type**: `application/json` (for POST/PUT requests)

The SAMS API uses domain-specific routing with comprehensive authentication and authorization middleware to ensure secure access to all client-specific data.

---

**Document End**  
*This document represents the complete API specification for SAMS APM v0.4 as of October 12, 2025*
