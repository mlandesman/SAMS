/**
 * User Management Controller for SAMS Multi-Tenant System
 * Phase 8: User Access Control System - Task 8.3
 * 
 * Handles secure user creation, client assignment, and profile management
 * Enforces proper role hierarchy and access control
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { writeAuditLog } from '../utils/auditLogger.js';
import { validateClientAccess, sanitizeUserData } from '../utils/securityUtils.js';
import { sendUserInvitation, sendPasswordNotification } from '../services/emailService.js';
import { getNow } from '../services/DateService.js';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';

/**
 * Generate secure random password
 */
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Add person to unit's arrays based on their role
 * @param {FirebaseFirestore.WriteBatch} batch - Firestore batch
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {string} personName - Person's name
 * @param {string} personEmail - Person's email
 * @param {string} role - Role: 'unitOwner' or 'unitManager'
 */
async function addPersonToUnit(batch, clientId, unitId, personName, personEmail, role) {
  
  const db = await getDb();
  const unitRef = db.collection('clients').doc(clientId)
    .collection('units').doc(unitId);
    
  const unitDoc = await unitRef.get();
  if (unitDoc.exists) {
    const unitData = unitDoc.data();
    const updateData = {};
    let hasChanges = false;
    
    if (role === 'unitOwner') {
      // Handle owners array (normalize to new structure)
      const normalizedOwners = normalizeOwners(unitData.owners);
      // Check if person already exists (by name or email)
      const exists = normalizedOwners.some(owner => 
        owner.name === personName || owner.email === personEmail
      );
      if (!exists) {
        normalizedOwners.push({ name: personName, email: personEmail });
        updateData.owners = normalizedOwners;
        hasChanges = true;
      }
      
      // Note: emails field removed - emails are now in owner objects
      
    } else if (role === 'unitManager') {
      // Handle managers array (normalize to new structure)
      const normalizedManagers = normalizeManagers(unitData.managers);
      // Check if person already exists (by name or email)
      const exists = normalizedManagers.some(manager => 
        manager.name === personName || manager.email === personEmail
      );
      if (!exists) {
        normalizedManagers.push({ name: personName, email: personEmail });
        updateData.managers = normalizedManagers;
        hasChanges = true;
      }
      
      // Note: emails field removed - emails are now in manager objects
    }
    
    if (hasChanges) {
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(unitRef, updateData);
    }
  }
}

/**
 * Remove person from unit's arrays based on their role
 * @param {FirebaseFirestore.WriteBatch} batch - Firestore batch
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {string} personName - Person's name
 * @param {string} personEmail - Person's email
 * @param {string} role - Role: 'unitOwner' or 'unitManager'
 */
async function removePersonFromUnit(batch, clientId, unitId, personName, personEmail, role) {
  
  const db = await getDb();
  const unitRef = db.collection('clients').doc(clientId)
    .collection('units').doc(unitId);
    
  const unitDoc = await unitRef.get();
  if (unitDoc.exists) {
    const unitData = unitDoc.data();
    const updateData = {};
    let hasChanges = false;
    
    if (role === 'unitOwner') {
      // Handle owners array (normalize to new structure, then filter)
      const normalizedOwners = normalizeOwners(unitData.owners);
      const owners = normalizedOwners.filter(owner => 
        owner.name !== personName && owner.email !== personEmail
      );
      
      if (normalizedOwners.length !== owners.length) {
        updateData.owners = owners;
        hasChanges = true;
      }
      
      // Note: emails field removed - emails are now in owner objects
      
    } else if (role === 'unitManager') {
      // Handle managers array (normalize to new structure, then filter)
      const normalizedManagers = normalizeManagers(unitData.managers);
      const managers = normalizedManagers.filter(manager => 
        manager.name !== personName && manager.email !== personEmail
      );
      
      if (normalizedManagers.length !== managers.length) {
        updateData.managers = managers;
        hasChanges = true;
      }
      
      // Note: emails field removed - emails are now in manager objects
    }
    
    if (hasChanges) {
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(unitRef, updateData);
    }
  }
}

/**
 * Extract all unit assignments from propertyAccess data (both owners and managers)
 * @param {Object} propertyAccess - User's client access data
 * @param {string} roleFilter - Filter by role: 'unitOwner', 'unitManager', or null for all
 * @returns {Array} Array of {clientId, unitId, role} objects for all unit assignments
 */
function getUnitAssignmentsFromAccess(propertyAccess, roleFilter = null) {
  const unitAssignments = [];
  
  if (!propertyAccess) return unitAssignments;
  
  Object.entries(propertyAccess).forEach(([clientId, access]) => {
    // Handle unitAssignments structure (current standard)
    if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
      access.unitAssignments
        .filter(assignment => 
          assignment.unitId && 
          assignment.role &&
          (assignment.role === 'unitManager' || assignment.role === 'unitOwner') &&
          (!roleFilter || assignment.role === roleFilter)
        )
        .forEach(assignment => {
          unitAssignments.push({ clientId, unitId: assignment.unitId, role: assignment.role });
        });
    }
  });
  
  return unitAssignments;
}

/**
 * Extract manager unit assignments (wrapper for getUnitAssignmentsFromAccess with unitManager filter)
 */
function getManagerUnitsFromAccess(propertyAccess) {
  return getUnitAssignmentsFromAccess(propertyAccess, 'unitManager');
}

/**
 * Extract all unit assignments (any role) from propertyAccess data
 * @param {Object} propertyAccess - User's client access data
 * @returns {Array} Array of {clientId, unitId, role} objects for all unit assignments
 */
function getAllUnitAssignmentsFromAccess(propertyAccess) {
  const unitAssignments = [];
  
  if (!propertyAccess) return unitAssignments;
  
  Object.entries(propertyAccess).forEach(([clientId, access]) => {
    // Handle unitAssignments structure (current standard)
    if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
      access.unitAssignments.forEach(assignment => {
        if (assignment.unitId && assignment.role) {
          unitAssignments.push({ 
            clientId, 
            unitId: assignment.unitId, 
            role: assignment.role 
          });
        }
      });
    }
  });
  
  return unitAssignments;
}

