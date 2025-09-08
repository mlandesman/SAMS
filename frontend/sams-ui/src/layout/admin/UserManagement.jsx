/**
 * User Management Component
 * Phase 8: User Access Control System - Task 8.3
 * 
 * Provides comprehensive user management interface with proper security controls
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClient } from '../../context/ClientContext';
import { PermissionGuard, AdminGuard, SuperAdminGuard } from '../security/PermissionGuard';
import { hasPermission, getUserClientRole, USER_ROLES } from '../../utils/userRoles';
import { useSecureApi } from '../../api/secureApiClient';
import { getUnits } from '../../api/units';
import { LoadingSpinner } from '../common';
import './UserManagement.css';

const UserManagement = ({ 
  onSelectionChange, 
  onItemCountChange,
  refreshTrigger 
}) => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  const secureApi = useSecureApi();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Load users on component mount and refresh trigger
  useEffect(() => {
    loadUsers();
  }, [selectedClient, refreshTrigger]);

  // Handle selection change callback
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedUser);
    }
  }, [selectedUser, onSelectionChange]);

  // Handle item count change callback  
  useEffect(() => {
    if (onItemCountChange) {
      onItemCountChange(users.length);
    }
  }, [users.length, onItemCountChange]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await secureApi.getSystemUsers();
      setUsers(response.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      await secureApi.createUser(userData);
      loadUsers(); // Refresh the list
    } catch (err) {
      console.error('Failed to create user:', err);
      setError(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId, updateData) => {
    try {
      const result = await secureApi.updateUser(userId, updateData);
      
      setSelectedUser(null);
      loadUsers(); // Refresh the list
      
      // Return the result so the modal can handle success messages
      return result;
    } catch (err) {
      console.error('Failed to update user:', err);
      setError(err.message || 'Failed to update user');
      throw err; // Re-throw so the modal can handle the error
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await secureApi.deleteUser(userId);
      setSelectedUser(null);
      loadUsers(); // Refresh the list
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err.message || 'Failed to delete user');
    }
  };


  const canManageUser = (user) => {
    if (!samsUser || !selectedClient) return false;
    
    // SuperAdmin can manage all users
    if (samsUser.email === 'michael@landesman.com' || samsUser.globalRole === 'superAdmin') {
      return true;
    }

    // Admins can manage users in their assigned clients
    const userRole = getUserClientRole(samsUser, selectedClient.id);
    if (userRole === 'admin') {
      // Check if the target user has access to the same client
      return user.propertyAccess && selectedClient.id in user.propertyAccess;
    }

    return false;
  };

  if (loading) {
    return <LoadingSpinner variant="logo" message="Loading users..." size="medium" />;
  }

  return (
    <PermissionGuard permission="users.view" fallback={
      <div className="access-denied">
        <h3>Access Denied</h3>
        <p>You don't have permission to view user management.</p>
      </div>
    }>
      <div className="user-management">
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <div className="users-list">
          {users.length === 0 ? (
            <div className="no-users">
              <p>No users found.</p>
            </div>
          ) : (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Global Role</th>
                    <th>Property Access</th>
                    <th>Status</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <UserRow 
                      key={user.id}
                      user={user}
                      canManage={canManageUser(user)}
                      isSelected={selectedUser?.id === user.id}
                      onSelect={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                      currentUser={samsUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

/**
 * Get user's display role (handles SuperAdmin detection)
 */
const getUserDisplayRole = (user) => {
  // Check if user is SuperAdmin by email first
  if (user.email === 'michael@landesman.com') {
    return 'SuperAdmin';
  }
  
  // Check globalRole field
  if (user.globalRole === 'superAdmin') {
    return 'SuperAdmin';
  }
  
  // For other global roles, capitalize them properly
  if (user.globalRole === 'admin') {
    return 'Admin';
  }
  
  if (user.globalRole === 'unitOwner') {
    return 'Unit Owner';
  }
  
  if (user.globalRole === 'unitManager') {
    return 'Unit Manager';
  }
  
  // Default to 'User' for regular users
  return 'User';
};

