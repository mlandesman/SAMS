# SAMS ACCESS CONTROL MATRIX

## Overview
This document defines the comprehensive access control system for the Sandyland Asset Management System (SAMS), including role hierarchies, permissions, and security enforcement mechanisms.

---

## 🔐 USER ACCESS CONTROL MATRIX

### Role Hierarchy & Global Permissions

#### **SuperAdmin** (michael@landesman.com)
- **Scope**: System-wide access across all clients and properties
- **User Management**: Can create, edit, delete any user; assign any role including other SuperAdmins
- **Client Access**: Automatic access to all existing and future clients
- **System Configuration**: Can modify global system settings and configurations
- **Audit Access**: Full access to system audit logs and security events

#### **Admin** (Property-Level Administrator)
- **Scope**: Limited to assigned client properties only
- **User Management**: Can create/edit users within their assigned clients; cannot create other Admins or SuperAdmins
- **Client Access**: Only clients explicitly assigned to them
- **Data Access**: Full read/write access to all modules within their assigned properties
- **Restrictions**: Cannot access other properties or system-wide settings

#### **Unit Owner** (Property Owner)
- **Scope**: Limited to their specific unit(s) and assigned client property
- **Financial Access**: Can view their unit's financial statements, HOA dues, and payment history
- **Document Access**: Can view documents related to their unit and general property documents
- **Transaction Viewing**: Can see transactions that affect their unit or common areas
- **Restrictions**: Cannot view other units' private financial data or modify property-wide settings

#### **Unit Manager** (Property Manager/Caretaker)
- **Scope**: Limited to assigned client property with operational access
- **Operational Access**: Can manage day-to-day operations, maintenance requests, vendor interactions
- **Financial Viewing**: Can view property-wide financial summaries but not individual unit owner private data
- **Document Management**: Can upload and manage operational documents
- **Restrictions**: Cannot modify unit ownership or access other properties

---

## Activity/Module-Specific Access Controls

### **Dashboard**
- **SuperAdmin**: Global dashboard with all properties and system metrics
- **Admin**: Property-specific dashboard with their assigned clients only
- **Unit Owner**: Personal dashboard showing their unit status, dues, and notifications
- **Unit Manager**: Operational dashboard for assigned property with maintenance and vendor activities

### **Financial Management**
- **SuperAdmin**: Access to all financial data across all properties
- **Admin**: Full financial access within their assigned properties including all unit accounts
- **Unit Owner**: Can only view their own unit's financial statements, payment history, and outstanding balances
- **Unit Manager**: Can view property-wide financial summaries but cannot access individual unit owner account details

### **HOA Dues & Assessments**
- **SuperAdmin**: Can create, modify, and manage dues structures for any property
- **Admin**: Can manage dues and assessments for their assigned properties
- **Unit Owner**: Can view their own dues obligations and payment history; can make payments
- **Unit Manager**: Can view dues collection reports but cannot modify dues structures

### **Document Management**
- **SuperAdmin**: Access to all documents across all properties
- **Admin**: Full document access within their assigned properties
- **Unit Owner**: Can view general property documents and their unit-specific documents
- **Unit Manager**: Can upload/manage operational documents but cannot access unit owner private documents

### **Vendor & Transaction Management**
- **SuperAdmin**: Full vendor and transaction management across all properties
- **Admin**: Can manage vendors and approve transactions within their assigned properties
- **Unit Owner**: Can view transactions that affect their unit or common areas
- **Unit Manager**: Can create vendor requests and manage operational transactions

### **Settings & User Management**
- **SuperAdmin**: Access to all system settings and can manage any user account
- **Admin**: Can manage user accounts within their assigned properties; cannot modify system settings
- **Unit Owner**: Can only update their own profile and notification preferences
- **Unit Manager**: Can only update their own profile; no access to user management

### **Reports & Analytics**
- **SuperAdmin**: System-wide reporting across all properties and clients
- **Admin**: Property-specific reports for their assigned clients
- **Unit Owner**: Personal reports showing their unit's financial history and account status
- **Unit Manager**: Operational reports for assigned property including maintenance and vendor activities

---

## Security Enforcement Mechanisms

### **UI-Level Protection**
- Navigation menus dynamically hide/show based on user permissions
- Action buttons (Create, Edit, Delete) only appear for authorized users
- Data grids filter content based on user's access scope

### **API-Level Security**
- All backend endpoints verify user authentication and role permissions
- Database queries automatically filter results based on user's client access
- Cross-client data access is prevented at the database query level

### **Client Context Enforcement**
- Users can only operate within their assigned client properties
- Client selection is restricted to user's authorized clients
- All data operations are scoped to the user's current client context

### **Audit & Monitoring**
- All user actions are logged with user identification and client context
- Security violations are logged and can trigger alerts
- User access patterns are monitored for suspicious activity

---

## User Management System

### Account Creation Methods
1. **Email Invitation Flow**: Secure password setup via email links
2. **Manual Password Flow**: Admin-generated passwords for tech-averse users

### Password Management
- **Smart Password Requirements**: Only force change for auto-generated passwords
- **Account State Management**: pending_invitation, pending_password_change, active
- **Professional Email Notifications**: Sandyland branding with password details

### Account States
- **pending_invitation**: User created, awaiting email password setup
- **pending_password_change**: User must change password on next login
- **active**: User can access system normally

---

## Implementation Status
✅ **FULLY OPERATIONAL** - All access controls implemented and tested
✅ **Multi-tenant Security** - Client isolation enforced at all levels
✅ **Role-based Permissions** - Hierarchical access control active
✅ **User Management** - Complete creation, editing, and deletion workflows
✅ **Email Integration** - Professional communications with Sandyland branding

---

*Last Updated: June 2024*
*Document Maintainer: Project Owner*
*Implementation: Phase 8 - User Access Control System*