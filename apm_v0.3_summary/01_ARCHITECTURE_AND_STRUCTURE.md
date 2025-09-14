# SAMS Architecture and Structure
*APM v0.3 Consolidated Documentation for v0.4 System*

## System Overview

SAMS (Sandyland Asset Management System) is a production-ready, multi-tenant property management system that successfully manages multiple HOA communities with comprehensive financial tracking, document management, and user access control. The system reached production status in August 2025 with two active clients managing over 1,700 documents and $500,000+ in financial transactions.

## Core Architecture

### Technology Stack

#### Frontend
- **Framework**: React 18.3.1 + Vite 5.3.3
- **Styling**: CSS-based styling (no external UI frameworks)
- **State Management**: React Context API (AuthContext, ClientContext, TransactionContext)
- **Routing**: React Router v6
- **Mobile**: Progressive Web App (PWA) with service workers
- **Build Tools**: Vite with optimized production builds

#### Backend
- **Runtime**: Node.js 20.x + Express 4.x
- **Database**: Google Firestore (NoSQL document database)
- **Authentication**: Firebase Authentication (email/password)
- **Storage**: Firebase Storage for documents and media
- **Admin SDK**: Firebase Admin SDK for server-side operations
- **API Pattern**: RESTful with client-scoped endpoints

#### Infrastructure
- **Hosting**: Vercel (frontend), Firebase Functions (backend)
- **Domain**: sams.sandyland.com.mx (production)
- **CI/CD**: GitHub Actions with automated deployments
- **Monitoring**: Firebase Analytics and custom audit logging

### Multi-Tenant Architecture

The system implements complete client isolation with the following structure:

```
Application Layer
├── Authentication (Firebase Auth)
├── Authorization (Role-Based Access Control)
├── Client Context Management
└── Activity-Based Modules

Data Layer
├── Global Collections (/users)
└── Client-Scoped Collections (/clients/{clientId}/*)
    ├── transactions
    ├── units
    ├── vendors
    ├── categories
    ├── accounts
    ├── documents
    └── config
```

### Design Principles

1. **Zero Trust Security**: Every operation validated for authentication and authorization
2. **Client Isolation**: Complete data segregation between clients
3. **Activity-Centric Design**: Modular activities that can be enabled/disabled per client
4. **Mobile-First Responsive**: Desktop web UI with mobile PWA support
5. **Audit Everything**: Comprehensive logging of all data modifications
6. **Scalable Architecture**: Designed for hundreds of clients and thousands of units

## Frontend Architecture

### Component Hierarchy

```
src/
├── App.jsx                           # Root application component
├── components/
│   ├── auth/
│   │   ├── LoginForm.jsx            # Authentication interface
│   │   └── ProtectedRoute.jsx       # Route protection wrapper
│   ├── layout/
│   │   ├── MainLayout.jsx           # Overall page structure
│   │   ├── Sidebar.jsx              # Navigation and client switching
│   │   └── StatusBar.jsx            # Top bar with user info
│   ├── dashboard/
│   │   └── Dashboard.jsx            # Multi-card dashboard view
│   ├── transactions/
│   │   ├── TransactionTable.jsx     # Advanced transaction grid
│   │   ├── TransactionModal.jsx     # Transaction entry/edit
│   │   └── TransactionFilters.jsx   # Search and filter controls
│   ├── hoa/
│   │   ├── HOADuesView.jsx         # HOA dues payment grid
│   │   └── HOAPaymentModal.jsx     # Payment recording interface
│   ├── lists/
│   │   └── ListManagement.jsx      # Generic CRUD interface
│   └── common/
│       ├── LoadingSpinner.jsx      # Loading indicators
│       ├── ErrorBoundary.jsx       # Error handling wrapper
│       └── Modal.jsx                # Reusable modal component
├── contexts/
│   ├── AuthContext.jsx             # Authentication state
│   ├── ClientContext.jsx           # Client selection state
│   └── TransactionContext.jsx      # Transaction data cache
├── services/
│   ├── api/
│   │   ├── client.js               # API client configuration
│   │   ├── secureApiClient.js     # Auth-aware API client
│   │   └── enhancedApiClient.js   # Utility API client
│   └── firebase/
│       └── config.js               # Firebase initialization
└── utils/
    ├── formatters.js               # Data formatting utilities
    ├── validators.js               # Input validation
    └── calculations.js             # Financial calculations
```