/**
 * Synchronize unit assignments (owners and managers) between user roles and unit records
 * @param {string} userId - User ID
 * @param {Object} oldClientAccess - Previous client access data
 * @param {Object} newClientAccess - New client access data
 * @param {string} userName - User's display name
 * @param {string} userEmail - User's email address
 * @param {string} oldUserName - Previous user name (for name changes)
 */
async function syncUnitAssignments(userId, oldClientAccess, newClientAccess, userName, userEmail, oldUserName = null) {
  logDebug(`🔄 [SYNC] Syncing unit assignments for user ${userId}`);
  
  const db = await getDb();
  const batch = db.batch();
  let operationCount = 0;
  
  // Extract all unit assignments (both owners and managers) from old and new access
  const oldUnitAssignments = getUnitAssignmentsFromAccess(oldClientAccess);
  const newUnitAssignments = getUnitAssignmentsFromAccess(newClientAccess);
  
  // Create lookup sets for efficient comparison (include role in key for precise matching)
  const oldUnitsSet = new Set(oldUnitAssignments.map(unit => `${unit.clientId}/${unit.unitId}/${unit.role}`));
  const newUnitsSet = new Set(newUnitAssignments.map(unit => `${unit.clientId}/${unit.unitId}/${unit.role}`));
  
  // Find assignments to remove (in old but not in new)
  const assignmentsToRemove = oldUnitAssignments.filter(unit => 
    !newUnitsSet.has(`${unit.clientId}/${unit.unitId}/${unit.role}`)
  );
  
  // Find assignments to add (in new but not in old)
  const assignmentsToAdd = newUnitAssignments.filter(unit => 
    !oldUnitsSet.has(`${unit.clientId}/${unit.unitId}/${unit.role}`)
  );
  
  
  // Remove person from units no longer assigned
  for (const assignment of assignmentsToRemove) {
    await removePersonFromUnit(batch, assignment.clientId, assignment.unitId, oldUserName || userName, userEmail, assignment.role);
    operationCount++;
  }
  
  // Add person to newly assigned units
  for (const assignment of assignmentsToAdd) {
    await addPersonToUnit(batch, assignment.clientId, assignment.unitId, userName, userEmail, assignment.role);
    operationCount++;
  }
  
  // Handle name changes for existing assignments
  if (oldUserName && oldUserName !== userName) {
    // Find assignments that remain unchanged (intersection)
    const unchangedAssignments = newUnitAssignments.filter(unit => 
      oldUnitsSet.has(`${unit.clientId}/${unit.unitId}/${unit.role}`)
    );
    
    for (const assignment of unchangedAssignments) {
      await removePersonFromUnit(batch, assignment.clientId, assignment.unitId, oldUserName, userEmail, assignment.role);
      await addPersonToUnit(batch, assignment.clientId, assignment.unitId, userName, userEmail, assignment.role);
      operationCount += 2;
    }
  }
  
  // Commit all changes atomically
  if (operationCount > 0) {
    await batch.commit();
    logDebug(`✅ [SYNC] Unit synchronization completed for user ${userId}`);
  }
}


/**
 * Handle name updates across all unit records (owners and managers)
 * @param {string} userId - User ID
 * @param {string} oldName - Previous name
 * @param {string} newName - New name
 * @param {string} userEmail - User's email
 * @param {Object} propertyAccess - User's client access data
 */
async function updateUserNameInUnits(userId, oldName, newName, userEmail, propertyAccess) {
  logDebug(`🔄 [NAME_UPDATE] Updating name from ${oldName} to ${newName} for user ${userId}`);
  
  const db = await getDb();
  const batch = db.batch();
  let operationCount = 0;
  
  // Get all unit assignments for this user
  const unitAssignments = getUnitAssignmentsFromAccess(propertyAccess);
  
  logDebug(`📋 [NAME_UPDATE] Unit assignments to update:`, unitAssignments);
  
  // Update name in all assigned units
  for (const assignment of unitAssignments) {
    logDebug(`🔄 [NAME_UPDATE] Updating ${assignment.role} name in ${assignment.clientId}/${assignment.unitId}`);
    await removePersonFromUnit(batch, assignment.clientId, assignment.unitId, oldName, userEmail, assignment.role);
    await addPersonToUnit(batch, assignment.clientId, assignment.unitId, newName, userEmail, assignment.role);
    operationCount += 2;
  }
  
  // Commit all changes atomically
  if (operationCount > 0) {
    logDebug(`💾 [NAME_UPDATE] Committing ${operationCount} name update operations...`);
    await batch.commit();
    logDebug(`✅ [NAME_UPDATE] Name updated successfully in all units for user ${userId}`);
  } else {
    logDebug(`ℹ️ [NAME_UPDATE] No name updates needed for user ${userId}`);
  }
}


/**
 * Create a new user with proper client assignment
 */