/**
 * User Row Component  
 */
const UserRow = ({ user, canManage, isSelected, onSelect, currentUser }) => {
  const formatPropertyAccess = (propertyAccess) => {
    if (!propertyAccess) return 'None';
    
    return Object.entries(propertyAccess).map(([clientId, access]) => (
      <span key={clientId} className="client-access-badge">
        {clientId}: {access.role}
        {access.unitId && ` (${access.unitId})`}
      </span>
    ));
  };

  const getAllUnitAssignments = (user) => {
    const assignments = [];
    Object.entries(user.propertyAccess || {}).forEach(([clientId, access]) => {
      // Handle new unitAssignments structure
      if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
        access.unitAssignments.forEach(assignment => {
          if (assignment.unitId && assignment.role) {
            assignments.push({
              clientId,
              unitId: assignment.unitId,
              role: assignment.role,
              display: `${clientId}: ${assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${assignment.unitId}`
            });
          }
        });
      } else {
        // Handle legacy structure for backward compatibility
        if (access.role === 'unitManager' || access.role === 'unitOwner') {
          // Primary assignment
          if (access.unitId) {
            assignments.push({
              clientId,
              unitId: access.unitId,
              role: access.role,
              display: `${clientId}: ${access.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${access.unitId}`
            });
          }
          
          // Additional assignments (legacy)
          if (access.additionalAssignments && Array.isArray(access.additionalAssignments)) {
            access.additionalAssignments
              .filter(assignment => (assignment.role === 'unitManager' || assignment.role === 'unitOwner') && assignment.unitId)
              .forEach(assignment => {
                assignments.push({
                  clientId,
                  unitId: assignment.unitId,
                  role: assignment.role,
                  display: `${clientId}: ${assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${assignment.unitId}`
                });
              });
          }
        }
      }
    });
    return assignments;
  };

  const getManagerAssignments = (user) => {
    return getAllUnitAssignments(user)
      .filter(assignment => assignment.role === 'unitManager')
      .map(assignment => assignment.display);
  };

  const formatLastLogin = (user) => {
    const lastSignInTime = user.firebaseMetadata?.lastSignInTime;
    if (!lastSignInTime) return 'Never';
    
    const lastLogin = new Date(lastSignInTime);
    const now = new Date();
    const diffMs = now - lastLogin;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    // Show relative time for recent logins
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      const days = Math.floor(diffDays);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else {
      return lastLogin.toLocaleDateString();
    }
  };

  const isCurrentUser = user.id === currentUser?.uid;
  const allUnitAssignments = getAllUnitAssignments(user);
  const managerAssignments = allUnitAssignments.filter(a => a.role === 'unitManager');
  const ownerAssignments = allUnitAssignments.filter(a => a.role === 'unitOwner');

  return (
    <tr 
      className={`user-row ${!user.isActive ? 'inactive' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <td className="user-name">
        {user.name}
        {isCurrentUser && <span className="current-user-badge">You</span>}
        {(ownerAssignments.length > 0 || managerAssignments.length > 0) && (
          <div className="unit-assignments">
            {ownerAssignments.length > 0 && (
              <small style={{ color: '#2e7d32', display: 'block', fontWeight: 'bold' }}>
                Owns: {ownerAssignments.map(a => a.display).join(', ')}
              </small>
            )}
            {managerAssignments.length > 0 && (
              <small style={{ color: '#1565c0', display: 'block' }}>
                Manages: {managerAssignments.map(a => a.display).join(', ')}
              </small>
            )}
          </div>
        )}
      </td>
      <td className="user-email">{user.email}</td>
      <td className="user-global-role">
        <span className={`role-badge ${getUserDisplayRole(user)}`}>
          {getUserDisplayRole(user)}
        </span>
      </td>
      <td className="user-client-access">
        {formatPropertyAccess(user.propertyAccess)}
      </td>
      <td className="user-status">
        <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="user-last-login" title={user.firebaseMetadata?.lastSignInTime ? new Date(user.firebaseMetadata.lastSignInTime).toLocaleString() : 'Never logged in'}>
        {formatLastLogin(user)}
      </td>
    </tr>
  );
};

/**
 * Create User Modal Component
 */
const CreateUserModal = ({ onClose, onCreate, currentUser, selectedClient }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'unitOwner',
    clientId: selectedClient?.id || '',
    unitId: '',
    creationMethod: 'invitation' // 'invitation' or 'manual'
  });
  const [submitting, setSubmitting] = useState(false);
  const [creationResult, setCreationResult] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Fetch units when client ID or role changes for unit-specific roles
  useEffect(() => {
    const fetchUnitsForClient = async () => {
      if (!formData.clientId || !['unitOwner', 'unitManager'].includes(formData.role)) {
        console.log('🔍 [CREATE] Not fetching units - clientId:', formData.clientId, 'role:', formData.role);
        setAvailableUnits([]);
        return;
      }

      console.log('📋 [CREATE] Fetching units for client:', formData.clientId, 'role:', formData.role);
      setLoadingUnits(true);
      try {
        const response = await getUnits(formData.clientId);
        console.log('✅ [CREATE] Units response received:', response);
        setAvailableUnits(response.data || []);
      } catch (error) {
        console.error('❌ [CREATE] Failed to fetch units:', error);
        console.error('❌ [CREATE] Error details:', error.message);
        setAvailableUnits([]);
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnitsForClient();
  }, [formData.clientId, formData.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setCreationResult(null);

    try {
      const result = await onCreate(formData);
      setCreationResult(result);
      
      // For manual password method, show the temporary password
      if (formData.creationMethod === 'manual' && result.temporaryPassword) {
        // Keep modal open to show password
        return;
      }
      
      // For invitation method, close modal immediately
      if (formData.creationMethod === 'invitation') {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Create user failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isSuperAdmin = currentUser?.email === 'michael@landesman.com' || 
                       currentUser?.globalRole === 'superAdmin';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New User</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="user-form">
          {/* Creation Method Selection */}
          <div className="form-group">
            <label>Account Setup Method:</label>
            <div className="creation-method-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="creationMethod"
                  value="invitation"
                  checked={formData.creationMethod === 'invitation'}
                  onChange={(e) => setFormData({...formData, creationMethod: e.target.value})}
                />
                <span className="radio-label">
                  <strong>📧 Email Invitation</strong>
                  <small>User receives secure link to set their own password</small>
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="creationMethod"
                  value="manual"
                  checked={formData.creationMethod === 'manual'}
                  onChange={(e) => setFormData({...formData, creationMethod: e.target.value})}
                />
                <span className="radio-label">
                  <strong>🔑 Manual Password</strong>
                  <small>Generate temporary password (for tech-averse users)</small>
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role:</label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              required
            >
              <option value="unitOwner">Unit Owner</option>
              <option value="unitManager">Unit Manager</option>
              {isSuperAdmin && <option value="admin">Admin</option>}
              {isSuperAdmin && <option value="superAdmin">Super Admin</option>}
            </select>
          </div>

          {formData.role !== 'superAdmin' && (
            <div className="form-group">
              <label htmlFor="clientId">Client:</label>
              <input
                type="text"
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                required
                placeholder="e.g., MTC, Villa123"
              />
            </div>
          )}

          {formData.role === 'superAdmin' && (
            <div className="form-group">
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                SuperAdmin users have global access to all clients
              </p>
            </div>
          )}

          {(formData.role === 'unitOwner' || formData.role === 'unitManager') && (
            <div className="form-group">
              <label htmlFor="unitId">Unit:</label>
              {loadingUnits ? (
                <div style={{ padding: '12px', fontStyle: 'italic', color: '#666', border: '1px solid #ddd', borderRadius: '4px' }}>
                  Loading units for {formData.clientId}...
                </div>
              ) : availableUnits.length > 0 ? (
                <select
                  id="unitId"
                  value={formData.unitId}
                  onChange={(e) => setFormData({...formData, unitId: e.target.value})}
                >
                  <option value="">Select Unit...</option>
                  {availableUnits.map(unit => (
                    <option key={unit.unitId} value={unit.unitId}>
                      {unit.unitName ? `${unit.unitName} (${unit.unitId})` : unit.unitId}
                    </option>
                  ))}
                </select>
              ) : formData.clientId ? (
                <div style={{ padding: '12px', fontStyle: 'italic', color: '#999', border: '1px solid #ddd', borderRadius: '4px' }}>
                  No units found for {formData.clientId}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Enter client ID first"
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              )}
            </div>
          )}

          {/* Success/Result Display */}
          {creationResult && (
            <div className="creation-result">
              {creationResult.success ? (
                <>
                  {formData.creationMethod === 'invitation' ? (
                    <div className="success-message">
                      <h4>✅ Invitation Sent Successfully!</h4>
                      <p><strong>{formData.name}</strong> will receive an email invitation at <strong>{formData.email}</strong></p>
                      <p>They can use the secure link to set up their password and activate their account.</p>
                    </div>
                  ) : (
                    <div className="password-display">
                      <h4>✅ User Created Successfully!</h4>
                      <p><strong>{formData.name}</strong> has been created with a temporary password:</p>
                      
                      <div className="temp-password-box">
                        <label>Temporary Password:</label>
                        <div className="password-value">
                          <code>{creationResult.temporaryPassword}</code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(creationResult.temporaryPassword)}
                            className="copy-btn"
                            title="Copy to clipboard"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      
                      <div className="password-instructions">
                        <p><strong>⚠️ Important:</strong></p>
                        <ul>
                          <li>Share this password securely with the user</li>
                          <li>They will be required to change it on first login</li>
                          <li>This password will not be shown again</li>
                          <li>Email notification has been sent to {formData.email}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="error-message">
                  <h4>❌ Creation Failed</h4>
                  <p>{creationResult.error || 'An error occurred while creating the user.'}</p>
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            {creationResult && creationResult.success ? (
              <button type="button" onClick={onClose} className="btn-primary">
                {formData.creationMethod === 'invitation' ? 'Done' : 'Close'}
              </button>
            ) : (
              <>
                <button type="button" onClick={onClose}>Cancel</button>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : (
                    formData.creationMethod === 'invitation' ? 'Send Invitation' : 'Create User'
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Edit User Modal Component
 */
const EditUserModal = ({ user, onClose, onUpdate, currentUser }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    isActive: user.isActive !== false,
    globalRole: user.globalRole || 'user',
    propertyAccess: user.propertyAccess || {},
    // Unit assignment form fields
    newClientId: '',
    newUnitId: '',
    newRole: 'unitOwner',
    requirePasswordChange: user.mustChangePassword || false
  });
  
  // Track pending unit assignment changes (not yet saved)
  const [pendingAssignments, setPendingAssignments] = useState({
    toAdd: [], // { clientId, unitId, role }
    toRemove: [] // { clientId, unitId, role }
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [availableUnits, setAvailableUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [availableClients, setAvailableClients] = useState([]);
  const secureApi = useSecureApi();

  // Load available clients when modal opens
  useEffect(() => {
    const loadAvailableClients = async () => {
      try {
        // Get unique client IDs from all user's current access
        const clientIds = Object.keys(user.propertyAccess || {});
        
        // Also fetch all available clients for SuperAdmin
        if (currentUser?.email === 'michael@landesman.com' || currentUser?.globalRole === 'superAdmin') {
          try {
            const response = await secureApi.getSystemUsers();
            const allUsers = response.users || [];
            const allClientIds = new Set();
            
            allUsers.forEach(u => {
              Object.keys(u.propertyAccess || {}).forEach(clientId => {
                allClientIds.add(clientId);
              });
            });
            
            // Combine current user's clients with all system clients
            const uniqueClients = [...new Set([...clientIds, ...Array.from(allClientIds)])];
            setAvailableClients(uniqueClients.map(id => ({ id, name: id })));
          } catch (error) {
            console.log('Using user client access only');
            setAvailableClients(clientIds.map(id => ({ id, name: id })));
          }
        } else {
          setAvailableClients(clientIds.map(id => ({ id, name: id })));
        }
      } catch (error) {
        console.error('Failed to load available clients:', error);
        setAvailableClients([]);
      }
    };
    
    loadAvailableClients();
  }, [user, secureApi, currentUser]);

  // Get all unit assignments for the user (copy of function from main component)
  const getAllUnitAssignments = (user) => {
    const assignments = [];
    Object.entries(user.propertyAccess || {}).forEach(([clientId, access]) => {
      // Handle new unitAssignments structure
      if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
        access.unitAssignments.forEach(assignment => {
          if (assignment.unitId && assignment.role) {
            assignments.push({
              clientId,
              unitId: assignment.unitId,
              role: assignment.role,
              display: `${clientId}: ${assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${assignment.unitId}`
            });
          }
        });
      } else {
        // Handle legacy structure for backward compatibility
        if (access.role === 'unitManager' || access.role === 'unitOwner') {
          // Primary assignment
          if (access.unitId) {
            assignments.push({
              clientId,
              unitId: access.unitId,
              role: access.role,
              display: `${clientId}: ${access.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${access.unitId}`
            });
          }
          
          // Additional assignments (legacy)
          if (access.additionalAssignments && Array.isArray(access.additionalAssignments)) {
            access.additionalAssignments
              .filter(assignment => (assignment.role === 'unitManager' || assignment.role === 'unitOwner') && assignment.unitId)
              .forEach(assignment => {
                assignments.push({
                  clientId,
                  unitId: assignment.unitId,
                  role: assignment.role,
                  display: `${clientId}: ${assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${assignment.unitId}`
                });
              });
          }
        }
      }
    });
    return assignments;
  };

  // Fetch units when client ID changes for unit manager/owner roles
  useEffect(() => {
    const fetchUnitsForClient = async () => {
      if (!formData.newClientId || !['unitOwner', 'unitManager'].includes(formData.newRole)) {
        console.log('🔍 Not fetching units - clientId:', formData.newClientId, 'role:', formData.newRole);
        setAvailableUnits([]);
        return;
      }

      console.log('📋 Fetching units for client:', formData.newClientId, 'role:', formData.newRole);
      setLoadingUnits(true);
      try {
        const response = await getUnits(formData.newClientId);
        console.log('✅ Units response received:', response);
        setAvailableUnits(response.data || []);
      } catch (error) {
        console.error('❌ Failed to fetch units:', error);
        console.error('❌ Error details:', error.message);
        setAvailableUnits([]);
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnitsForClient();
  }, [formData.newClientId, formData.newRole]);

  // Add unit role assignment to pending changes (not saved until form submit)
  const addUnitRoleAssignment = () => {
    if (!formData.newClientId.trim() || !formData.newUnitId.trim() || !formData.newRole) return;
    
    const newAssignment = {
      clientId: formData.newClientId,
      unitId: formData.newUnitId,
      role: formData.newRole
    };
    
    // Check if this assignment already exists or is already pending
    const currentAssignments = getAllUnitAssignments(user);
    const existsInCurrent = currentAssignments.some(a => 
      a.clientId === newAssignment.clientId && 
      a.unitId === newAssignment.unitId && 
      a.role === newAssignment.role
    );
    const existsInPending = pendingAssignments.toAdd.some(a =>
      a.clientId === newAssignment.clientId && 
      a.unitId === newAssignment.unitId && 
      a.role === newAssignment.role
    );
    
    if (existsInCurrent || existsInPending) {
      alert('This unit role assignment already exists');
      return;
    }
    
    // Add to pending additions
    setPendingAssignments(prev => ({
      ...prev,
      toAdd: [...prev.toAdd, newAssignment]
    }));
    
    // Clear the form
    setFormData({
      ...formData,
      newClientId: '',
      newUnitId: '',
      newRole: 'unitOwner'
    });
  };

  // Remove unit role assignment (add to pending removals)
  const removeUnitRoleAssignment = (clientId, unitId, role) => {
    const removalItem = { clientId, unitId, role };
    
    // Add to pending removals
    setPendingAssignments(prev => ({
      ...prev,
      toRemove: [...prev.toRemove, removalItem]
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const updateData = {
        name: formData.name,
        isActive: formData.isActive,
        globalRole: formData.globalRole
        // Note: propertyAccess is now managed via separate API calls
      };
      
      // Include password reset if requested
      if (showPassword) {
        updateData.resetPassword = true;
        if (newPassword.trim()) {
          updateData.newPassword = newPassword;
        }
      }
      
      // Include require password change if requested
      if (formData.requirePasswordChange) {
        updateData.requirePasswordChange = true;
      }
      
      // Update basic user data first
      const result = await onUpdate(user.id, updateData);
      
      // Apply pending unit assignment changes
      for (const removal of pendingAssignments.toRemove) {
        await secureApi.removeUnitRoleAssignment(user.id, removal.clientId, removal.unitId);
      }
      
      for (const addition of pendingAssignments.toAdd) {
        await secureApi.addUnitRoleAssignment(user.id, addition.clientId, addition.unitId, addition.role);
      }
      
      // Show success message if password was reset
      if (showPassword && result.passwordChanged) {
        if (!newPassword.trim()) {
          // Create a better modal-style message instead of ugly alert
          const message = `Password reset successful!\n\nA new password has been generated and emailed to ${user.email}.\n\nThey will need to change it on their next login.`;
          if (window.confirm(`✅ ${message}\n\nClick OK to continue.`)) {
            // User acknowledged the message
          }
        } else {
          const message = `Password updated successfully!\n\nThe user can now log in with their new password.`;
          if (window.confirm(`✅ ${message}\n\nClick OK to continue.`)) {
            // User acknowledged the message
          }
        }
      }
      
      // Close modal on successful update
      onClose();
      
    } catch (error) {
      console.error('Update user failed:', error);
      alert(`❌ Failed to update user: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Get effective unit assignments (current + pending changes)
  const getEffectiveUnitAssignments = () => {
    const currentAssignments = getAllUnitAssignments(user);
    
    // Remove assignments that are pending removal
    const afterRemovals = currentAssignments.filter(current => 
      !pendingAssignments.toRemove.some(removal =>
        current.clientId === removal.clientId && 
        current.unitId === removal.unitId && 
        current.role === removal.role
      )
    );
    
    // Add pending additions
    const pendingAdditionsWithDisplay = pendingAssignments.toAdd.map(assignment => ({
      ...assignment,
      display: `${assignment.clientId}: ${assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit ${assignment.unitId}`,
      isPending: true
    }));
    
    return [...afterRemovals, ...pendingAdditionsWithDisplay];
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit User</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="user-form">
          <div className="form-group">
            <label>Email:</label>
            <input type="text" value={user.email} disabled />
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          {/* Global Role - SuperAdmin only */}
          {(currentUser?.email === 'michael@landesman.com' || currentUser?.globalRole === 'superAdmin') && (
            <div className="form-group">
              <label htmlFor="globalRole">Global Role:</label>
              <select
                id="globalRole"
                value={formData.globalRole}
                onChange={(e) => setFormData({...formData, globalRole: e.target.value})}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="unitOwner">Unit Owner</option>
                <option value="unitManager">Unit Manager</option>
                <option value="superAdmin">Super Admin</option>
              </select>
            </div>
          )}

          {/* Unit Role Assignments */}
          <div className="form-group">
            <label>Unit Role Assignments:</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
              {getEffectiveUnitAssignments().map((assignment, index) => {
                const isBeingRemoved = pendingAssignments.toRemove.some(removal =>
                  assignment.clientId === removal.clientId && 
                  assignment.unitId === removal.unitId && 
                  assignment.role === removal.role
                );
                
                return (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '5px', 
                    padding: '5px', 
                    backgroundColor: isBeingRemoved ? '#ffe6e6' : (assignment.isPending ? '#fff3cd' : (assignment.role === 'unitOwner' ? '#e8f5e8' : '#e3f2fd')), 
                    borderRadius: '4px',
                    opacity: isBeingRemoved ? 0.6 : 1
                  }}>
                    <span style={{ flex: 1, fontSize: '14px' }}>
                      <strong>{assignment.clientId}:</strong> {assignment.role === 'unitOwner' ? 'Owner' : 'Manager'} of Unit {assignment.unitId}
                      {assignment.isPending && <em style={{ color: '#856404', marginLeft: '8px' }}>(pending)</em>}
                      {isBeingRemoved && <em style={{ color: '#721c24', marginLeft: '8px' }}>(will be removed)</em>}
                    </span>
                    {!isBeingRemoved && (
                      <button 
                        type="button" 
                        onClick={() => removeUnitRoleAssignment(assignment.clientId, assignment.unitId, assignment.role)}
                        style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '12px', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '3px' }}
                        title="Remove this unit assignment"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
              {getEffectiveUnitAssignments().length === 0 && (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No unit assignments</p>
              )}
            </div>
          </div>

          {/* Add New Unit Role Assignment */}
          <div className="form-group">
            <label>Add Unit Role Assignment:</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Client ID</label>
                <select
                  value={formData.newClientId}
                  onChange={(e) => setFormData({...formData, newClientId: e.target.value, newUnitId: ''})}
                >
                  <option value="">Select Client...</option>
                  {availableClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Role</label>
                <select
                  value={formData.newRole}
                  onChange={(e) => setFormData({...formData, newRole: e.target.value})}
                >
                  <option value="unitOwner">Unit Owner</option>
                  <option value="unitManager">Unit Manager</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Unit</label>
                {loadingUnits ? (
                  <div style={{ padding: '8px', fontStyle: 'italic', color: '#666' }}>
                    Loading units...
                  </div>
                ) : availableUnits.length > 0 ? (
                  <select
                    value={formData.newUnitId || ''}
                    onChange={(e) => setFormData({...formData, newUnitId: e.target.value})}
                  >
                    <option value="">Select Unit...</option>
                    {availableUnits.map(unit => (
                      <option key={unit.unitId} value={unit.unitId}>
                        {unit.unitName ? `${unit.unitName} (${unit.unitId})` : unit.unitId}
                      </option>
                    ))}
                  </select>
                ) : formData.newClientId ? (
                  <div style={{ padding: '8px', fontStyle: 'italic', color: '#999' }}>
                    No units found for {formData.newClientId}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter client ID first"
                    disabled
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                )}
              </div>
              <button 
                type="button" 
                onClick={addUnitRoleAssignment}
                disabled={!formData.newClientId || !formData.newUnitId}
                style={{ height: 'fit-content', padding: '8px 12px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: formData.newClientId && formData.newUnitId ? 'pointer' : 'not-allowed' }}
              >
                Add Assignment
              </button>
            </div>
            <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
              This allows users to have different roles for different units within the same client
            </small>
          </div>

          {/* Password Reset */}
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Reset Password
            </label>
            {showPassword && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="New password (leave empty for auto-generated)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small style={{ display: 'block', color: '#666' }}>
                  If empty, a secure password will be generated and emailed to the user
                </small>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.requirePasswordChange}
                onChange={(e) => setFormData({...formData, requirePasswordChange: e.target.checked})}
              />
              Require Password Change on Next Login
            </label>
            <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
              User will be forced to change their password when they next log in
            </small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              />
              Active User
            </label>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            
            <button type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Export CRUD handlers for parent component use
export { CreateUserModal, EditUserModal };
export default UserManagement;