### State Management Patterns

- **Authentication State**: Managed via AuthContext with Firebase Auth integration
- **Client Context**: Dynamic client switching with permission validation
- **Transaction Cache**: Optimistic updates with server reconciliation
- **Form State**: Controlled components with validation
- **Modal State**: Centralized modal management for consistency

### Routing Strategy

```javascript
// Activity-based routing with client context
/dashboard                    // Main dashboard
/transactions                 // Transaction management
/hoa-dues                    // HOA dues tracking
/lists/{listType}            // Generic list management
/documents                   // Document management
/users                      // User administration
/settings                   // Client configuration
```

## Backend Architecture

### API Structure

```
backend/
├── server.js                       # Express server initialization
├── middleware/
│   ├── auth.js                   # Authentication middleware
│   ├── clientAuth.js             # Client authorization
│   ├── roleAuth.js              # Role-based access control
│   └── errorHandler.js          # Global error handling
├── controllers/
│   ├── authController.js        # Authentication endpoints
│   ├── transactionController.js # Transaction CRUD
│   ├── unitController.js        # Unit management
│   ├── vendorController.js      # Vendor operations
│   ├── categoryController.js    # Category management
│   ├── accountController.js     # Account operations
│   ├── hoaDuesController.js     # HOA dues logic
│   ├── documentController.js    # Document handling
│   └── userController.js        # User management
├── services/
│   ├── balanceService.js        # Balance calculations
│   ├── auditService.js          # Audit logging
│   ├── emailService.js          # Email notifications
│   └── migrationService.js      # Data migration
├── models/
│   └── [Firebase collections defined via Admin SDK]
└── utils/
    ├── firebase.js               # Firebase Admin initialization
    ├── validators.js             # Data validation
    └── calculations.js           # Business logic calculations
```

### API Patterns

#### Client-Scoped Endpoints
All data operations are scoped to the authenticated client:
```
GET    /api/clients/{clientId}/transactions
POST   /api/clients/{clientId}/transactions
PUT    /api/clients/{clientId}/transactions/{id}
DELETE /api/clients/{clientId}/transactions/{id}
```

#### Middleware Chain
```javascript
Request → Authentication → Client Authorization → Role Validation → Controller → Response
         ↓ (fail)        ↓ (fail)              ↓ (fail)
         401             403                   403
```

#### Error Handling
Standardized error responses with proper HTTP status codes:
```javascript
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": { /* additional context */ }
  }
}
```

## Database Architecture

### Firestore Collection Structure

```
firestore-root/
├── users/{emailBasedId}                          # Global user accounts
│   ├── email: string
│   ├── displayName: string
│   ├── role: "superAdmin" | "admin" | "user"
│   ├── clientAccess: { [clientId]: permissions }
│   └── metadata: { created, updated, etc. }
│
├── clients/{clientId}                            # Client configuration
│   ├── name: string
│   ├── logo: string (URL)
│   ├── settings: { fiscalYear, timezone, etc. }
│   └── metadata: { created, updated, etc. }
│
├── clients/{clientId}/transactions/{id}          # Financial transactions
│   ├── date: Timestamp
│   ├── amount: number (cents)
│   ├── type: "income" | "expense"
│   ├── vendorId: string
│   ├── vendorName: string (denormalized)
│   ├── categoryId: string
│   ├── categoryName: string (denormalized)
│   ├── accountId: string
│   ├── accountName: string (denormalized)
│   ├── description: string
│   ├── attachments: string[]
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/units/{unitId}             # Property units
│   ├── unitNumber: string
│   ├── displayName: string
│   ├── ownershipType: "individual" | "business" | "trust"
│   ├── ownerName: string
│   ├── authorizedUsers: string[] (user IDs)
│   ├── hoaDuesAmount: number (cents)
│   ├── occupancyStatus: "owner" | "rented" | "vacant"
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/units/{unitId}/dues/{year} # HOA dues tracking
│   ├── months: { [month]: paymentData }
│   ├── yearlyTotal: number (cents)
│   ├── balance: number (cents)
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/vendors/{id}               # Vendor management
│   ├── name: string
│   ├── type: "vendor" | "contractor" | "utility"
│   ├── contact: { email, phone, address }
│   ├── taxId: string
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/categories/{id}            # Transaction categories
│   ├── name: string
│   ├── type: "income" | "expense" | "both"
│   ├── parent: string (for subcategories)
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/accounts/{id}              # Financial accounts
│   ├── name: string
│   ├── type: "bank" | "cash" | "investment"
│   ├── balance: number (cents, cached)
│   ├── lastReconciled: Timestamp
│   └── metadata: { created, updated, lastModifiedBy }
│
├── clients/{clientId}/documents/{id}             # Document storage
│   ├── name: string
│   ├── type: string (MIME type)
│   ├── size: number (bytes)
│   ├── url: string (Firebase Storage URL)
│   ├── linkedEntity: { type, id }
│   └── metadata: { created, uploaded, uploadedBy }
│
├── clients/{clientId}/projects/waterBills/       # Water bills (AVII implemented)
│   ├── bills/{billId}           # Generated water bills
│   ├── meters/{meterId}         # Water meter configurations
│   └── readings/{readingId}     # Monthly meter readings
│
├── clients/{clientId}/budgets/{year}             # Budget management (planned)
│   └── (Future implementation for budget tracking)
│
└── clients/{clientId}/config/*                   # Client-specific settings
    ├── exchangeRates/{date}
    ├── emailTemplates/{type}
    └── customFields/{entity}
```