export async function createUser(req, res) {
  try {
    const { 
      email, 
      name, 
      role, 
      clientId, 
      unitId, 
      contactName,  // Optional: contact name for unit owners/managers array (defaults to name)
      contactEmail, // Optional: contact email for unit owners/managers array (defaults to email)
      customPermissions = [],
      creationMethod = 'manual', // 'invitation' or 'manual'
      // NEW FIELDS
      canLogin = true,  // Default true for backward compatibility
      profile = {},     // { firstName, lastName, phone, taxId, preferredLanguage, preferredCurrency }
      notifications = { email: true, sms: false, duesReminders: true }
    } = req.body;
    const creatingUser = req.user;

    // Validate required fields
    if (!email || !name || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, name, role' 
      });
    }
    
    // ClientId is required for non-SuperAdmin roles
    if (role !== 'superAdmin' && !clientId) {
      return res.status(400).json({ 
        error: 'ClientId is required for all roles except SuperAdmin' 
      });
    }

    // Validate role
    const validRoles = ['admin', 'unitOwner', 'unitManager', 'maintenance'];
    
    // Only SuperAdmin can create other SuperAdmins
    if (role === 'superAdmin') {
      if (!creatingUser.isSuperAdmin()) {
        return res.status(403).json({ 
          error: 'Only SuperAdmin can create other SuperAdmin users' 
        });
      }
      validRoles.push('superAdmin');
    }
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: admin, unitOwner, unitManager, maintenance, superAdmin (SuperAdmin only)' 
      });
    }

    // SuperAdmin can create users for any client
    // Admins can only create users for their assigned clients
    if (!creatingUser.isSuperAdmin()) {
      const propertyAccess = validateClientAccess(creatingUser, clientId);
      if (!propertyAccess.allowed) {
        return res.status(403).json({ error: propertyAccess.reason });
      }

      // Admins cannot create other admins or escalate privileges
      const userClientAccess = creatingUser.getPropertyAccess(clientId);
      if (userClientAccess?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Only admins can create users for their clients' 
        });
      }

      if (role === 'admin') {
        return res.status(403).json({ 
          error: 'Admins cannot create other admin users' 
        });
      }
    }

    try {
      let userRecord;
      let temporaryPassword = null;
      let accountState = 'active';
      
      if (!canLogin) {
        // Create disabled Firebase Auth user (contact-only)
        temporaryPassword = generateSecurePassword(); // Required but never used
        userRecord = await admin.auth().createUser({
          email: email,
          password: temporaryPassword,
          displayName: name,
          emailVerified: false,
          disabled: true  // KEY: Cannot log in
        });
        accountState = 'contact_only';
      } else if (creationMethod === 'invitation') {
        // Create user with temporary password for invitation flow (more reliable than disabled users)
        temporaryPassword = generateSecurePassword();
        userRecord = await admin.auth().createUser({
          email: email,
          password: temporaryPassword,
          displayName: name,
          emailVerified: false,
          disabled: false
        });
        accountState = 'pending_invitation';
      } else {
        // Create active user with temporary password for manual flow
        temporaryPassword = generateSecurePassword();
        userRecord = await admin.auth().createUser({
          email: email,
          password: temporaryPassword,
          displayName: name,
          emailVerified: false,
          disabled: false
        });
        accountState = 'pending_password_change';
      }

      // Create SAMS user profile
      const db = await getDb();
      
      // Set globalRole based on role
      let globalRole = 'user';
      let propertyAccessData = {};
      
      if (role === 'superAdmin') {
        globalRole = 'superAdmin';
        // SuperAdmins don't need specific client access - they have global access
        if (clientId && clientId !== 'ALL') {
          propertyAccessData[clientId] = {
            role: 'admin', // SuperAdmins show as admin in specific clients
            unitId: null,
            permissions: customPermissions,
            addedDate: getNow().toISOString(),
            addedBy: creatingUser.email
          };
        }
      } else {
        // Create propertyAccess with unitAssignments[] structure (current standard)
        propertyAccessData[clientId] = {
          role: role,
          unitId: unitId || null, // Keep for backward compatibility
          unitAssignments: unitId ? [{
            unitId: unitId,
            role: role,
            addedDate: getNow().toISOString(),
            addedBy: creatingUser.email
          }] : [],
          permissions: customPermissions,
          addedDate: getNow().toISOString(),
          addedBy: creatingUser.email
        };
      }
      
      const userProfile = {
        email: email,
        name: name,
        displayName: name,
        globalRole: globalRole,
        propertyAccess: propertyAccessData,
        preferredClient: role === 'superAdmin' ? null : clientId,
        isActive: true,
        canLogin: canLogin,  // NEW
        accountState: accountState,
        creationMethod: canLogin ? creationMethod : 'contact',
        mustChangePassword: canLogin,
        lastLoginDate: null,
        updated: admin.firestore.Timestamp.now(),
        // NEW: Profile object
        profile: {
          firstName: profile.firstName || name.split(' ')[0] || '',
          lastName: profile.lastName || name.split(' ').slice(1).join(' ') || '',
          phone: profile.phone || null,
          taxId: profile.taxId || null,
          preferredLanguage: profile.preferredLanguage || 'english',
          preferredCurrency: profile.preferredCurrency || 'MXN'
        },
        // NEW: Notifications object
        notifications: {
          email: notifications.email !== false,
          sms: notifications.sms === true,
          duesReminders: notifications.duesReminders !== false
        }
      };

      await db.collection('users').doc(userRecord.uid).set(userProfile);

      // Sync unit assignments for newly created user (both unitOwner and unitManager)
      if ((role === 'unitOwner' || role === 'unitManager') && clientId && unitId) {
        logDebug(`🔄 [CREATE] Syncing ${role} assignment for new user: ${name} → ${clientId}/${unitId}`);
        // For new users, oldClientAccess is empty
        // Use contactName/contactEmail if provided, otherwise use user name/email
        const unitContactName = contactName || name;
        const unitContactEmail = contactEmail || email;
        await syncUnitAssignments(userRecord.uid, {}, propertyAccessData, unitContactName, unitContactEmail);
      }

      // Send appropriate notification (only for login-enabled users)
      let emailResult = null;
      if (canLogin) {
        if (creationMethod === 'invitation') {
          // Send invitation email
          emailResult = await sendUserInvitation({
            email: email,
            name: name,
            clientName: clientId || 'System',
            role: role,
            invitedBy: creatingUser.email
          });
        } else {
          // Send password notification email
          emailResult = await sendPasswordNotification({
            email: email,
            name: name,
            password: temporaryPassword,
            clientName: clientId || 'System',
            role: role,
            createdBy: creatingUser.email
          });
        }
      }

      // Log user creation
      await writeAuditLog({
        module: 'user_management',
        action: 'user.created',
        parentPath: '/users',
        docId: userRecord.uid,
        friendlyName: `${name} (${email})`,
        notes: `Created user with ${creationMethod} method, role ${role} for client ${clientId || 'N/A'} by ${creatingUser.email}`
      });

      // Return success response
      const response = {
        success: true,
        user: {
          uid: userRecord.uid,
          email: email,
          name: name,
          role: role,
          clientId: clientId,
          unitId: unitId,
          accountState: accountState,
          creationMethod: creationMethod
        },
        emailSent: emailResult?.success || false
      };

      if (creationMethod === 'invitation') {
        response.message = 'User invitation sent successfully. They will receive an email to set up their password.';
      } else {
        response.temporaryPassword = temporaryPassword; // Only include for manual method
        response.message = 'User created successfully with temporary password. Email notification sent.';
      }

      res.status(201).json(response);

    } catch (firebaseError) {
      logError('Firebase user creation failed:', firebaseError);
      
      if (firebaseError.code === 'auth/email-already-exists') {
        return res.status(400).json({ 
          error: 'A user with this email already exists' 
        });
      }
      
      throw firebaseError;
    }

  } catch (error) {
    logError('Error creating user:', error);
    res.status(500).json({ 
      error: 'Failed to create user',
      details: error.message 
    });
  }
}

