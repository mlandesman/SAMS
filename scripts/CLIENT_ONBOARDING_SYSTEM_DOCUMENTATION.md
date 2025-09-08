# SAMS Client Onboarding System Documentation

## Overview

The SAMS (Sandyland Management System) Client Onboarding System provides a comprehensive, automated workflow for importing new client data into the system. This documentation covers the complete architecture, processes, and usage patterns developed during the implementation.

## System Architecture

### Core Components

1. **Interactive Client Onboarding Script** (`interactive-client-onboarding.js`)
   - Main orchestration script for the entire onboarding process
   - Provides interactive CLI interface for client selection and configuration
   - Handles database purging and import pipeline execution

2. **Import Scripts Pipeline**
   - `import-categories-vendors-with-crud.js` - Categories & vendors import
   - `import-users-with-audit.js` - Users with Firebase Auth integration
   - `import-units-with-crud.js` - Units with size data
   - `import-transactions-with-crud.js` - Financial transactions
   - `importHOADuesFixed.js` - HOA dues with transaction linking

3. **Utility Infrastructure**
   - `purge-all-mtc-data.js` - Complete database cleanup
   - `utils/environment-config.js` - Firebase initialization and environment management
   - `utils/import-audit-logger.js` - Comprehensive audit logging
   - `utils/field-validator.js` - Data validation and field specification compliance
   - `utils/timestamp-converter.js` - Timestamp and date handling utilities

### Data Flow Architecture

```
Client Data Sources (MTCdata/)
    ↓
Interactive Onboarding Script
    ↓
Optional Database Purge
    ↓
Sequential Import Pipeline:
1. Categories & Vendors → Database
2. Users → Firebase Auth + Firestore
3. Units → Database with size data
4. Transactions → Database with ID mapping
5. HOA Dues → Database with transaction linking
    ↓
Verification & Audit Trail
```

## Import Pipeline Execution Order

### 1. Categories & Vendors Import
- **Purpose**: Establishes foundational data for transaction categorization
- **Key Features**: 
  - CRUD function integration
  - Duplicate detection and handling
  - Client-scoped storage
- **Audit Logging**: Full creation/update tracking

### 2. Users Import
- **Purpose**: Creates user accounts with Firebase Auth integration
- **Key Features**:
  - Firebase Authentication user creation
  - Firestore profile documents using Auth UIDs
  - User-unit relationship mapping via propertyAccess structure
  - Password migration from legacy systems
- **Security**: Implements proper authentication patterns and CANSPAM compliance

### 3. Units Import  
- **Purpose**: Imports property unit information with size data
- **Key Features**:
  - Integration with UnitSizes.json for square footage data
  - Ownership percentage calculations
  - Email and owner information mapping
- **Validation**: Required field compliance and data quality checks

### 4. Transactions Import
- **Key Features**:
  - Negative amount handling (stores absolute value, marks as expense)
  - Timestamp-based document ID generation
  - Transaction ID mapping creation for HOA dues linking
  - Account mapping (Cash, Bank accounts)
- **Output**: Creates `transaction-id-mapping.json` for dues processing

### 5. HOA Dues Import
- **Purpose**: Imports dues data with payment history and transaction linking
- **Key Features**:
  - 12-month payment array structure
  - Date extraction from payment notes
  - Sequence number parsing for transaction ID linking
  - Credit balance and payment tracking

## Field Specifications Compliance

### User Documents (New Field Structure)
```javascript
{
  email: string,              // Required
  displayName: string,        // Required  
  isSuperAdmin: boolean,      // Required
  propertyAccess: {           // Required - client access structure
    [clientId]: {
      isAdmin: boolean,
      unitAssignments: [{
        unitId: string,
        role: string           // 'owner', 'tenant', etc.
      }]
    }
  },
  profile: {                  // Required
    firstName: string,
    lastName: string, 
    phone: string,
    preferredCurrency: string,
    preferredLanguage: string,
    taxId: string
  },
  notifications: {            // Required - CANSPAM compliance
    email: boolean,
    sms: boolean, 
    duesReminders: boolean
  },
  accountState: string,       // Required - 'active', 'inactive'
  mustChangePassword: boolean,
  updated: Timestamp
}
```

### Transaction Documents
```javascript
{
  date: Timestamp,            // Required
  amount: number,             // In cents, absolute value
  transactionType: string,    // 'income' or 'expense'
  vendorId: string,
  vendorName: string,
  categoryName: string,
  accountId: string,
  accountName: string,
  reference: string,
  notes: string,
  unitId: string,             // For HOA dues transactions
  duesDistribution: array,    // For HOA dues allocation
  updated: Timestamp
}
```

## Audit Logging System

### Implementation
- **Firestore Collection**: `auditLogs`
- **Index Requirements**: Composite indexes on (clientId, module, timestamp)
- **Audit Levels**: Document creation, updates, and import operations

### Audit Log Structure
```javascript
{
  clientId: string,
  module: string,            // 'users', 'units', 'transactions', etc.
  action: string,            // 'create', 'update', 'import'
  parentPath: string,        // Firestore document path
  docId: string,            // Document ID
  friendlyName: string,     // Human-readable description
  notes: string,            // Additional context
  timestamp: Timestamp
}
```

## Database Purge System

### Comprehensive Cleanup (`purge-all-mtc-data.js`)
- **Collections Purged**:
  - `clients/{clientId}/users` (with Firebase Auth cleanup)
  - `clients/{clientId}/units` (including nested dues)
  - `clients/{clientId}/categories`
  - `clients/{clientId}/vendors` 
  - `clients/{clientId}/transactions`
  - `clients/{clientId}/importMetadata`
  - `auditLogs` (client-scoped)
  - Top-level client document