### Data Modeling Decisions

1. **Email-Based User IDs**: Prevents UID mismatch issues with Firebase Auth
2. **Denormalized Reference Data**: Vendor/category names cached in transactions for performance
3. **Cents Storage**: All monetary values stored as integers to prevent floating-point errors
4. **Timestamp Fields**: Firestore Timestamps for consistent date handling
5. **Soft Deletes**: Deleted flag with timestamp rather than physical deletion
6. **Audit Trail**: All modifications tracked with user and timestamp

## Security Architecture

### Authentication Flow

```
1. User enters email/password
2. Firebase Auth validates credentials
3. ID token generated with 1-hour expiry
4. Token sent with each API request
5. Backend validates token with Firebase Admin
6. User document fetched for permissions
7. Client access validated
8. Role permissions checked
9. Operation allowed/denied
```

### Authorization Layers

#### Layer 1: Authentication
- Firebase Authentication with email/password
- Token-based session management
- Automatic token refresh

#### Layer 2: Client Access
- User must have explicit access to client
- Client selection validated on each request
- Cross-client operations prevented

#### Layer 3: Role-Based Permissions
- **SuperAdmin**: System-wide access
- **Admin**: Full access within client
- **Unit Owner**: Limited to own unit data
- **Unit Manager**: Operational access for assigned units

#### Layer 4: Data Scoping
- Queries automatically scoped to selected client
- Firestore security rules as backup
- Row-level security for sensitive data

### Security Best Practices Implemented

1. **No Direct Firebase Access**: All operations through authenticated API
2. **Input Validation**: Comprehensive validation on all inputs
3. **SQL Injection Prevention**: NoSQL database immune to SQL injection
4. **XSS Protection**: React's automatic escaping + Content Security Policy
5. **CSRF Protection**: Token-based authentication prevents CSRF
6. **Rate Limiting**: API rate limits prevent abuse
7. **Audit Logging**: All data modifications logged
8. **Encryption**: HTTPS for transit, Firebase handles at-rest encryption

## Module Architecture

### Core Modules

#### Dashboard Module
- Multi-card layout with real-time data
- Account balance summaries
- HOA dues collection status
- Recent transactions
- Exchange rate display
- Quick actions menu

#### Transaction Module
- Comprehensive transaction management
- Advanced filtering and search
- Bulk operations support
- Receipt generation
- Document attachments
- Balance impact tracking

#### HOA Dues Module
- Specialized payment tracking grid
- Monthly/quarterly/annual views
- Credit balance management
- Penalty calculations
- Batch payment recording
- Payment distribution logic

#### Water Bills Module
- Meter reading management
- Consumption calculations
- Tiered pricing support
- Penalty system
- Bill generation
- Payment tracking

#### List Management Module
- Generic CRUD interface
- Supports: Units, Vendors, Categories, Accounts
- Bulk import/export
- Data validation
- Relationship management

#### Document Management Module
- File upload with progress tracking
- Entity linking (transactions, units, etc.)
- Permission-based access
- Preview generation
- Version control
- Storage optimization