/**
 * Get list of users (with proper filtering based on access)
 */
export async function getUsers(req, res) {
  try {
    const requestingUser = req.user;
    const db = await getDb();
    const { clientId } = req.query; // Support optional clientId filter
    // admin is already imported at the top of the file

    logDebug(`🔍 getUsers called - clientId: ${clientId}, user: ${requestingUser.email}, isSuperAdmin: ${requestingUser.isSuperAdmin()}`);

    let usersQuery = db.collection('users');
    let users = [];

    if (requestingUser.isSuperAdmin()) {
      // SuperAdmin can see all users
      const snapshot = await usersQuery.get();
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logDebug(`📊 Total users in Firestore: ${allUsers.length}`);
      
      if (clientId) {
        // Filter by clientId if provided
        users = allUsers.filter(user => {
          const hasAccess = user.propertyAccess?.[clientId] != null;
          if (!hasAccess && user.email) {
            logDebug(`  ⚠️  User ${user.email} (${user.id}) does not have propertyAccess for ${clientId}`);
          }
          return hasAccess;
        });
        logDebug(`✅ Users with propertyAccess to ${clientId}: ${users.length}`);
      } else {
        users = allUsers;
      }
    } else {
      // Regular users can only see users from their assigned clients
      const snapshot = await usersQuery.get();
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter users to only those in shared clients
      let filteredUsers = allUsers.filter(user => {
        if (!user.propertyAccess) return false;
        
        const userClients = Object.keys(user.propertyAccess);
        const requestingUserClients = Object.keys(requestingUser.samsProfile?.propertyAccess || {});
        
        // Check if there's any overlap in client access
        return userClients.some(clientId => requestingUserClients.includes(clientId));
      });
      
      // If clientId filter is provided, further filter by that client
      if (clientId) {
        filteredUsers = filteredUsers.filter(user => user.propertyAccess?.[clientId] != null);
      }
      
      users = filteredUsers;
    }

    // Enhance users with Firebase Auth metadata (including lastSignInTime)
    // Note: Users without Firebase Auth records are still returned (orphaned Firestore docs)
    const enhancedUsers = await Promise.all(users.map(async (user) => {
      try {
        const authUser = await admin.auth().getUser(user.id);
        return {
          ...user,
          firebaseMetadata: {
            lastSignInTime: authUser.metadata.lastSignInTime,
            creationTime: authUser.metadata.creationTime,
            lastRefreshTime: authUser.metadata.lastRefreshTime
          }
        };
      } catch (authError) {
        // If Firebase Auth user doesn't exist, return user without metadata
        // This is OK - user exists in Firestore but Auth record was deleted (orphaned user)
        logDebug(`Firebase Auth user not found for user ID ${user.id} (${user.email || 'no email'}):`, authError.message);
        return {
          ...user,
          firebaseMetadata: {
            lastSignInTime: null,
            creationTime: null,
            lastRefreshTime: null
          }
        };
      }
    }));

    // Sanitize user data based on requesting user's permissions
    const sanitizedUsers = enhancedUsers.map(user => sanitizeUserData(user, requestingUser));

    logDebug(`✅ Returning ${sanitizedUsers.length} users (clientId filter: ${clientId || 'none'})`);
    if (clientId && sanitizedUsers.length === 0) {
      logWarn(`⚠️  No users found with propertyAccess for clientId: ${clientId}`);
      logWarn(`   This might mean users exist but don't have propertyAccess[${clientId}] set up`);
    }

    res.json({
      success: true,
      users: sanitizedUsers,
      total: sanitizedUsers.length
    });

  } catch (error) {
    logError('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
}

/**
 * Update user profile and permissions
 */
export async function updateUser(req, res) {
  try {
    const { userId } = req.params;
    const { 
      name, 
      propertyAccess, 
      isActive, 
      globalRole, 
      resetPassword, 
      newPassword, 
      requirePasswordChange,
      // NEW FIELDS
      canLogin,      // Toggle login ability
      profile,       // Profile updates
      notifications  // Notification preferences
    } = req.body;
    const updatingUser = req.user;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUserData = userDoc.data();

    // Users can update their own basic profile
    if (userId === updatingUser.uid) {
      // Allow self-update of basic fields only
      const allowedUpdates = { 
        name,
        isActive
      };
      
      // SuperAdmin can update their own global role
      if (updatingUser.isSuperAdmin() && globalRole) {
        allowedUpdates.globalRole = globalRole;
      }
      
      await db.collection('users').doc(userId).update({
        ...allowedUpdates,
        lastModifiedDate: getNow().toISOString(),
        lastModifiedBy: updatingUser.email
      });

      // Handle password reset for self
      if (resetPassword) {
        try {
          const passwordToSet = newPassword || generateSecurePassword();
          await admin.auth().updateUser(userId, {
            password: passwordToSet,
            disabled: false
          });
          
          // Also update Firestore profile to ensure user is active
          const selfProfileUpdate = {
            isActive: true,
            lastModifiedDate: getNow().toISOString(),
            lastModifiedBy: updatingUser.email
          };
          
          // Only require password change if password was auto-generated
          if (!newPassword) {
            selfProfileUpdate.accountState = 'pending_password_change';
            selfProfileUpdate.mustChangePassword = true;
          } else {
            selfProfileUpdate.accountState = 'active';
            selfProfileUpdate.mustChangePassword = false;
          }
          
          await db.collection('users').doc(userId).update(selfProfileUpdate);
          
          res.json({
            success: true,
            message: 'Profile updated successfully',
            passwordChanged: true,
            newPassword: newPassword ? undefined : passwordToSet // Only return if auto-generated
          });
          return;
        } catch (passwordError) {
          logError('Failed to reset password:', passwordError);
          res.json({
            success: true,
            message: 'Profile updated but password reset failed',
            passwordError: passwordError.message
          });
          return;
        }
      }

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
      return;
    }

    // Only SuperAdmin or admins can update other users
    if (!updatingUser.isSuperAdmin()) {
      // Check if updating user is admin for any of the target user's clients
      const targetUserClients = Object.keys(currentUserData.propertyAccess || {});
      const hasAdminRights = targetUserClients.some(clientId => {
        const access = updatingUser.getPropertyAccess(clientId);
        return access?.role === 'admin';
      });

      if (!hasAdminRights) {
        return res.status(403).json({ 
          error: 'Insufficient permissions to update this user' 
        });
      }
    }

    // Prepare update data
    const updateData = {
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: updatingUser.email
    };

    // Handle name changes with manager synchronization
    const nameChanged = name && name !== currentUserData.name;
    if (name) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Handle global role updates (SuperAdmin only)
    if (globalRole && updatingUser.isSuperAdmin()) {
      updateData.globalRole = globalRole;
    }
    
    // Handle client access updates and sync manager assignments
    if (propertyAccess) {
      logDebug(`🔄 [UPDATE] Processing propertyAccess update for user ${userId}`);
      logDebug(`👤 [UPDATE] Updating user: ${updatingUser.email}, isSuperAdmin: ${updatingUser.isSuperAdmin()}`);
      
      // Only SuperAdmin can update propertyAccess, but we also sync manager assignments
      if (updatingUser.isSuperAdmin()) {
        // Synchronize manager assignments if propertyAccess is being updated
        const oldClientAccess = currentUserData.propertyAccess;
        const newClientAccess = propertyAccess;
        const userName = updateData.name || currentUserData.name;
        const oldUserName = nameChanged ? currentUserData.name : null;
        
        logDebug(`🔄 [UPDATE] Calling syncUnitAssignments...`);
        
        // Sync manager assignments between user roles and unit records
        const userEmail = currentUserData.email || 'unknown@example.com';
        await syncUnitAssignments(userId, oldClientAccess, newClientAccess, userName, userEmail, oldUserName);
        
        updateData.propertyAccess = propertyAccess;
        logDebug(`✅ [UPDATE] ClientAccess updated and synchronized`);
      } else {
        logDebug(`❌ [UPDATE] Non-SuperAdmin attempted to update propertyAccess`);
        return res.status(403).json({ 
          error: 'Only SuperAdmin can update client access' 
        });
      }
    }
    
    // Handle name changes for existing managers (when only name is updated)
    if (nameChanged && !propertyAccess && currentUserData.propertyAccess) {
      const userEmail = currentUserData.email || 'unknown@example.com';
      await updateUserNameInUnits(userId, currentUserData.name, name, userEmail, currentUserData.propertyAccess);
    }

    // Handle canLogin toggle (enable/disable Firebase Auth)
    if (canLogin !== undefined && canLogin !== currentUserData.canLogin) {
      if (canLogin) {
        // Promoting contact to user - enable Auth and send password reset
        await admin.auth().updateUser(userId, { disabled: false });
        
        // Generate temporary password and send notification
        const tempPassword = generateSecurePassword();
        await admin.auth().updateUser(userId, { password: tempPassword });
        
        await sendPasswordNotification({
          email: currentUserData.email,
          name: currentUserData.name,
          password: tempPassword,
          clientName: Object.keys(currentUserData.propertyAccess || {})[0] || 'System',
          role: currentUserData.globalRole || 'user',
          createdBy: updatingUser.email
        });
        
        updateData.canLogin = true;
        updateData.accountState = 'pending_password_change';
        updateData.mustChangePassword = true;
        
        // Log promotion
        await writeAuditLog({
          module: 'user_management',
          action: 'user.promoted_to_login',
          parentPath: '/users',
          docId: userId,
          friendlyName: `${currentUserData.name} promoted to login user`,
          notes: `Contact promoted to login user by ${updatingUser.email}`
        });
      } else {
        // Demoting user to contact - disable Auth
        await admin.auth().updateUser(userId, { disabled: true });
        updateData.canLogin = false;
        updateData.accountState = 'contact_only';
        
        await writeAuditLog({
          module: 'user_management',
          action: 'user.demoted_to_contact',
          parentPath: '/users',
          docId: userId,
          friendlyName: `${currentUserData.name} demoted to contact`,
          notes: `User demoted to contact-only by ${updatingUser.email}`
        });
      }
    }

    // Handle profile updates
    if (profile) {
      updateData.profile = {
        ...(currentUserData.profile || {}),
        ...profile
      };
    }

    // Handle notification preference updates
    if (notifications) {
      updateData.notifications = {
        ...(currentUserData.notifications || {}),
        ...notifications
      };
    }

    // Handle require password change if requested
    if (requirePasswordChange !== undefined) {
      updateData.mustChangePassword = requirePasswordChange;
      updateData.accountState = requirePasswordChange ? 'pending_password_change' : 'active';
      
      // Log password change requirement update
      await writeAuditLog({
        module: 'user_management',
        action: 'user.password_change_required',
        parentPath: '/users',
        docId: userId,
        friendlyName: `Password change requirement for ${currentUserData.name || currentUserData.email}`,
        notes: `Password change requirement ${requirePasswordChange ? 'enabled' : 'disabled'} by ${updatingUser.email}`
      });
    }

    await db.collection('users').doc(userId).update(updateData);

    // Handle password reset if requested
    if (resetPassword) {
      try {
        const passwordToSet = newPassword || generateSecurePassword();
        await admin.auth().updateUser(userId, {
          password: passwordToSet,
          disabled: false // Ensure user is enabled when resetting password
        });
        
        // Update Firestore profile to ensure user is active
        const profileUpdate = {
          isActive: true,
          lastModifiedDate: getNow().toISOString(),
          lastModifiedBy: updatingUser.email
        };
        
        // Only require password change if password was auto-generated
        if (!newPassword) {
          profileUpdate.accountState = 'pending_password_change';
          profileUpdate.mustChangePassword = true;
        } else {
          profileUpdate.accountState = 'active';
          profileUpdate.mustChangePassword = false;
        }
        
        await db.collection('users').doc(userId).update(profileUpdate);
        
        // Send email notification for password reset
        logDebug('🔄 Attempting to send password reset notification to:', currentUserData.email);
        try {
          const emailResult = await sendPasswordNotification({
            email: currentUserData.email,
            name: currentUserData.name || currentUserData.email,
            password: passwordToSet,
            clientName: 'System',
            role: currentUserData.globalRole || 'user',
            createdBy: updatingUser.email
          });
          logDebug('✅ Password reset notification result:', emailResult);
          logDebug('✅ Password reset notification sent to:', currentUserData.email);
        } catch (emailError) {
          logError('❌ Failed to send password reset notification:', emailError);
          logError('❌ Email error details:', emailError.message);
          logError('❌ Email error stack:', emailError.stack);
          // Don't fail the password reset if email fails
        }

        // Log password reset
        await writeAuditLog({
          module: 'user_management',
          action: 'user.password_reset',
          parentPath: '/users',
          docId: userId,
          friendlyName: `Password reset for ${currentUserData.name || currentUserData.email}`,
          notes: `Password reset by ${updatingUser.email}, auto-generated: ${!newPassword}, email sent: ${currentUserData.email}`
        });
        
        res.json({
          success: true,
          message: 'User updated successfully. Password reset email sent.',
          passwordChanged: true,
          newPassword: newPassword ? undefined : passwordToSet // Only return if auto-generated
        });
        return;
      } catch (passwordError) {
        logError('Failed to reset password:', passwordError);
        // Continue with regular update response even if password failed
        updateData.passwordResetFailed = true;
      }
    }

    // Log the update
    await writeAuditLog({
      module: 'user_management',
      action: 'user.updated',
      parentPath: '/users',
      docId: userId,
      friendlyName: `${currentUserData.name || currentUserData.email}`,
      notes: `Updated fields: ${Object.keys(updateData).join(', ')} by ${updatingUser.email}`
    });

    res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error) {
    logError('Error updating user:', error);
    logError('Error stack:', error.stack);
    logError('Error details:', {
      userId: req.params.userId,
      updateDataKeys: Object.keys(req.body || {}),
      errorName: error.name,
      errorMessage: error.message
    });
    res.status(500).json({ 
      error: 'Failed to update user',
      details: error.message 
    });
  }
}

/**
 * Add client access to user
 */
export async function addClientAccess(req, res) {
  try {
    const { userId } = req.params;
    const { clientId, role, unitId } = req.body;
    const assigningUser = req.user;

    // Validate inputs
    if (!userId || !clientId || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, clientId, role' 
      });
    }

    // Only SuperAdmin or admins can assign client access
    if (!assigningUser.isSuperAdmin()) {
      const propertyAccess = validateClientAccess(assigningUser, clientId);
      if (!propertyAccess.allowed) {
        return res.status(403).json({ error: propertyAccess.reason });
      }

      const userClientAccess = assigningUser.getPropertyAccess(clientId);
      if (userClientAccess?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Only admins can assign client access' 
        });
      }
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const updatedClientAccess = {
      ...userData.propertyAccess,
      [clientId]: {
        role: role,
        unitId: unitId || null,
        permissions: [],
        addedDate: getNow().toISOString(),
        addedBy: assigningUser.email
      }
    };

    await db.collection('users').doc(userId).update({
      propertyAccess: updatedClientAccess,
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: assigningUser.email
    });

    // Log the access assignment
    await writeAuditLog({
      module: 'user_management',
      action: 'user.client_access_added',
      parentPath: '/users',
      docId: userId,
      friendlyName: `Client access added for ${userData.name || userData.email}`,
      notes: `Added ${role} access to ${clientId}${unitId ? ` (unit: ${unitId})` : ''} by ${assigningUser.email}`
    });

    res.json({
      success: true,
      message: `Client access granted for ${clientId}`
    });

  } catch (error) {
    logError('Error adding client access:', error);
    res.status(500).json({ 
      error: 'Failed to add client access',
      details: error.message 
    });
  }
}

