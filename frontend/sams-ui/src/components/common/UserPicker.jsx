import React, { useState, useEffect } from 'react';
import { useSecureApi } from '../../api/secureApiClient.js';

/**
 * UserPicker Component
 * Displays a dropdown to select users from the Users collection
 * Filters users by client and optionally by role
 * 
 * @param {string} clientId - The client ID to filter users by
 * @param {string} selectedUserId - Currently selected user ID (or null)
 * @param {Function} onSelect - Callback when user is selected (userId) => void
 * @param {Array<string>} allowedRoles - Optional array of roles to filter by (e.g., ['unitOwner', 'unitManager'])
 * @param {string} label - Label for the picker
 * @param {boolean} required - Whether selection is required
 * @param {boolean} restrictToUsersWithClientAccess - When true (default), only users with propertyAccess[clientId] appear. Set false for unit owner/manager assignment so cross-client users can be selected.
 */
const UserPicker = ({ 
  clientId, 
  selectedUserId, 
  onSelect, 
  allowedRoles = null, 
  label = 'User',
  required = false,
  restrictToUsersWithClientAccess = true
}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const secureApi = useSecureApi();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use same approach as UserManagement - fetch all users, then filter on frontend
        const response = await secureApi.getSystemUsers();
        const allUsers = response.users || [];
        
        console.log(`🔍 UserPicker: Fetched ${allUsers.length} total users`);
        
        // Filter by clientId if provided (optional: unit assignment lists all assignable users)
        let filtered = allUsers;
        if (clientId && restrictToUsersWithClientAccess) {
          filtered = allUsers.filter(user => {
            const hasAccess = user.propertyAccess?.[clientId] != null;
            if (!hasAccess && user.email) {
              console.log(`  ⚠️  User ${user.email} (${user.id}) does not have propertyAccess for ${clientId}`);
            }
            return hasAccess;
          });
          console.log(`📊 UserPicker: ${filtered.length} users have access to clientId: ${clientId}`);
        } else if (clientId && !restrictToUsersWithClientAccess) {
          console.log(`📊 UserPicker: showing all ${filtered.length} users (cross-client assignment mode for ${clientId})`);
        }
        
        // Filter by roles if specified
        if (allowedRoles && allowedRoles.length > 0) {
          filtered = filtered.filter(user => {
            const access = user.propertyAccess?.[clientId];
            if (!access) {
              if (user.email) {
                console.log(`  ⚠️  User ${user.email} (${user.id}) - no propertyAccess for ${clientId}`);
              }
              return false;
            }
            
            const userRole = access.role;
            const hasRole = allowedRoles.includes(userRole);
            
            if (!hasRole && user.email) {
              console.log(`  ⚠️  User ${user.email} (${user.id}) - role: "${userRole}", needs one of:`, allowedRoles);
            }
            
            return hasRole;
          });
          console.log(`✅ UserPicker: Filtered to ${filtered.length} users with roles:`, allowedRoles);
        }
        
        setUsers(filtered);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [clientId, allowedRoles, restrictToUsersWithClientAccess, secureApi]);

  if (loading) {
    return (
      <div className="user-picker">
        <label>{label}{required && ' *'}</label>
        <select disabled>
          <option>Loading users...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-picker">
        <label>{label}{required && ' *'}</label>
        <select disabled>
          <option>Error: {error}</option>
        </select>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="user-picker">
        <label>{label}{required && ' *'}</label>
        <select disabled>
          <option>No users available for this client</option>
        </select>
        <span className="sandyland-helper-text">
          {restrictToUsersWithClientAccess
            ? 'No users found. Create users in User Management first.'
            : 'No users returned from directory. Create users in User Management first.'}
        </span>
      </div>
    );
  }

  return (
    <div className="user-picker">
      <label>{label}{required && ' *'}</label>
      <select 
        value={selectedUserId || ''} 
        onChange={(e) => onSelect(e.target.value || null)}
        required={required}
        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
      >
        <option value="">-- Select {label} --</option>
        {users.map(user => (
          <option key={user.id} value={user.id}>
            {user.name || user.displayName || user.email} ({user.email})
          </option>
        ))}
      </select>
    </div>
  );
};

export default UserPicker;