### Safety Features
- Production environment protection
- Confirmation prompts
- Recursive deletion for nested collections
- Comprehensive cleanup reporting

## Environment Configuration

### Supported Environments
- **Development**: `sandyland-management-system` - Safe testing environment
- **Staging**: `sandyland-management-staging` - Pre-production validation  
- **Production**: `sandyland-management-system` - Live user data

### Environment Selection Methods

#### 1. Interactive Selection (Default)
When no `FIRESTORE_ENV` is set, the script prompts for environment selection:
```
🌍 ENVIRONMENT SELECTION
==================================================
Select the target environment for client onboarding:
   1. Development (dev) - Development environment for testing
   2. Staging (staging) - Staging environment for pre-production testing  
   3. Production (prod) - Production environment - LIVE DATA ⚠️ LIVE DATA
```

#### 2. Environment Variable Pre-configuration
```bash
export FIRESTORE_ENV=dev|staging|prod
```

#### 3. Inline Environment Setting
```bash
FIRESTORE_ENV=prod node interactive-client-onboarding.js
```

### Production Safety Features
- **Double Confirmation**: Production requires typing "PRODUCTION" to confirm
- **Warning Messages**: Clear indicators when working with live data
- **Exit Points**: Multiple opportunities to cancel before affecting production
- **Extra Validation**: Additional confirmation prompts for destructive operations

## Error Handling and Recovery

### Index Management
- Scripts gracefully handle missing Firestore indexes
- Audit log verification skips if indexes unavailable
- Provides clear messages about index building status

### Import Failure Recovery
- Each import script can be run independently
- Duplicate detection prevents data conflicts
- Detailed error reporting with stack traces
- Transaction mapping preservation across retries

## Security Considerations

### Firebase Authentication Integration
- User document IDs use Firebase Auth UIDs for security
- Password migration from legacy systems
- Proper authentication flow implementation

### Data Validation
- Field specification compliance checking
- Required field validation
- Data type and format validation
- Firestore security rules compatibility

## Usage Patterns

### Complete Client Onboarding

#### Interactive Mode (Recommended)
```bash
node interactive-client-onboarding.js
```
- Prompts for environment selection (dev/staging/prod)
- Interactive client selection/creation
- Guided database purge confirmation
- Complete import pipeline execution

#### Pre-configured Environment
```bash
# Development
FIRESTORE_ENV=dev node interactive-client-onboarding.js

# Staging  
FIRESTORE_ENV=staging node interactive-client-onboarding.js

# Production (with extra safety confirmations)
FIRESTORE_ENV=prod node interactive-client-onboarding.js
```

### Individual Script Execution
```bash
# Run specific import scripts independently
node import-categories-vendors-with-crud.js
node import-users-with-audit.js
node import-units-with-crud.js
node import-transactions-with-crud.js
node importHOADuesFixed.js
```

### Database Management
```bash
# Complete data purge
node purge-all-mtc-data.js
```

## File Dependencies

### Required Data Files (MTCdata/ directory)
- `Categories.json` - Category definitions
- `Vendors.json` - Vendor information
- `Users.json` - User account data
- `Units.json` - Unit property information
- `UnitSizes.json` - Unit size and ownership data
- `Transactions.json` - Financial transaction records
- `HOADues.json` - HOA dues and payment history

### Generated Files
- `transaction-id-mapping.json` - Transaction sequence to ID mapping
- Import metadata stored in Firestore under `clients/{clientId}/importMetadata`

## Performance Characteristics

### Import Volumes (MTC Client Example)
- Categories: 26 records
- Vendors: 24 records  
- Users: 10 records
- Units: 10 records
- Transactions: 431 records
- HOA Dues: 10 units × 12 months = 120 payment records

### Execution Time
- Categories/Vendors: ~30 seconds
- Users: ~45 seconds (includes Firebase Auth)
- Units: ~20 seconds
- Transactions: ~5-8 minutes (due to volume)
- HOA Dues: ~60 seconds

## Future Enhancements

### Recommended Improvements
1. **Parallel Processing**: Execute independent imports concurrently
2. **Progress Indicators**: Real-time progress bars for long-running imports
3. **Data Validation Reports**: Pre-import data quality analysis
4. **Configuration Files**: Client-specific import configurations
5. **Rollback Capability**: Automated rollback on import failures

### Scalability Considerations
- Batch processing for large transaction volumes
- Firestore write rate limiting
- Memory optimization for large datasets
- Connection pooling for database operations

## Troubleshooting Guide

### Common Issues
1. **Missing Indexes**: Wait for Firestore index building completion
2. **Authentication Errors**: Verify service account key configuration
3. **Data Format Issues**: Check JSON file formatting and encoding
4. **Memory Issues**: Process large datasets in smaller batches
5. **Network Timeouts**: Implement retry logic for network failures

### Debug Tools
- Environment information printing
- Detailed error logging with stack traces
- Audit log verification for tracking changes
- Firebase console monitoring

---

## Implementation History

**Date**: July 5, 2025
**Version**: 1.0
**Developer**: Claude Code Assistant
**Testing Environment**: Development (sandyland-management-system)

This system represents a complete overhaul of the SAMS import infrastructure, implementing:
- Modern ES modules architecture
- Comprehensive error handling
- Full audit trail compliance
- Interactive user experience
- Production-ready security patterns
- Scalable data processing pipeline

The system successfully imported the complete MTC client dataset and is ready for production deployment with additional client onboarding.