/**
 * Remove client access from user
 */
export async function removeClientAccess(req, res) {
  try {
    const { userId, clientId } = req.params;
    const removingUser = req.user;

    // Only SuperAdmin or admins can remove client access
    if (!removingUser.isSuperAdmin()) {
      const propertyAccess = validateClientAccess(removingUser, clientId);
      if (!propertyAccess.allowed) {
        return res.status(403).json({ error: propertyAccess.reason });
      }

      const userClientAccess = removingUser.getPropertyAccess(clientId);
      if (userClientAccess?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Only admins can remove client access' 
        });
      }
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const updatedClientAccess = { ...userData.propertyAccess };
    delete updatedClientAccess[clientId];

    await db.collection('users').doc(userId).update({
      propertyAccess: updatedClientAccess,
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: removingUser.email
    });

    // Log the access removal
    await writeAuditLog({
      module: 'user_management',
      action: 'user.client_access_removed',
      parentPath: '/users',
      docId: userId,
      friendlyName: `Client access removed for ${userData.name || userData.email}`,
      notes: `Removed access to ${clientId} by ${removingUser.email}`
    });

    res.json({
      success: true,
      message: `Client access removed for ${clientId}`
    });

  } catch (error) {
    logError('Error removing client access:', error);
    res.status(500).json({ 
      error: 'Failed to remove client access',
      details: error.message 
    });
  }
}

