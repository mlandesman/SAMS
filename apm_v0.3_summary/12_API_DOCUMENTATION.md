# API Documentation
## SAMS APM v0.4

**Document Version:** 1.0  
**Last Updated:** 2025-09-09  
**Purpose:** Complete API reference for all endpoints used by SAMS frontend applications

---

## Table of Contents

1. [Authentication & Headers](#1-authentication--headers)
2. [Water Management APIs](#2-water-management-apis)
3. [HOA Dues APIs](#3-hoa-dues-apis)
4. [Transaction Management APIs](#4-transaction-management-apis)
5. [Unit Management APIs](#5-unit-management-apis)
6. [Client Management APIs](#6-client-management-apis)
7. [Document Management APIs](#7-document-management-apis)
8. [System APIs](#8-system-apis)
9. [Email APIs](#9-email-apis)
10. [Error Responses](#10-error-responses)

---

## 1. Authentication & Headers

### Required Headers

All API requests (except public system endpoints) require:

```javascript
{
  'Authorization': `Bearer ${firebaseIdToken}`,
  'Content-Type': 'application/json'
}
```

### Firebase Token Generation

```javascript
// Frontend: /frontend/sams-ui/src/firebaseClient.js
const auth = getAuthInstance();
const token = await auth.currentUser?.getIdToken();
```

### Base URL Configuration

```javascript
// Production: https://api.sams.sandyland.com.mx
// Development: http://localhost:5001
const API_BASE_URL = config.api.baseUrl;
```

---

## 2. Water Management APIs

### Domain-Specific Routes
Water APIs use domain-focused routes (`/water/`) instead of traditional REST patterns.

#### Get Water Data for Year
```http
GET /water/clients/:clientId/data/:year?
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fiscalYear": 2025,
    "months": [
      {
        "month": 7,
        "monthName": "July",
        "hasReadings": true,
        "hasBills": true,
        "totalConsumption": 145,
        "totalCharges": 725000,
        "totalPenalties": 36250,
        "totalPaid": 500000,
        "totalUnpaid": 261250
      }
    ],
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

#### Get/Save Water Meter Readings
```http
GET /water/clients/:clientId/readings/:year/:month
POST /water/clients/:clientId/readings/:year/:month
```

**POST Body:**
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

#### Get Water Bills
```http
GET /water/clients/:clientId/bills/:year/:month
```

**Query Parameters:**
- `unpaidOnly=true` - Filter for unpaid bills only

**Response:**
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

#### Generate Water Bills
```http
POST /water/clients/:clientId/bills/generate
```

**Body:**
```json
{
  "year": 2025,
  "month": 7,
  "generateForUnits": ["unit-101", "unit-102"]
}
```

#### Record Water Payment
```http
POST /water/clients/:clientId/payments/record
```

**Body:**
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

**Response:**
```json
{
  "success": true,
  "transactionId": "txn-456",
  "paymentsApplied": [
    {
      "billId": "bill-123",
      "amountApplied": 178500,
      "basePayment": 170000,
      "penaltyPayment": 8500
    }
  ],
  "remainingCredit": 321500,
  "creditHistory": {
    "timestamp": "2025-07-15T00:00:00Z",
    "type": "overpayment",
    "amount": 321500,
    "transactionId": "txn-456"
  }
}
```

#### Get Unpaid Bills Summary
```http
GET /water/clients/:clientId/bills/unpaid/:unitId
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalUnpaid": 535500,
    "totalBase": 510000,
    "totalPenalties": 25500,
    "billCount": 3,
    "oldestUnpaidDate": "2025-05-01T00:00:00Z"
  },
  "bills": [...]
}
```

#### Recalculate Penalties
```http
POST /water/clients/:clientId/bills/recalculate-penalties
```

**Body:**
```json
{
  "year": 2025,
  "month": 7,
  "forceRecalculation": true
}
```

#### Clear Water Cache
```http
POST /water/clients/:clientId/cache/clear
POST /water/clients/:clientId/cache/clear-all
```

---

## 3. HOA Dues APIs

#### Record HOA Dues Payment
```http
POST /clients/:clientId/hoadues/payment/:unitId/:year
```

**Body:**
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

**Response:**
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

#### Update Credit Balance
```http
PUT /clients/:clientId/hoadues/credit/:unitId/:year
```

**Body:**
```json
{
  "creditBalance": 50000
}
```

#### Get Transaction by ID
```http
GET /clients/:clientId/transactions/:transactionId
```

---

## 4. Transaction Management APIs

#### List/Query Transactions
```http
GET /api/clients/:clientId/transactions
```

**Query Parameters:**
- `category` - Filter by category
- `subcategory` - Filter by subcategory
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)
- `minAmount` - Minimum amount (in cents)
- `maxAmount` - Maximum amount (in cents)
- `method` - Payment method filter

**Response:**
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

#### Create Transaction
```http
POST /api/clients/:clientId/transactions
```

**Body:**
```json
{
  "date": "2025-07-15T00:00:00Z",
  "amount": 50000,
  "category": "water_payments",
  "subcategory": "consumption",
  "vendor": "Water Department",
  "description": "July water payment",
  "method": "Bank Transfer",
  "currency": "MXN",
  "notes": "Unit 101 payment",
  "attachments": []
}
```

**Response:**
```json
{
  "id": "txn-124",
  "success": true,
  "transaction": {...}
}
```

#### Update Transaction
```http
PUT /api/clients/:clientId/transactions/:txnId
```

**Body:** Same as create, with updated fields

#### Delete Transaction
```http
DELETE /api/clients/:clientId/transactions/:txnId
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

---

## 5. Unit Management APIs

#### Get All Units
```http
GET /clients/:clientId/units
```

**Response:**
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

#### Create Unit
```http
POST /clients/:clientId/units
```

**Body:**
```json
{
  "unitNumber": "102",
  "owner": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567891",
  "scheduledAmount": 25000,
  "creditBalance": 0,
  "isActive": true
}
```

#### Update Unit
```http
PUT /clients/:clientId/units/:unitId
```

**Body:** Same as create, with fields to update

#### Delete Unit
```http
DELETE /clients/:clientId/units/:unitId
```

---

## 6. Client Management APIs

#### Get Client Info
```http
GET /api/clients/:clientId
```

**Response:**
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

#### Get User Profile
```http
GET /api/user/profile
```

**Response:**
```json
{
  "user": {
    "uid": "firebase-uid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "photoURL": "https://...",
    "role": "admin",
    "permissions": ["all"],
    "clients": ["MTC", "AV2"]
  }
}
```

---

## 7. Document Management APIs

#### Upload Document
```http
POST /api/clients/:clientId/documents/upload
```

**Body (multipart/form-data):**
- `file` - The document file
- `category` - Document category
- `description` - Optional description
- `transactionId` - Optional related transaction

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "doc-123",
    "filename": "receipt.pdf",
    "url": "https://storage.googleapis.com/...",
    "category": "receipts",
    "uploadedAt": "2025-07-15T00:00:00Z"
  }
}
```

#### List Documents
```http
GET /api/clients/:clientId/documents
```

**Query Parameters:**
- `category` - Filter by category
- `transactionId` - Filter by related transaction

#### Delete Document
```http
DELETE /api/clients/:clientId/documents/:documentId
```

---

## 8. System APIs

#### Get Exchange Rates (Public)
```http
GET /system/exchange-rates/latest
```

**Response:**
```json
{
  "success": true,
  "rates": {
    "USD": {
      "buy": 17.50,
      "sell": 18.00,
      "date": "2025-07-15T00:00:00Z"
    },
    "EUR": {
      "buy": 19.20,
      "sell": 19.80,
      "date": "2025-07-15T00:00:00Z"
    }
  },
  "lastUpdated": "2025-07-15T12:00:00Z"
}
```

#### Health Check (Public)
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-07-15T12:00:00Z",
  "environment": "production"
}
```

#### Version Info (Public)
```http
GET /system/version
```

**Response:**
```json
{
  "version": "0.4.0",
  "build": "2025.07.15",
  "api": "v1"
}
```

---

## 9. Email APIs

#### Send Email
```http
POST /api/clients/:clientId/email/send
```

**Body:**
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

**Response:**
```json
{
  "success": true,
  "messageId": "msg-123",
  "timestamp": "2025-07-15T12:00:00Z"
}
```

---

## 10. Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `INVALID_JSON` | 400 | Malformed JSON in request |
| `CONFLICT` | 409 | Resource conflict (duplicate) |
| `SERVER_ERROR` | 500 | Internal server error |
| `RATE_LIMITED` | 429 | Too many requests |

### Authentication Errors

```json
{
  "success": false,
  "error": "User not authenticated",
  "code": "UNAUTHORIZED",
  "details": {
    "message": "Firebase ID token is missing or expired"
  }
}
```

### Validation Errors

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "amount": "Amount must be greater than 0",
      "date": "Invalid date format"
    }
  }
}
```

### Permission Errors

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "FORBIDDEN",
  "details": {
    "requiredPermission": "transactions.create",
    "userRole": "viewer"
  }
}
```

---

## Request/Response Patterns

### Pagination Pattern

**Request:**
```http
GET /api/clients/:clientId/transactions?page=1&limit=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Batch Operations Pattern

**Request:**
```http
POST /api/clients/:clientId/transactions/batch
```

**Body:**
```json
{
  "operations": [
    { "action": "create", "data": {...} },
    { "action": "update", "id": "txn-123", "data": {...} },
    { "action": "delete", "id": "txn-124" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "index": 0, "success": true, "id": "txn-125" },
    { "index": 1, "success": true },
    { "index": 2, "success": false, "error": "Not found" }
  ],
  "summary": {
    "total": 3,
    "succeeded": 2,
    "failed": 1
  }
}
```

### File Upload Pattern

Use `multipart/form-data` for file uploads:

```javascript
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('metadata', JSON.stringify({
  category: 'receipts',
  transactionId: 'txn-123'
}));

fetch(`${API_BASE_URL}/api/clients/${clientId}/documents/upload`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // Don't set Content-Type for FormData
  },
  body: formData
});
```

---

## Implementation Notes

### Critical API Requirements

1. **Always include Firebase token** in Authorization header
2. **Use domain-specific routes** for water module (`/water/`)
3. **Store amounts in cents** (integers) to prevent float errors
4. **Include timezone** in date operations (America/Cancun)
5. **Check response.success** before processing data
6. **Handle 404s gracefully** - may indicate deleted resources
7. **Use proper HTTP methods** - GET for reads, POST for creates, PUT for updates, DELETE for deletes

### Frontend Integration Examples

#### API Service Pattern
```javascript
// /frontend/sams-ui/src/api/baseService.js
async function apiRequest(url, options = {}) {
  const token = await getAuthToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}
```

#### Error Handling Pattern
```javascript
try {
  const result = await apiRequest(`${API_BASE_URL}/water/clients/${clientId}/bills/generate`, {
    method: 'POST',
    body: JSON.stringify({ year, month })
  });
  
  console.log('Bills generated:', result);
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
    showValidationErrors(error.details.fields);
  } else if (error.code === 'UNAUTHORIZED') {
    // Redirect to login
    router.push('/login');
  } else {
    // Generic error handling
    showError(error.message);
  }
}
```

---

**Document End**  
*This document represents the complete API specification for SAMS APM v0.4*