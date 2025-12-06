import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import './Sidebar.css';

// Using the same logo URL you provided
const logoUrl = "https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-white-background.png?alt=media&token=1cab6b71-9325-408a-bd55-e00057c69bd5";

// Default menu items to use if client configuration fails or is empty
const DEFAULT_MENU_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', activity: 'dashboard' },
  { name: 'Transactions', path: '/transactions', activity: 'transactions' },
  { name: 'Settings', path: '/settings', activity: 'settings' }
];

// SuperAdmin-only menu items that are ALWAYS available regardless of client config
const SUPERADMIN_MENU_ITEMS = [
  { name: 'Settings', path: '/settings', activity: 'settings' }
];

// Filter menu items based on user role (moved outside component to prevent recreating)
const getVisibleMenuItems = (user, items, selectedClient) => {
    if (!items || !user) return items || [];
    
    console.log('🔍 SIDEBAR: Filtering menu items for user:', {
      email: user.email,
      globalRole: user.globalRole,
      clientId: selectedClient?.id,
      propertyAccess: user.propertyAccess,
      isAdmin: isAdmin(user, selectedClient?.id),
      isSuperAdmin: isSuperAdmin(user)
    });
    
    return items.filter(item => {
      // Strip quotes and whitespace from activity name
      const activity = item.activity
        ?.toString()
        .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
        .trim()
        .toLowerCase();
      const itemName = item.name?.toLowerCase();
      
                  console.log('🔍 MENU DEBUG - Is SuperAdmin:', isSuperAdmin(user));
            
      // List Management - only Admin and SuperAdmin
      // Check for various possible activity names
      if (activity === 'lists' || 
          activity === 'list-management' || 
          activity === 'listmanagement' ||
          itemName?.toLowerCase().includes('list management') ||
          (itemName?.toLowerCase().includes('list') && itemName?.toLowerCase().includes('management'))) {
        
        const hasAccess = isAdmin(user, selectedClient?.id) || isSuperAdmin(user);
        console.log('🚨 LIST MANAGEMENT ACCESS CHECK:', {
          activity,
          itemName,
          userRole: user.globalRole,
          clientId: selectedClient?.id,
          clientRole: user.propertyAccess?.[selectedClient?.id]?.role,
          hasAccess,
          isAdmin: isAdmin(user, selectedClient?.id),
          isSuperAdmin: isSuperAdmin(user)
        });
        return hasAccess;
      }
      
      // Settings - only SuperAdmin
      if (activity === 'settings') {
        const hasAccess = isSuperAdmin(user);
        console.log('⚙️ SETTINGS ACCESS CHECK:', { activity, hasAccess });
                return hasAccess;
      }
      
      // User Management - all users can access (but will see different views)
      if (activity === 'users' || activity === 'user-management') {
                return true;
      }
      
      // Everything else is visible to all authenticated users
            return true;
    });
};

function Sidebar({ onChangeClientClick, onActivityChange }) { // Add onActivityChange prop
  const { selectedClient, menuConfig, isLoadingMenu, menuError } = useClient();
  const { samsUser } = useAuth(); // Get user for role checking

  // Use menuConfig if available, otherwise fall back to defaults (memoized)
  const allMenuItems = useMemo(() => {
    // Start with client-specific menu items
    let items = selectedClient
      ? (menuConfig && menuConfig.length > 0 
          ? menuConfig.map(item => {
              // Strip quotes and whitespace from activity name
              const activityName = (item.activity || '')
                .toString()
                .replace(/^["']+|["']+$/g, '') // Remove leading/trailing quotes
                .trim()
                .toLowerCase();
              // Handle specific route mappings
              let path = `/${activityName}`;
              if (activityName === 'listmanagement') {
                path = '/lists';
              }
              return {
                name: item.label || item.name || item.activity,
                path: path,
                activity: activityName
              };
          })
          : DEFAULT_MENU_ITEMS)
      : DEFAULT_MENU_ITEMS; // Show defaults even without client
    
    // For SuperAdmins, ALWAYS ensure Settings is available
    if (samsUser && isSuperAdmin(samsUser)) {
      // Check if Settings is already in the menu
      const hasSettings = items.some(item => item.activity === 'settings');
      
      // If not, append SuperAdmin items
      if (!hasSettings) {
        items = [...items, ...SUPERADMIN_MENU_ITEMS];
      }
    }
    
    return items;
  }, [selectedClient, menuConfig, samsUser]);

  // Filter menu items based on user role (memoized to prevent render loops)
  const menuItems = useMemo(() => {
    return getVisibleMenuItems(samsUser, allMenuItems, selectedClient);
  }, [samsUser, allMenuItems, selectedClient]);

  return (
    <div className="sidebar">
      <div className="sidebar-header-section">
        <img
          src={logoUrl}
          alt="Sandyland Properties Logo"
          className="sidebar-header-logo"
        />
      </div>

      {/* Always render "Activities" heading */}
      <h3 className="sidebar-menu-heading">Activities</h3>

      <ul className="sidebar-menu">
        {isLoadingMenu && selectedClient ? (
          <li className="menu-loading">Loading menu...</li>
        ) : menuError ? (
          <li className="menu-error">Error loading menu</li>
        ) : (
          menuItems.map((item, index) => {
            // Get the current path from window location
            const currentPath = window.location.pathname;
            // Check if this is the active item - either direct match or path starts with item path
            const isActive = currentPath === item.path || 
                            (item.path !== '/' && currentPath.startsWith(item.path));
            
            return (
              <li key={index} className={isActive ? 'active' : ''}>
                <Link
                  to={item.path}
                  onClick={() => {
                    console.log(`Navigating to ${item.path}`);
                    onActivityChange(item.activity); // Call onActivityChange
                  }}
                >
                  {item.name}
                </Link>
              </li>
            );
          })
        )}
        <li className="change-client-button" onClick={onChangeClientClick}>
          Change Client
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;