/**
 * Update user propertyAccess for a specific client
 * Used to sync unitId when units are assigned/removed
 */
export async function updateUserPropertyAccess(req, res) {
  try {
    const { userId, clientId } = req.params;
    const { role, unitId } = req.body;
    const updatingUser = req.user;

    // Validate inputs
    if (!userId || !clientId) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, clientId' 
      });
    }

    // Only SuperAdmin or admins can update propertyAccess
    if (!updatingUser.isSuperAdmin()) {
      const propertyAccess = validateClientAccess(updatingUser, clientId);
      if (!propertyAccess.allowed) {
        return res.status(403).json({ error: propertyAccess.reason });
      }

      const userClientAccess = updatingUser.getPropertyAccess(clientId);
      if (userClientAccess?.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Only admins can update property access' 
        });
      }
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Ensure propertyAccess exists
    const currentPropertyAccess = userData.propertyAccess || {};
    const currentClientAccess = currentPropertyAccess[clientId] || {};
    
    // Build update data
    const updateData = {};
    if (role !== undefined) {
      updateData[`propertyAccess.${clientId}.role`] = role;
    }
    if (unitId !== undefined) {
      updateData[`propertyAccess.${clientId}.unitId`] = unitId;
    }
    
    // Preserve other fields in propertyAccess[clientId]
    if (!updateData[`propertyAccess.${clientId}.role`] && currentClientAccess.role) {
      updateData[`propertyAccess.${clientId}.role`] = currentClientAccess.role;
    }
    if (!updateData[`propertyAccess.${clientId}.unitId`] && currentClientAccess.unitId) {
      updateData[`propertyAccess.${clientId}.unitId`] = currentClientAccess.unitId;
    }
    if (currentClientAccess.permissions) {
      updateData[`propertyAccess.${clientId}.permissions`] = currentClientAccess.permissions;
    }
    if (currentClientAccess.addedDate) {
      updateData[`propertyAccess.${clientId}.addedDate`] = currentClientAccess.addedDate;
    }
    if (currentClientAccess.addedBy) {
      updateData[`propertyAccess.${clientId}.addedBy`] = currentClientAccess.addedBy;
    }

    // Add lastModifiedDate if not present
    updateData.lastModifiedDate = getNow().toISOString();
    updateData.lastModifiedBy = updatingUser.email;

    await db.collection('users').doc(userId).update(updateData);

    // Log the access update
    await writeAuditLog({
      module: 'user_management',
      action: 'user.property_access_updated',
      parentPath: '/users',
      docId: userId,
      friendlyName: `Property access updated for ${userData.name || userData.email}`,
      notes: `Updated propertyAccess for ${clientId}${role ? ` (role: ${role})` : ''}${unitId !== undefined ? ` (unitId: ${unitId || 'cleared'})` : ''} by ${updatingUser.email}`
    });

    res.json({
      success: true,
      message: `Property access updated for ${clientId}`
    });

  } catch (error) {
    logError('Error updating property access:', error);
    res.status(500).json({ 
      error: 'Failed to update property access',
      details: error.message 
    });
  }
}

