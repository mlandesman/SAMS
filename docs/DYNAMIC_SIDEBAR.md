# Dynamic Sidebar Implementation

## Overview

This document describes the implementation of a dynamic, client-specific sidebar menu in the Sandyland Asset Management System (SAMS). The goal was to replace the hardcoded sidebar menu with one that could be configured per client through Firestore, allowing different clients to have different menu options without requiring code changes.

## Data Structure

Client menu configurations are stored in Firestore at:
```
/clients/{clientId}/config/activities
```

Each document contains a `menu` array with objects in the following format:
```javascript
{
  "label": "Menu Item Name",
  "activity": "ActivityIdentifier"
}
```

Example:
```javascript
{
  "menu": [
    { "label": "Dashboard", "activity": "Dashboard" },
    { "label": "Transactions", "activity": "Transactions" },
    { "label": "HOA Dues", "activity": "HOADues" },
    { "label": "Projects", "activity": "Projects" },
    { "label": "Settings", "activity": "Settings" }
  ]
}
```

## Implementation Components

### 1. ClientContext

The `ClientContext` was enhanced to:
- Fetch menu configuration when a client is selected
- Store menu items in state
- Provide loading and error states for menu fetching
- Include a refresh function for menu configuration

Key changes:
```jsx
// Add state for client menu configuration
const [menuConfig, setMenuConfig] = useState([]);
const [isLoadingMenu, setIsLoadingMenu] = useState(false);
const [menuError, setMenuError] = useState(null);

// Function to fetch menu configuration from Firestore
const fetchClientMenuConfig = async (clientId) => {
  if (!clientId) return;
  
  setIsLoadingMenu(true);
  setMenuError(null);
  
  try {
    const menuRef = doc(db, `clients/${clientId}/config/activities`);
    const menuSnapshot = await getDoc(menuRef);
    
    if (menuSnapshot.exists()) {
      const menuData = menuSnapshot.data();
      if (menuData.menu && Array.isArray(menuData.menu)) {
        setMenuConfig(menuData.menu);
      } else {
        setMenuConfig([]);
      }
    } else {
      setMenuConfig([]);
    }
  } catch (error) {
    setMenuError(error.message);
    setMenuConfig([]);
  } finally {
    setIsLoadingMenu(false);
  }
};
```

### 2. Sidebar Component

The `Sidebar` component was updated to use the dynamic menu configuration:
- Uses `menuConfig` from `ClientContext` instead of hardcoded items
- Displays loading and error states
- Has a fallback to default menu items if configuration fails
- Converts activity names to paths and handles capitalization

Key implementation:
```jsx
// Use menuConfig if available, otherwise fall back to defaults
const menuItems = selectedClient
  ? (menuConfig && menuConfig.length > 0 
      ? menuConfig.map(item => {
          const activityName = (item.activity || '').toLowerCase();
          return {
            name: item.label || item.name || item.activity,
            path: `/${activityName}`,
            activity: activityName
          };
      })
      : DEFAULT_MENU_ITEMS)
  : [];
```

### 3. ActivityView Component

To handle dynamically loaded menu items, we created an `ActivityView` component that:
- Uses React Router's parameters to determine which activity to display
- Maps activity names to component views
- Provides a placeholder for activities without dedicated views
- Handles capitalization and formatting consistently

```jsx
function ActivityView() {
  const { activity } = useParams();
  const lowerActivity = activity ? activity.toLowerCase() : 'dashboard';
  
  // Get the component for this activity, or default to a placeholder
  const ViewComponent = ACTIVITY_VIEWS[lowerActivity] || 
    (() => <PlaceholderView title={activity} />);
  
  return <ViewComponent />;
}
```

### 4. Configuration Script

A configuration script (`configureClientMenu.js`) was created to easily set up menu configurations for clients:
- Uses Firebase Admin SDK
- Writes menu configuration to Firestore
- Can be run as needed to update client configurations

## Routing Implementation

The App component was updated to handle dynamic routes:
```jsx
<Routes>
  {/* Fixed routes for key functionality */}
  <Route path="/" element={<DashboardView />} />
  <Route path="/dashboard" element={<DashboardView />} />
  <Route path="/transactions" element={<TransactionsView />} />
  
  {/* Dynamic route for activities from the client configuration */}
  <Route path="/:activity" element={<ActivityView />} />
  
  {/* Fallback route */}
  <Route path="*" element={<DashboardView />} />
</Routes>
```

## Advantages

1. **Flexibility**: Each client can have their own customized menu
2. **Maintainability**: Menu items can be updated without code changes
3. **Scalability**: New menu items can be added without modifying the codebase
4. **Consistency**: All menu-related functionality is centralized

## Future Enhancements

1. **Icon Support**: Add support for menu item icons
2. **Nested Menus**: Implement sub-menu functionality
3. **Permission-Based Menus**: Show/hide menu items based on user roles
4. **Menu Ordering**: Allow clients to customize the order of menu items
5. **Menu Editor**: Create an admin interface for managing menu configurations
