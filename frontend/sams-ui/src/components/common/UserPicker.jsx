import React, { useState, useEffect } from 'react';
import { useSecureApi } from '../../api/secureApiClient.js';
import { getDisplayNameFromUser } from '../../utils/unitContactUtils.js';

/**
 * UserPicker Component
 * Displays a dropdown to select users from the Users collection
 * Filters users by client and optionally by role
 *
 * @param {string} clientId - The client ID to filter users by (when requirePropertyAccessForClient is true)
 * @param {boolean} requirePropertyAccessForClient - If false, list all system users (unit assignment / cross-client)
 */
const UserPicker = ({
  clientId,
  selectedUserId,
  onSelect,
  allowedRoles = null,
  label = 'User',
  required = false,
  requirePropertyAccessForClient = true
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

        const response = await secureApi.getSystemUsers();
        const allUsers = response.users || [];

        let filtered = allUsers;
        if (clientId && requirePropertyAccessForClient) {
          filtered = allUsers.filter(user => user.propertyAccess?.[clientId] != null);
        }

        if (allowedRoles && allowedRoles.length > 0 && clientId) {
          filtered = filtered.filter(user => {
            const access = user.propertyAccess?.[clientId];
            if (!access) return false;
            return allowedRoles.includes(access.role);
          });
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
  }, [clientId, allowedRoles, secureApi, requirePropertyAccessForClient]);

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
          <option>
            {requirePropertyAccessForClient ? 'No users available for this client' : 'No users available'}
          </option>
        </select>
        <span className="sandyland-helper-text">
          No users found. Create users in User Management first.
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
            {getDisplayNameFromUser(user) || user.email || user.id} ({user.email || 'no email'})
          </option>
        ))}
      </select>
    </div>
  );
};

export default UserPicker;