/**
 * Add unit role assignment to user (supports different roles per unit)
 */
export async function addUnitRoleAssignment(req, res) {
  try {
    const { userId } = req.params;
    const { clientId, unitId, role, contactName, contactEmail } = req.body;
    const assigningUser = req.user;

    // Validate inputs
    if (!userId || !clientId || !unitId || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, clientId, unitId, role' 
      });
    }

    // Validate role
    const validRoles = ['unitOwner', 'unitManager'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be unitOwner or unitManager' 
      });
    }

    // Only SuperAdmin can modify unit role assignments
    if (!assigningUser.isSuperAdmin()) {
      return res.status(403).json({ 
        error: 'Only SuperAdmin can modify unit role assignments' 
      });
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const currentClientAccess = userData.propertyAccess || {};
    const updatedClientAccess = JSON.parse(JSON.stringify(currentClientAccess)); // Deep copy

    // Initialize client access if it doesn't exist
    if (!updatedClientAccess[clientId]) {
      updatedClientAccess[clientId] = {
        role: 'user', // Default role
        unitAssignments: [],
        addedDate: getNow().toISOString(),
        addedBy: assigningUser.email
      };
    }

    // Ensure unitAssignments array exists
    if (!updatedClientAccess[clientId].unitAssignments) {
      updatedClientAccess[clientId].unitAssignments = [];
    }

    // Check if this unit assignment already exists
    const existingAssignment = updatedClientAccess[clientId].unitAssignments.find(
      assignment => assignment.unitId === unitId
    );

    if (existingAssignment) {
      // Update existing assignment
      existingAssignment.role = role;
      existingAssignment.lastModifiedDate = getNow().toISOString();
      existingAssignment.lastModifiedBy = assigningUser.email;
    } else {
      // Add new assignment
      updatedClientAccess[clientId].unitAssignments.push({
        unitId: unitId,
        role: role,
        addedDate: getNow().toISOString(),
        addedBy: assigningUser.email
      });
    }

    // Update user record
    await db.collection('users').doc(userId).update({
      propertyAccess: updatedClientAccess,
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: assigningUser.email
    });

    // Sync unit assignments to unit records (for all roles: owners and managers)
    // Use contactName/contactEmail if provided, otherwise use user name/email
    const unitContactName = contactName || userData.name;
    const unitContactEmail = contactEmail || userData.email;
    await syncUnitAssignments(userId, currentClientAccess, updatedClientAccess, unitContactName, unitContactEmail);

    // Log the assignment
    await writeAuditLog({
      module: 'user_management',
      action: 'user.unit_role_assignment_added',
      parentPath: '/users',
      docId: userId,
      friendlyName: `Unit role assignment added for ${userData.name || userData.email}`,
      notes: `Added ${role} assignment for ${clientId}/${unitId} by ${assigningUser.email}`
    });

    res.json({
      success: true,
      message: `Unit role assignment added: ${role} for ${clientId}/${unitId}`
    });

  } catch (error) {
    logError('Error adding unit role assignment:', error);
    res.status(500).json({ 
      error: 'Failed to add unit role assignment',
      details: error.message 
    });
  }
}