#### User Management Module
- User creation and invitation
- Role assignment
- Multi-unit access management
- Activity tracking
- Session management
- Password reset flow

#### Water Bills Module
- Unit-centric meter reading system
- Consumption calculation with flat rate (50 MXN/m³)
- Compound penalty system (5% monthly after 10 days)
- Bill generation and payment tracking
- Integration with transaction system
- Digital receipt generation

### Module Communication

Modules communicate through:
1. **Shared Contexts**: AuthContext, ClientContext for global state
2. **Event Bus**: Custom events for cross-module notifications
3. **API Layer**: Centralized data fetching and caching
4. **Props Drilling**: Minimal, only for tightly coupled components

### Domain-Specific API Architecture

The system implements **two API patterns** for different purposes:

#### 1. Domain-Specific Routes (Clean URLs)
Used for specialized modules like Water Bills:
```javascript
// Water module routes (waterRoutes.js)
/water/clients/:clientId/data/:year?           // Data aggregation
/water/clients/:clientId/readings/:year/:month // Readings management  
/water/clients/:clientId/bills/generate        // Bill generation
/water/clients/:clientId/bills/:year/:month    // Get bills
/water/clients/:clientId/payments/record       // Payment recording
/water/clients/:clientId/config               // Configuration
```

#### 2. Traditional RESTful Routes
Used for standard CRUD operations:
```javascript
// Standard resource routes
/api/clients/{clientId}/transactions
/api/clients/{clientId}/units
/api/clients/{clientId}/vendors
/api/clients/{clientId}/categories
```

This dual approach allows:
- Clean, intuitive URLs for domain-specific operations
- Consistent RESTful patterns for standard CRUD
- Better organization of complex business logic
- Easier API versioning and evolution

## Performance Optimizations

### Frontend Optimizations
- Code splitting with React.lazy()
- Route-based chunking
- Image lazy loading
- Virtual scrolling for large lists
- Memoization of expensive calculations
- Optimistic UI updates

### Backend Optimizations
- Firestore composite indexes
- Query result caching
- Batch operations for bulk updates
- Connection pooling
- Denormalized data for read performance
- Background jobs for heavy processing

### Database Optimizations
- Strategic indexing based on query patterns
- Denormalization where appropriate
- Aggregation data pre-calculation
- Efficient pagination with cursors
- Subcollection design for scalability

## Scalability Considerations

### Horizontal Scaling
- Stateless backend design
- Firebase automatic scaling
- CDN for static assets
- Database sharding by client

### Vertical Scaling
- Optimized queries
- Efficient data structures
- Caching strategies
- Background processing

### Multi-Tenancy Scaling
- Client data isolation
- Per-client resource limits
- Usage monitoring
- Automatic provisioning

## Development Workflow

### Environment Setup
```
Development → Staging → Production
  ↓            ↓          ↓
localhost    staging    sams.sandyland.com.mx
```

### Branch Strategy
- `main`: Production-ready code
- `staging`: Pre-production testing
- `feature/*`: New features
- `fix/*`: Bug fixes
- `hotfix/*`: Emergency production fixes

### Deployment Pipeline
1. Code pushed to GitHub
2. GitHub Actions triggered
3. Tests executed
4. Build created
5. Deployment to appropriate environment
6. Post-deployment validation

## Monitoring and Observability

### Application Monitoring
- Firebase Analytics for user behavior
- Custom metrics for business KPIs
- Error tracking with detailed logs
- Performance monitoring

### Infrastructure Monitoring
- Vercel deployment status
- Firebase service health
- API response times
- Database query performance

### Audit and Compliance
- Comprehensive audit logs
- User activity tracking
- Data modification history
- Security event logging

## Disaster Recovery

### Backup Strategy
- Automated Firestore backups
- Transaction log preservation
- Document storage redundancy
- Configuration backups

### Recovery Procedures
- Point-in-time restoration
- Gradual rollback capability
- Data validation scripts
- Client notification system

## Future Architecture Considerations

### Planned Enhancements
- GraphQL API layer
- Real-time subscriptions
- Microservices architecture
- Event-driven processing
- AI/ML integration for insights

### Technical Debt
- TypeScript migration
- Component library standardization
- Test coverage improvement
- Documentation generation
- Performance profiling

This architecture has proven robust and scalable, successfully handling production workloads while maintaining security, performance, and reliability standards.