/**
 * Remove unit role assignment from user
 */
export async function removeUnitRoleAssignment(req, res) {
  try {
    const { userId } = req.params;
    const { clientId, unitId } = req.body;
    const removingUser = req.user;

    // Validate inputs
    if (!userId || !clientId || !unitId) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, clientId, unitId' 
      });
    }

    // Only SuperAdmin can modify unit role assignments
    if (!removingUser.isSuperAdmin()) {
      return res.status(403).json({ 
        error: 'Only SuperAdmin can modify unit role assignments' 
      });
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const currentClientAccess = userData.propertyAccess || {};
    const updatedClientAccess = JSON.parse(JSON.stringify(currentClientAccess)); // Deep copy

    // Check if user has access to this client
    if (!updatedClientAccess[clientId]) {
      return res.status(400).json({ 
        error: 'User does not have access to this client' 
      });
    }

    // Check if unitAssignments exists
    if (!updatedClientAccess[clientId].unitAssignments) {
      return res.status(400).json({ 
        error: 'No unit assignments found for this client' 
      });
    }

    // Find and get the role before removing (for manager sync)
    const assignmentToRemove = updatedClientAccess[clientId].unitAssignments.find(
      assignment => assignment.unitId === unitId
    );

    if (!assignmentToRemove) {
      return res.status(400).json({ 
        error: 'Unit assignment not found' 
      });
    }

    const wasManager = assignmentToRemove.role === 'unitManager';

    // Remove the assignment
    updatedClientAccess[clientId].unitAssignments = updatedClientAccess[clientId].unitAssignments.filter(
      assignment => assignment.unitId !== unitId
    );

    // If no unit assignments left, keep the client access but remove the array
    if (updatedClientAccess[clientId].unitAssignments.length === 0) {
      delete updatedClientAccess[clientId].unitAssignments;
    }

    // Update user record
    await db.collection('users').doc(userId).update({
      propertyAccess: updatedClientAccess,
      lastModifiedDate: getNow().toISOString(),
      lastModifiedBy: removingUser.email
    });

    // Sync unit assignments to unit records (for all roles: owners and managers)
    await syncUnitAssignments(userId, currentClientAccess, updatedClientAccess, userData.name, userData.email);

    // Log the removal
    await writeAuditLog({
      module: 'user_management',
      action: 'user.unit_role_assignment_removed',
      parentPath: '/users',
      docId: userId,
      friendlyName: `Unit role assignment removed for ${userData.name || userData.email}`,
      notes: `Removed ${assignmentToRemove.role} assignment for ${clientId}/${unitId} by ${removingUser.email}`
    });

    res.json({
      success: true,
      message: `Unit role assignment removed for ${clientId}/${unitId}`
    });

  } catch (error) {
    logError('Error removing unit role assignment:', error);
    res.status(500).json({ 
      error: 'Failed to remove unit role assignment',
      details: error.message 
    });
  }
}

// REMOVED: Legacy addManagerAssignment and removeManagerAssignment functions
// These have been replaced by addUnitRoleAssignment and removeUnitRoleAssignment
// which provide the same functionality with better structure and no legacy compatibility code

/**
 * Delete user (SuperAdmin only)
 */
export async function deleteUser(req, res) {
  try {
    const { userId } = req.params;
    const deletingUser = req.user;

    // Only SuperAdmin can delete users
    if (!deletingUser.isSuperAdmin()) {
      return res.status(403).json({ 
        error: 'Only SuperAdmin can delete users' 
      });
    }

    // Prevent self-deletion
    if (userId === deletingUser.uid) {
      return res.status(400).json({ 
        error: 'Cannot delete your own account' 
      });
    }

    const db = await getDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Clean up manager references in unit records if user was a manager
    if (userData.propertyAccess) {
      const userEmail = userData.email || 'unknown@example.com';
      await updateUserNameInUnits(userId, userData.name, '', userEmail, userData.propertyAccess);
    }

    // Delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete from Firestore
    await db.collection('users').doc(userId).delete();

    // Log the deletion
    await writeAuditLog({
      module: 'user_management',
      action: 'user.deleted',
      parentPath: '/users',
      docId: userId,
      friendlyName: `${userData.name || userData.email}`,
      notes: `User deleted by ${deletingUser.email}`
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logError('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      details: error.message 
    });
  }
}