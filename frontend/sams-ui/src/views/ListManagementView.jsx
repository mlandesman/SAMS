import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tab, Tabs, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faEdit,
  faTrash,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import ActivityActionBar from '../components/common/ActivityActionBar';
import ModernVendorList from '../components/lists/ModernVendorList';
import ModernCategoryList from '../components/lists/ModernCategoryList';
import ModernPaymentMethodList from '../components/lists/ModernPaymentMethodList';
import UnitList from '../components/lists/ModernUnitList';
import ExchangeRatesList from '../components/lists/ExchangeRatesList';
import ExchangeRatesDisplay from '../components/ExchangeRatesDisplay';
import PollsList from '../components/polls/PollsList';
import PollCreationWizard from '../components/polls/PollCreationWizard';
import PollDetailView from '../components/polls/PollDetailView';
import UserManagement, { CreateUserModal, EditUserModal } from '../components/admin/UserManagement';
import ClientManagement, { ClientFormModal } from '../components/admin/ClientManagement'; // CLIENT_MANAGEMENT addition
import SystemErrorsList from '../components/lists/SystemErrorsList';
import VendorFormModal from '../components/modals/VendorFormModal';
import CategoryFormModal from '../components/modals/CategoryFormModal';
import PaymentMethodFormModal from '../components/modals/PaymentMethodFormModal';
import UnitFormModal from '../components/modals/UnitFormModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import ItemDetailModal from '../components/modals/ItemDetailModal';
import { useClient } from '../context/ClientContext';
import { useListManagement } from '../context/ListManagementContext';
import { useStatusBar } from '../context/StatusBarContext';
import { useAuth } from '../context/AuthContext';
import { useSecureApi } from '../api/secureApiClient';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils';
import { formatTimestampMexico } from '../utils/timezone';
import { createVendor, updateVendor, deleteVendor } from '../api/vendors';
import { createCategory, updateCategory, deleteCategory } from '../api/categories';
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../api/paymentMethods';
import { createUnit, updateUnit, deleteUnit } from '../api/units';
import { createPoll, updatePoll, deletePoll } from '../api/polls';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import ExportMenu from '../components/common/ExportMenu';
import { exportToCSV } from '../utils/csvExport';
import { getVendors } from '../api/vendors';
import { getCategories } from '../api/categories';
import { getPaymentMethods } from '../api/paymentMethods';
import { getUnits } from '../api/units';
import { fetchAllExchangeRates } from '../api/exchangeRates';
import '../layout/ActionBar.css';
import './ListManagementView.css';

// TabPanel component to handle tab content
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`list-management-tabpanel-${index}`}
      aria-labelledby={`list-management-tab-${index}`}
      className="list-tabpanel"
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main List Management View component
function ListManagementView() {
  const { selectedClient } = useClient();
  const { updateEntryCount, searchTerm } = useListManagement();
  const { setStatusInfo, clearStatusInfo } = useStatusBar();
  const { samsUser } = useAuth();
  const secureApi = useSecureApi();
  const [tabIndex, setTabIndex] = useState(0);
  const [availableLists, setAvailableLists] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Selection state for the current list
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Track which modal is currently open
  const [activeModal, setActiveModal] = useState({
    type: null, // 'vendor', 'category', 'method', 'unit'
    action: null, // 'add', 'edit'
    itemData: null // For edit mode: the item data to edit
  });

  // Detail modal state
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    item: null,
    title: '',
    fields: []
  });

  const [pollDetail, setPollDetail] = useState({
    isOpen: false,
    pollId: null
  });

  // Confirmation dialog state
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Define all possible lists with their configurations using useMemo to prevent re-creation on each render
  const allListTypes = useMemo(() => {
    const lists = [
      { 
        id: 'vendor', 
        label: 'Vendors', 
        component: ModernVendorList,
        componentType: 'modern-list',
        modalComponent: VendorFormModal
      },
      { 
        id: 'category', 
        label: 'Categories', 
        component: ModernCategoryList,
        componentType: 'modern-list',
        modalComponent: CategoryFormModal
      },
      { 
        id: 'method', 
        label: 'Payment Methods', 
        component: ModernPaymentMethodList,
        componentType: 'modern-list',
        modalComponent: PaymentMethodFormModal
      },
      { 
        id: 'unit', 
        label: 'Units', 
        component: UnitList,
        componentType: 'modern-list',
        modalComponent: UnitFormModal
      },
      { 
        id: 'exchangerates', 
        label: 'Exchange Rates', 
        component: ExchangeRatesDisplay,
        componentType: 'modern-list'
        // No modal needed for exchange rates - they're read-only
      },
      {
        id: 'polls',
        label: 'Polls',
        component: PollsList,
        componentType: 'modern-list',
        modalComponent: PollCreationWizard
      }
    ];

    // Add Users tab for Admin and SuperAdmin only
    if (samsUser && (isAdmin(samsUser, selectedClient?.id) || isSuperAdmin(samsUser))) {
      lists.push({
        id: 'users',
        label: 'Users',
        component: UserManagement,
        componentType: 'list-component',
        hasModal: true
      });
    }


    // CLIENT_MANAGEMENT addition: Add Client Management tab for SuperAdmin only
    if (samsUser && isSuperAdmin(samsUser)) {
      lists.push({
        id: 'clients',
        label: 'Client Management',
        component: ClientManagement,
        componentType: 'list-component',
        modalComponent: ClientFormModal,
        hasModal: true
      });
      // System Errors tab (SuperAdmin only, read-only)
      lists.push({
        id: 'systemErrors',
        label: 'System Errors',
        component: SystemErrorsList,
        componentType: 'list-component',
        hasModal: false
      });
    }

    return lists;
  }, [samsUser, selectedClient]);
  
  // Clear status info when component unmounts
  useEffect(() => {
    return () => {
      clearStatusInfo();
    };
  }, [clearStatusInfo]);
  
  // Fetch available lists from Firestore based on client configuration
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedClient) {
      setAvailableLists([]);
      return;
    }
    
    const fetchClientLists = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch client's list configuration from Firestore
        const listsRef = doc(db, `clients/${selectedClient.id}/config/lists`);
        const listsSnapshot = await getDoc(listsRef);
        
        if (listsSnapshot.exists()) {
          const listsConfig = listsSnapshot.data();
          
          // Map the enabled lists from config to our component definitions
          const enabledLists = Object.entries(listsConfig)
            .filter(([, enabled]) => enabled) // Only include enabled lists
            .map(([listId]) => {
              // Find the component definition for this list
              return allListTypes.find(list => list.id === listId);
            })
            .filter(list => !!list); // Remove any undefined entries
          
          // Always add admin components if user has appropriate permissions
          const adminComponents = allListTypes.filter(list => 
            (list.componentType === 'admin-component' || (list.componentType === 'list-component' && (list.id === 'users' || list.id === 'clients' || list.id === 'systemErrors'))) && 
            !enabledLists.find(existing => existing.id === list.id)
          );

          const shouldShowPolls = samsUser && (isAdmin(samsUser, selectedClient?.id) || isSuperAdmin(samsUser));
          const pollsList = allListTypes.find(list => list.id === 'polls');
          const pollsAlreadyIncluded = enabledLists.find(existing => existing.id === 'polls') || adminComponents.find(existing => existing.id === 'polls');
          const extraPolls = shouldShowPolls && pollsList && !pollsAlreadyIncluded ? [pollsList] : [];
          
          setAvailableLists([...enabledLists, ...adminComponents, ...extraPolls]);
        } else {
          // If no configuration exists, fall back to default lists
          // (vendors, categories, payment methods, units, exchange rates) plus admin components
          const defaultLists = allListTypes.filter(list => 
            list.id === 'vendor' || list.id === 'category' || list.id === 'method' || list.id === 'unit' || list.id === 'exchangerates' || list.id === 'polls'
          );
          
          const adminComponents = allListTypes.filter(list => 
            list.componentType === 'admin-component' || (list.componentType === 'list-component' && (list.id === 'users' || list.id === 'clients' || list.id === 'systemErrors'))
          );

          const shouldShowPolls = samsUser && (isAdmin(samsUser, selectedClient?.id) || isSuperAdmin(samsUser));
          const pollsList = allListTypes.find(list => list.id === 'polls');
          const pollsAlreadyIncluded = defaultLists.find(existing => existing.id === 'polls') || adminComponents.find(existing => existing.id === 'polls');
          const extraPolls = shouldShowPolls && pollsList && !pollsAlreadyIncluded ? [pollsList] : [];
          
          setAvailableLists([...defaultLists, ...adminComponents, ...extraPolls]);
        }
      } catch (err) {
        console.error('Error fetching client list configuration:', err);
        setError('Failed to load list configuration');
        
        // Fall back to default lists on error
        const defaultLists = allListTypes.filter(list => 
          list.id === 'vendor' || list.id === 'category' || list.id === 'method' || list.id === 'unit' || list.id === 'exchangerates' || list.id === 'polls'
        );
        
        const adminComponents = allListTypes.filter(list => 
          list.componentType === 'admin-component' || (list.componentType === 'list-component' && (list.id === 'users' || list.id === 'clients'))
        );

        const shouldShowPolls = samsUser && (isAdmin(samsUser, selectedClient?.id) || isSuperAdmin(samsUser));
        const pollsList = allListTypes.find(list => list.id === 'polls');
        const pollsAlreadyIncluded = defaultLists.find(existing => existing.id === 'polls') || adminComponents.find(existing => existing.id === 'polls');
        const extraPolls = shouldShowPolls && pollsList && !pollsAlreadyIncluded ? [pollsList] : [];
        
        setAvailableLists([...defaultLists, ...adminComponents, ...extraPolls]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientLists();
    
    // Reset tab index if current tab is no longer available
    if (tabIndex >= availableLists.length) {
      setTabIndex(0);
    }
  }, [selectedClient, allListTypes, tabIndex, availableLists.length]);
  
  // Handle tab change and clear selection when switching tabs
  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
    setSelectedItem(null); // Clear selection when switching tabs
  };

  // Helper function to handle CRUD operations with proper refresh delay
  // Ensures database write completes before triggering refresh
  const handleSaveWithRefresh = async (saveOperation, itemName = 'item') => {
    try {
      // Execute the save operation (create or update)
      await saveOperation();
      
      // Close modal first for immediate UI feedback
      handleCloseModal();
      
      // Brief pause to allow database write to complete
      console.log(`⏳ Waiting for database write to complete for ${itemName}...`);
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      
      // Refresh the list by triggering a re-render
      console.log(`🔄 Triggering data refresh for ${itemName}...`);
      setRefreshTrigger(prev => prev + 1);
      setSelectedItem(null); // Clear selection after save
      
    } catch (error) {
      console.error(`❌ Error saving ${itemName}:`, error);
      throw error; // Re-throw so caller can handle error display
    }
  };
  
  // Handle add new item action for modern lists
  const handleAddNew = () => {
    if (availableLists.length === 0 || tabIndex >= availableLists.length) return;
    
    const currentList = availableLists[tabIndex];
    setActiveModal({
      type: currentList.id,
      action: 'add',
      itemData: null
    });
  };
  
  // Handle edit item action for modern lists
  const handleEditItem = () => {
    if (!selectedItem || availableLists.length === 0 || tabIndex >= availableLists.length) return;
    
    const currentList = availableLists[tabIndex];
    setActiveModal({
      type: currentList.id,
      action: 'edit',
      itemData: selectedItem
    });
  };

  // Handle view details action
  const handleViewDetails = () => {
    if (!selectedItem) {
      console.log('No item selected for view details');
      return;
    }
    
    if (availableLists.length === 0 || tabIndex >= availableLists.length) {
      console.log('Invalid tab index or no available lists');
      return;
    }
    
    const currentList = availableLists[tabIndex];
    console.log('Opening details for:', currentList.id, selectedItem);
    
    // Debug: Log profile and notifications data for users
    if (currentList.id === 'users') {
      console.log('👤 User profile data:', selectedItem.profile);
      console.log('🔔 User notifications data:', selectedItem.notifications);
      console.log('🔑 User canLogin:', selectedItem.canLogin);
      console.log('📊 User accountState:', selectedItem.accountState);
    }
    
    // Define detail fields for each list type
    let detailFields = [];
    let title = '';
    
    switch (currentList.id) {
      case 'vendor':
        title = 'Vendor Details';
        detailFields = [
          { key: 'name', label: 'Name' },
          { key: 'contactPerson', label: 'Contact Person' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'phone' },
          { key: 'address', label: 'Address', type: 'multiline' },
          { key: 'category', label: 'Category' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'notes', label: 'Notes', type: 'multiline' }
        ];
        break;
      case 'category':
        title = 'Category Details';
        detailFields = [
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'description', label: 'Description', type: 'multiline' },
          { key: 'code', label: 'Category Code' },
          { key: 'parentCategory', label: 'Parent Category' },
          { key: 'status', label: 'Status', type: 'status' }
        ];
        break;
      case 'method':
        title = 'Payment Method Details';
        detailFields = [
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'description', label: 'Description', type: 'multiline' },
          { key: 'isActive', label: 'Active', type: 'boolean' }
        ];
        break;
      case 'unit':
        title = 'Unit Details';
        detailFields = [
          { key: 'unitId', label: 'Unit ID' },
          { key: 'unitName', label: 'Unit Name' },
          { 
            key: 'owners', 
            label: 'Owners',
            render: (value, item) => {
              const owners = normalizeOwners(item.owners || []);
              if (owners.length === 0) return 'Not specified';
              return owners.map(owner => {
                const parts = [owner.name];
                if (owner.email) parts.push(`(${owner.email})`);
                return parts.join(' ');
              }).join(', ');
            }
          },
          { 
            key: 'managers', 
            label: 'Unit Managers',
            render: (value, item) => {
              const managers = normalizeManagers(item.managers || []);
              if (managers.length === 0) return 'None assigned';
              return managers.map(manager => {
                const parts = [manager.name];
                if (manager.email) parts.push(`(${manager.email})`);
                return parts.join(' ');
              }).join(', ');
            }
          },
          { key: 'status', label: 'Status' },
          { key: 'type', label: 'Type' },
          { 
            key: 'squareFeet', 
            label: 'Square Feet',
            type: 'squareFeet'
          },
          { 
            key: 'squareMeters', 
            label: 'Square Meters',
            render: (value, item) => {
              if (item.squareFeet) {
                const sqm = (Number(item.squareFeet) * 0.092903).toFixed(2);
                return `${Number(sqm).toLocaleString()} sq m`;
              }
              return 'Not specified';
            }
          },
          { 
            key: 'percentOwned', 
            label: 'Percentage Owned',
            type: 'percentage'
          },
          { 
            key: 'duesAmount', 
            label: 'Monthly Dues',
            type: 'money'
          },
          { key: 'accessCode', label: 'Access Code' },
          { key: 'notes', label: 'Notes', type: 'multiline' }
        ];
        break;
      case 'users':
        title = 'User Details';
        detailFields = [
          // Basic Info - Email is larger and on left side
          { 
            key: 'email', 
            label: 'Email', 
            type: 'email'
          },
          { key: 'globalRole', label: 'Global Role' },
          
          // Login Status (NEW)
          { 
            key: 'canLogin', 
            label: 'Login Enabled',
            render: (value) => value !== false ? 'Yes' : 'No (Contact Only)'
          },
          
          // Profile Fields (NEW)
          { 
            key: 'profile.firstName', 
            label: 'First Name',
            render: (value, item) => item.profile?.firstName || '-'
          },
          { 
            key: 'profile.lastName', 
            label: 'Last Name',
            render: (value, item) => item.profile?.lastName || '-'
          },
          { 
            key: 'profile.phone', 
            label: 'Phone',
            render: (value, item) => item.profile?.phone || '-'
          },
          { 
            key: 'profile.taxId', 
            label: 'Tax ID (RFC)',
            render: (value, item) => item.profile?.taxId || '-'
          },
          
          // Preferences (NEW)
          { 
            key: 'profile.preferredLanguage', 
            label: 'Preferred Language',
            render: (value, item) => {
              const lang = item.profile?.preferredLanguage;
              if (lang === 'spanish') return 'Spanish';
              if (lang === 'english') return 'English';
              return lang || 'English';
            }
          },
          { 
            key: 'profile.preferredCurrency', 
            label: 'Preferred Currency',
            render: (value, item) => item.profile?.preferredCurrency || 'MXN'
          },
          
          // Notifications (NEW) - Full width
          { 
            key: 'notifications', 
            label: 'Notifications',
            fullWidth: true,
            render: (value, item) => {
              const notif = item.notifications || {};
              const enabled = [];
              if (notif.email !== false) enabled.push('Email');
              if (notif.sms === true) enabled.push('SMS');
              if (notif.duesReminders !== false) enabled.push('Dues Reminders');
              return enabled.length > 0 ? enabled.join(', ') : 'None';
            }
          },
          
          // Existing fields - Full width for complex data
          { 
            key: 'propertyAccess', 
            label: 'Client Access',
            fullWidth: true,
            render: (value) => {
              if (!value || typeof value !== 'object') return 'None';
              return Object.entries(value).map(([clientId, access]) => 
                `${clientId}: ${access.role || 'User'}`
              ).join(', ');
            }
          },
          { 
            key: 'isActive', 
            label: 'Status',
            render: (value) => value ? 'Active' : 'Inactive'
          },
          { 
            key: 'accountState', 
            label: 'Account State',
            render: (value) => {
              switch(value) {
                case 'active': return 'Active';
                case 'pending_password_change': return 'Pending Password Change';
                case 'pending_invitation': return 'Pending Invitation';
                case 'contact_only': return 'Contact Only';
                default: return value || 'Unknown';
              }
            }
          },
          { 
            key: 'firebaseMetadata.lastSignInTime', 
            label: 'Last Login',
            render: (value, item) => {
              const lastSignInTime = item.firebaseMetadata?.lastSignInTime;
              if (!lastSignInTime) return 'Never';
              
              const lastLogin = new Date(lastSignInTime);
              const now = new Date();
              const diffHours = (now - lastLogin) / (1000 * 60 * 60);
              const diffDays = diffHours / 24;
              
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
            }
          }
        ];
        break;
      case 'clients':
        title = 'Client Details';
        detailFields = [
          // Basic Information
          { key: 'summary.fullName', label: 'Full Name' },
          { key: 'summary.displayName', label: 'Display Name' },
          { key: 'summary.clientType', label: 'Client Type' },
          { key: 'summary.status', label: 'Status', type: 'status' },
          { key: 'basicInfo.description', label: 'Description / Address', type: 'multiline' },
          
          // Branding
          { 
            key: 'branding.logoUrl', 
            label: 'Logo URL',
            render: (value) => value ? 'Logo configured' : 'No logo'
          },
          { 
            key: 'branding.iconUrl', 
            label: 'Icon URL',
            render: (value) => value ? 'Icon configured' : 'No icon'
          },
          
          // Configuration
          { 
            key: 'configuration.timezone', 
            label: 'Timezone',
            render: () => 'America/Cancun (EST/GMT-5)'
          },
          { key: 'configuration.currency', label: 'Currency' },
          { key: 'configuration.language', label: 'Language' },
          { key: 'configuration.dateFormat', label: 'Date Format' },
          
          // Contact Information
          { key: 'contactInfo.primaryEmail', label: 'Primary Email', type: 'email' },
          { key: 'contactInfo.phone', label: 'Phone', type: 'phone' },
          { key: 'contactInfo.website', label: 'Website' },
          { key: 'contactInfo.address.street', label: 'Street Address' },
          { key: 'contactInfo.address.city', label: 'City' },
          { key: 'contactInfo.address.state', label: 'State' },
          { key: 'contactInfo.address.postalCode', label: 'Postal Code' },
          { key: 'contactInfo.address.country', label: 'Country' },
          
          // Metadata
          { 
            key: 'summary.createdAt', 
            label: 'Created Date',
            render: (value) => value ? new Date(value._seconds ? value._seconds * 1000 : value).toLocaleDateString() : 'Unknown'
          },
          { 
            key: 'summary.lastModified', 
            label: 'Last Modified',
            render: (value) => value ? new Date(value._seconds ? value._seconds * 1000 : value).toLocaleDateString() : 'Unknown'
          }
        ];
        break;
      case 'systemErrors':
        title = 'System Error Details';
        detailFields = [
          { key: 'id', label: 'ID' },
          {
            key: 'timestamp',
            label: 'Timestamp',
            render: (value, item) => formatTimestampMexico(item.timestamp)
          },
          { key: 'source', label: 'Source' },
          { key: 'module', label: 'Module' },
          { key: 'level', label: 'Level' },
          { key: 'message', label: 'Message' },
          {
            key: 'acknowledged',
            label: 'Status',
            render: (value) => value ? 'Acknowledged' : 'Active'
          },
          { key: 'environment', label: 'Environment' },
          { key: 'version', label: 'Version' },
          { key: 'url', label: 'URL' },
          { key: 'userAgent', label: 'User Agent' },
          {
            key: 'details',
            label: 'Details',
            render: (value) => value || 'No details'
          },
          { key: 'acknowledgedBy', label: 'Acknowledged By' },
          {
            key: 'acknowledgedAt',
            label: 'Acknowledged At',
            render: (value, item) => formatTimestampMexico(item.acknowledgedAt)
          },
        ];
        break;
      case 'polls':
        setPollDetail({ isOpen: true, pollId: selectedItem?.pollId || selectedItem?.id });
        return;
      default:
        title = 'Item Details';
        detailFields = Object.keys(selectedItem).map(key => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1)
        }));
    }
    
    setDetailModal({
      isOpen: true,
      item: selectedItem,
      title,
      fields: detailFields
    });
  };

  // Handle delete action
  const handleDelete = () => {
    if (!selectedItem || availableLists.length === 0 || tabIndex >= availableLists.length) return;
    
    const currentList = availableLists[tabIndex];
    // Get item name - polls use 'title', units use 'unitId', others use 'name'
    const itemName = selectedItem.name || selectedItem.title || selectedItem.unitId || selectedItem.id;
    
    // Show confirmation dialog
    setConfirmationDialog({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      onConfirm: () => performDelete(currentList, itemName)
    });
  };

  // Perform the actual deletion after confirmation
  const performDelete = async (currentList, itemName) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      alert('No client selected');
      return;
    }

    try {
      const deleteOperation = async () => {
        console.log(`🗑️ Deleting ${currentList.id}: ${itemName}`);
        
        switch (currentList.id) {
          case 'vendor':
            await deleteVendor(selectedClient.id, selectedItem.id);
            break;
          case 'category':
            await deleteCategory(selectedClient.id, selectedItem.id);
            break;
          case 'method':
            await deletePaymentMethod(selectedClient.id, selectedItem.id);
            break;
          case 'unit':
            // Units use unitId as their document ID, not id
            await deleteUnit(selectedClient.id, selectedItem.unitId || selectedItem.id);
            break;
          case 'users':
            await secureApi.deleteUser(selectedItem.id);
            break;
          case 'polls':
            await deletePoll(selectedClient.id, selectedItem.pollId || selectedItem.id);
            break;
          default:
            console.error('Unknown list type:', currentList.id);
            alert('Unknown list type');
            return;
        }
        
        console.log('✅ Item deleted successfully');
      };
      
      await handleSaveWithRefresh(deleteOperation, currentList.label.slice(0, -1).toLowerCase());
      
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      alert(`Failed to delete ${currentList.label.slice(0, -1).toLowerCase()}: ${error.message}`);
    }
  };
  
  // Handle closing any active modal
  const handleCloseModal = () => {
    setActiveModal({
      type: null,
      action: null,
      itemData: null
    });
  };

  // Handle closing confirmation dialog
  const handleCloseConfirmation = () => {
    setConfirmationDialog({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null
    });
  };

  // Handle closing detail modal
  const handleCloseDetailModal = () => {
    setDetailModal({
      isOpen: false,
      item: null,
      title: '',
      fields: []
    });
  };

  // Handle edit from detail modal
  const handleEditFromDetail = (item) => {
    const currentList = availableLists[tabIndex];
    setActiveModal({
      type: currentList.id,
      action: 'edit',
      itemData: item
    });
    handleCloseDetailModal();
  };

  // Handle item count changes from individual lists
  const handleItemCountChange = useCallback((count) => {
    updateEntryCount(count);
    // Also update the global status bar context
    setStatusInfo({
      type: 'listManagement',
      entryCount: count,
      searchTerm: searchTerm,
      isSearchActive: searchTerm && searchTerm.length > 0
    });
  }, [updateEntryCount, setStatusInfo, searchTerm]);

  // CSV Export handlers for each list type
  const handleExportCategories = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected');
      return;
    }
    try {
      const response = await getCategories(selectedClient.id);
      const categories = response.data || [];
      const headers = ['ID', 'Name', 'Description', 'Type', 'Status'];
      const rows = categories.map(cat => [
        cat.id || '',
        cat.name || '',
        cat.description || '',
        cat.type || '',
        cat.status === 'inactive' ? 'Inactive' : 'Active'
      ]);
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `categories-${selectedClient.id}-${dateStr}` });
    } catch (error) {
      console.error('Error exporting categories:', error);
      alert('Failed to export categories');
    }
  }, [selectedClient]);

  const handleExportVendors = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected');
      return;
    }
    try {
      const response = await getVendors(selectedClient.id);
      const vendors = response.data || [];
      const headers = ['ID', 'Name', 'Category', 'Contact', 'Email', 'Phone', 'Status'];
      const rows = vendors.map(v => [
        v.id || '',
        v.name || '',
        v.category || '',
        v.contactPerson || '',
        v.email || '',
        v.phone || '',
        v.status === 'inactive' ? 'Inactive' : 'Active'
      ]);
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `vendors-${selectedClient.id}-${dateStr}` });
    } catch (error) {
      console.error('Error exporting vendors:', error);
      alert('Failed to export vendors');
    }
  }, [selectedClient]);

  const handleExportPaymentMethods = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected');
      return;
    }
    try {
      const response = await getPaymentMethods(selectedClient.id);
      const methods = response.data || [];
      const headers = ['ID', 'Name', 'Type', 'Currency', 'Account Number', 'Status'];
      const rows = methods.map(m => [
        m.id || '',
        m.name || '',
        m.type || '',
        m.currency || '',
        m.details || '',
        m.status === 'inactive' ? 'Inactive' : 'Active'
      ]);
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `payment-methods-${selectedClient.id}-${dateStr}` });
    } catch (error) {
      console.error('Error exporting payment methods:', error);
      alert('Failed to export payment methods');
    }
  }, [selectedClient]);

  const handleExportUnits = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected');
      return;
    }
    try {
      const response = await getUnits(selectedClient.id);
      const units = response.data || [];
      const headers = ['Unit ID', 'Unit Name', 'Owners', 'Managers', 'Status', 'Property Type', 'Square Feet', 'Notes'];
      const rows = units.map(u => {
        // Format owners
        const owners = u.owners || [];
        const ownerNames = owners.map(o => o.name || '').filter(Boolean).join('; ');
        
        // Format managers
        const managers = u.managers || [];
        const managerNames = managers.map(m => m.name || '').filter(Boolean).join('; ');
        
        return [
          u.unitId || '',
          u.unitName || '',
          ownerNames,
          managerNames,
          u.status || 'active',
          u.propertyType || '',
          u.squareFeet || '',
          u.notes || ''
        ];
      });
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `units-${selectedClient.id}-${dateStr}` });
    } catch (error) {
      console.error('Error exporting units:', error);
      alert('Failed to export units');
    }
  }, [selectedClient]);

  const handleExportExchangeRates = useCallback(async () => {
    try {
      const rates = await fetchAllExchangeRates();
      const headers = ['Date', 'MXN_USD', 'MXN_CAD', 'MXN_EUR', 'MXN_COP'];
      const rows = rates.map(rate => {
        const ratesObj = rate.rates || {};
        return [
          rate.dateFormatted || rate.date || '',
          ratesObj.MXN_USD?.rate || '',
          ratesObj.MXN_CAD?.rate || '',
          ratesObj.MXN_EUR?.rate || '',
          ratesObj.MXN_COP?.rate || ''
        ];
      });
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `exchange-rates-${dateStr}` });
    } catch (error) {
      console.error('Error exporting exchange rates:', error);
      alert('Failed to export exchange rates');
    }
  }, []);

  const handleExportUsers = useCallback(async () => {
    try {
      const response = await secureApi.getSystemUsers();
      const users = response.users || [];
      const headers = ['Name', 'Email', 'Global Role', 'Client Access', 'Status', 'Last Login', 'Preferred Language', 'Preferred Currency', 'UID'];
      const rows = users.map(user => {
        // Format client access
        let clientAccess = 'None';
        if (user.propertyAccess) {
          const accessList = Object.entries(user.propertyAccess).map(([clientId, access]) => {
            return `${clientId}: ${access.role}`;
          });
          clientAccess = accessList.join('; ');
        }

        // Format last login
        let lastLogin = 'Never';
        if (user.firebaseMetadata?.lastSignInTime) {
          const lastSignIn = user.firebaseMetadata.lastSignInTime;
          if (lastSignIn.relative) {
            lastLogin = lastSignIn.relative;
          } else if (lastSignIn.display) {
            lastLogin = lastSignIn.display;
          } else {
            lastLogin = new Date(lastSignIn).toLocaleString();
          }
        }

        // Format status
        const status = user.accountState === 'disabled' ? 'Disabled' : 
                      user.canLogin === false ? 'Cannot Login' : 'Active';

        // Get display role
        const getUserDisplayRole = (user) => {
          if (user.email === 'michael@landesman.com') return 'SuperAdmin';
          if (user.globalRole === 'superAdmin') return 'SuperAdmin';
          if (user.globalRole === 'admin') return 'Admin';
          if (user.globalRole === 'unitOwner') return 'Unit Owner';
          if (user.globalRole === 'unitManager') return 'Unit Manager';
          return 'User';
        };

        // Get preferred language and currency (check common field locations)
        const preferredLanguage = user.preferences?.language || 
                                  user.profile?.preferredLanguage || 
                                  user.preferredLanguage || 
                                  '';
        const preferredCurrency = user.preferences?.currency || 
                                 user.profile?.preferredCurrency || 
                                 user.preferredCurrency || 
                                 '';
        
        // Get UID (could be user.id or user.uid)
        const uid = user.id || user.uid || '';

        return [
          user.profile?.displayName || user.name || '',
          user.email || '',
          getUserDisplayRole(user),
          clientAccess,
          status,
          lastLogin,
          preferredLanguage,
          preferredCurrency,
          uid
        ];
      });

      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV({ headers, rows, filename: `users-${dateStr}` });
    } catch (error) {
      console.error('Error exporting users:', error);
      alert('Failed to export users');
    }
  }, [secureApi]);

  // Get the appropriate export handler based on current tab
  const getCurrentExportHandler = useCallback(() => {
    if (availableLists.length === 0 || tabIndex >= availableLists.length) return null;
    const currentList = availableLists[tabIndex];
    switch (currentList.id) {
      case 'category':
        return handleExportCategories;
      case 'vendor':
        return handleExportVendors;
      case 'method':
        return handleExportPaymentMethods;
      case 'unit':
        return handleExportUnits;
      case 'exchangerates':
        return handleExportExchangeRates;
      case 'users':
        return handleExportUsers;
      default:
        return null;
    }
  }, [availableLists, tabIndex, handleExportCategories, handleExportVendors, handleExportPaymentMethods, handleExportUnits, handleExportExchangeRates, handleExportUsers]);
  
  // Handle saving vendor data (create or update)
  const handleSaveVendor = async (vendorData) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      alert('No client selected');
      return;
    }

    try {
      const saveOperation = async () => {
        if (activeModal.action === 'edit') {
          await updateVendor(selectedClient.id, activeModal.itemData.id, vendorData);
        } else {
          await createVendor(selectedClient.id, vendorData);
        }
      };
      
      await handleSaveWithRefresh(saveOperation, 'vendor');
      
    } catch (error) {
      console.error('❌ Error saving vendor:', error);
      alert(`Failed to save vendor: ${error.message}`);
    }
  };
  
  // Handle saving category data (create or update)
  const handleSaveCategory = async (categoryData) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      alert('No client selected');
      return;
    }

    try {
      const saveOperation = async () => {
        if (activeModal.action === 'edit') {
          // Update existing category - use the original category's document ID
          console.log(`✏️ Updating category: ${categoryData.name}`);
          await updateCategory(selectedClient.id, activeModal.itemData.id, categoryData);
          console.log('✅ Category updated successfully');
        } else {
          // Create new category
          console.log(`➕ Creating category: ${categoryData.name}`);
          await createCategory(selectedClient.id, categoryData);
          console.log('✅ Category created successfully');
        }
      };
      
      await handleSaveWithRefresh(saveOperation, 'category');
      
    } catch (error) {
      console.error('❌ Error saving category:', error);
      alert(`Failed to save category: ${error.message}`);
    }
  };
  
  // Handle saving payment method data (create or update)
  const handleSavePaymentMethod = async (methodData) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      alert('No client selected');
      return;
    }

    try {
      const saveOperation = async () => {
        if (activeModal.action === 'edit') {
          // Update existing payment method - use the original method's document ID
          console.log(`✏️ Updating payment method: ${methodData.name}`);
          await updatePaymentMethod(selectedClient.id, activeModal.itemData.id, methodData);
          console.log('✅ Payment method updated successfully');
        } else {
          // Create new payment method
          console.log(`➕ Creating payment method: ${methodData.name}`);
          await createPaymentMethod(selectedClient.id, methodData);
          console.log('✅ Payment method created successfully');
        }
      };
      
      await handleSaveWithRefresh(saveOperation, 'payment method');
      
    } catch (error) {
      console.error('❌ Error saving payment method:', error);
      alert(`Failed to save payment method: ${error.message}`);
    }
  };
  
  // Handle saving unit data (create or update)
  const handleSaveUnit = async (unitData) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      alert('No client selected');
      return;
    }

    try {
      const saveOperation = async () => {
        // For units, we need to use unitId as the document ID (since units don't have an 'id' field)
        // The activeModal.itemData will have unitId from the backend's listUnits function
        if (activeModal.action === 'edit' && activeModal.itemData?.unitId) {
          // Update existing unit - use unitId as the document ID
          await updateUnit(selectedClient.id, activeModal.itemData.unitId, unitData);
          console.log('✅ Unit updated successfully');
        } else {
          // Create new unit
          await createUnit(selectedClient.id, unitData);
          console.log('✅ Unit created successfully');
        }
      };
      
      await handleSaveWithRefresh(saveOperation, 'unit');
      
    } catch (error) {
      console.error('❌ Error saving unit:', error);
      alert(`Failed to save unit: ${error.message}`);
    }
  };
  
  // Handle user update (for EditUserModal - matches UserManagement.handleUpdateUser signature)
  const handleUpdateUser = async (userId, updateData) => {
    try {
      console.log('🔄 handleUpdateUser: Updating user', userId, updateData);
      const result = await secureApi.updateUser(userId, updateData);
      console.log('✅ handleUpdateUser: Update successful', result);
      
      setRefreshTrigger(prev => prev + 1);
      
      // Fetch fresh user data to update modals
      try {
        console.log('🔄 handleUpdateUser: Fetching fresh user data...');
        const usersResponse = await secureApi.getSystemUsers();
        const updatedUser = usersResponse.users?.find(u => u.id === userId);
        console.log('📦 handleUpdateUser: Found updated user', updatedUser);
        
        if (updatedUser) {
          // Update selectedItem if it matches the updated user
          if (selectedItem?.id === userId) {
            console.log('🔄 handleUpdateUser: Updating selectedItem');
            setSelectedItem(updatedUser);
          }
          // Update activeModal.itemData if it matches the updated user
          if (activeModal.itemData?.id === userId) {
            console.log('🔄 handleUpdateUser: Updating activeModal.itemData');
            setActiveModal(prev => ({
              ...prev,
              itemData: { ...updatedUser } // Create new object reference
            }));
          }
          // Update detailModal.item if it matches the updated user
          if (detailModal.item?.id === userId) {
            console.log('🔄 handleUpdateUser: Updating detailModal.item');
            setDetailModal(prev => ({
              ...prev,
              item: { ...updatedUser } // Create new object reference
            }));
          }
        } else {
          console.warn('⚠️ handleUpdateUser: Updated user not found in response');
        }
      } catch (fetchError) {
        console.error('❌ handleUpdateUser: Could not fetch updated user data:', fetchError);
        // Continue anyway - the refreshTrigger will cause a reload
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error; // Re-throw so the modal can handle the error
    }
  };

  // Handle user creation
  const handleCreateUser = async (userData) => {
    try {
      const result = await secureApi.createUser(userData);
      handleCloseModal();
      setRefreshTrigger(prev => prev + 1);
      return result;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error; // Let the modal handle the error display
    }
  };

  // Handle client creation
  const handleCreateClient = async (clientData) => {
    try {
      const { createClientApi } = await import('../api/clientManagement');
      const result = await createClientApi(clientData);
      handleCloseModal();
      setRefreshTrigger(prev => prev + 1);
      return result;
    } catch (error) {
      console.error('❌ Error creating client:', error);
      throw error;
    }
  };

  // Handle client update
  const handleUpdateClient = async (clientId, updateData) => {
    try {
      const { updateClientApi } = await import('../api/clientManagement');
      const result = await updateClientApi(clientId, updateData);
      handleCloseModal();
      setRefreshTrigger(prev => prev + 1);
      return result;
    } catch (error) {
      console.error('❌ Error updating client:', error);
      throw error;
    }
  };

  const handleSavePoll = async (pollData) => {
    if (!selectedClient?.id) {
      alert('No client selected');
      return;
    }

    try {
      const saveOperation = async () => {
        if (activeModal.action === 'edit' && activeModal.itemData?.pollId) {
          await updatePoll(selectedClient.id, activeModal.itemData.pollId, pollData);
        } else if (activeModal.action === 'edit' && activeModal.itemData?.id) {
          await updatePoll(selectedClient.id, activeModal.itemData.id, pollData);
        } else {
          await createPoll(selectedClient.id, pollData);
        }
      };

      await handleSaveWithRefresh(saveOperation, 'poll');
    } catch (error) {
      console.error('❌ Error saving poll:', error);
      alert(`Failed to save poll: ${error.message}`);
    }
  };
  
  // Generate the proper modal based on activeModal state
  const renderModal = () => {
    if (!activeModal.type) {
      return null;
    }
    
    // Create the right modal based on type
    switch (activeModal.type) {
      case 'vendor':
        return (
          <VendorFormModal 
            isOpen={true} 
            onClose={handleCloseModal} 
            onSave={handleSaveVendor}
            vendor={activeModal.action === 'edit' ? activeModal.itemData : null}
            isEdit={activeModal.action === 'edit'}
          />
        );
      case 'category':
        return (
          <CategoryFormModal 
            isOpen={true} 
            onClose={handleCloseModal} 
            onSave={handleSaveCategory}
            category={activeModal.action === 'edit' ? activeModal.itemData : null}
            isEdit={activeModal.action === 'edit'}
          />
        );
      case 'method':
        return (
          <PaymentMethodFormModal 
            isOpen={true} 
            onClose={handleCloseModal} 
            onSave={handleSavePaymentMethod}
            paymentMethod={activeModal.action === 'edit' ? activeModal.itemData : null}
            isEdit={activeModal.action === 'edit'}
          />
        );
      case 'unit':
        return (
          <UnitFormModal 
            isOpen={true} 
            onClose={handleCloseModal} 
            onSave={handleSaveUnit}
            unit={activeModal.action === 'edit' ? activeModal.itemData : null}
          />
        );
      case 'users':
        return activeModal.action === 'add' ? (
          <CreateUserModal
            onClose={handleCloseModal}
            onCreate={handleCreateUser}
            currentUser={samsUser}
            selectedClient={selectedClient}
          />
        ) : (
          <EditUserModal
            key={activeModal.itemData?.id} // Force re-render when user changes
            user={activeModal.itemData}
            onClose={handleCloseModal}
            onUpdate={handleUpdateUser}
            currentUser={samsUser}
          />
        );
      case 'clients':
        return (
          <ClientFormModal
            open={true}
            onClose={handleCloseModal}
            onSubmit={activeModal.action === 'add' ? handleCreateClient : (updates) => handleUpdateClient(activeModal.itemData?.id, updates)}
            mode={activeModal.action === 'add' ? 'create' : 'edit'}
            title={activeModal.action === 'add' ? 'Add New Client' : 'Edit Client'}
            initialData={activeModal.action === 'edit' ? activeModal.itemData : null}
          />
        );
      case 'polls':
        return (
          <PollCreationWizard
            isOpen={true}
            onClose={handleCloseModal}
            onSave={handleSavePoll}
            poll={activeModal.action === 'edit' ? activeModal.itemData : null}
            isEdit={activeModal.action === 'edit'}
          />
        );
      // TODO: Implement other modals as needed
      default:
        return null;
    }
  };
  
  if (!selectedClient) {
    return (
      <div className="view-container">
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select a client to manage lists
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="view-container">
        <div className="list-loading-container">
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Loading lists...
          </Typography>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-container">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </div>
    );
  }

  if (availableLists.length === 0) {
    return (
      <div className="view-container">
        <Alert severity="info" sx={{ mt: 2 }}>
          No manageable lists are available for this client type
        </Alert>
      </div>
    );
  }

  // Check if current tab is admin component type or read-only
  const currentList = availableLists[tabIndex];
  const isAdminComponent = currentList?.componentType === 'admin-component';
  const isReadOnlyTab = currentList?.id === 'exchangerates' || currentList?.id === 'systemErrors';

  return (
    <div className="view-container">
      {/* ActionBar with client name and action buttons - matches TransactionsView */}
      <ActivityActionBar>
        {!isAdminComponent && !isReadOnlyTab && (
          <>
            <button className="action-item" onClick={handleAddNew}>
              <FontAwesomeIcon icon={faPlus} />
              <span>Add New</span>
            </button>
            <button 
              className={`action-item ${!selectedItem ? 'disabled' : ''}`} 
              onClick={handleEditItem}
              disabled={!selectedItem}
            >
              <FontAwesomeIcon icon={faEdit} />
              <span>Edit</span>
            </button>
            <button 
              className={`action-item ${!selectedItem || (tabIndex >= 0 && availableLists[tabIndex]?.id === 'clients') ? 'disabled' : ''}`}
              onClick={handleDelete}
              disabled={!selectedItem || (tabIndex >= 0 && availableLists[tabIndex]?.id === 'clients')}
              title={tabIndex >= 0 && availableLists[tabIndex]?.id === 'clients' ? 'Client deletion is not available yet' : 'Delete'}
            >
              <FontAwesomeIcon icon={faTrash} />
              <span>Delete</span>
            </button>
            <button 
              className={`action-item ${!selectedItem ? 'disabled' : ''}`}
              onClick={handleViewDetails}
              disabled={!selectedItem}
            >
              <FontAwesomeIcon icon={faEye} />
              <span>View Details</span>
            </button>
            {getCurrentExportHandler() && (
              <ExportMenu
                onExportCSV={getCurrentExportHandler()}
              />
            )}
          </>
        )}
        {isAdminComponent && (
          <>
            <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
              User management controls are within the component below
            </div>
            {getCurrentExportHandler() && (
              <ExportMenu
                onExportCSV={getCurrentExportHandler()}
              />
            )}
          </>
        )}
        {isReadOnlyTab && (
          <>
            <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
              {currentList?.id === 'systemErrors'
                ? 'System errors are read-only. Acknowledge/dismiss from the Dashboard card.'
                : 'Exchange rates are read-only. Use Settings → Exchange Rates for management functions.'}
            </div>
            {getCurrentExportHandler() && (
              <ExportMenu
                onExportCSV={getCurrentExportHandler()}
              />
            )}
          </>
        )}
      </ActivityActionBar>

      {/* Tabs below ActionBar - matches TransactionsView layout */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange} 
          aria-label="list management tabs"
          className="list-management-tabs"
          variant={availableLists.length > 4 ? "scrollable" : "standard"}
          scrollButtons={availableLists.length > 4 ? "auto" : "disabled"}
        >
          {availableLists.map(list => (
            <Tab key={list.id} label={list.label} />
          ))}
        </Tabs>
      </Box>
      
      {/* Tab content */}
      {availableLists.map((list, index) => {
        const ListComponent = list.component;
        return (
          <TabPanel key={`${list.id}-${refreshTrigger}`} value={tabIndex} index={index}>
            {list.componentType === 'admin-component' ? (
              // Admin components like ClientManagement handle their own state
              <ListComponent />
            ) : (
              // Regular list components need standard props
              <ListComponent 
                key={refreshTrigger} // Force re-render when data changes
                selectedItem={selectedItem}
                onItemSelect={setSelectedItem}
                onDelete={handleDelete}
                onViewDetail={handleViewDetails}
                onItemCountChange={handleItemCountChange}
                onSelectionChange={setSelectedItem}
                refreshTrigger={refreshTrigger}
                searchTerm={searchTerm}
              />
            )}
          </TabPanel>
        );
      })}
      
      {/* Render the appropriate modal */}
      {renderModal()}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={handleCloseConfirmation}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        message={confirmationDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmButtonClass="danger"
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        key={detailModal.item?.id || detailModal.item?.unitId || 'detail-modal'} // Force re-render when item changes
        open={detailModal.isOpen}
        onClose={handleCloseDetailModal}
        onEdit={handleEditFromDetail}
        item={detailModal.item}
        title={detailModal.title}
        fields={detailModal.fields}
        editable={true}
      />

      <PollDetailView
        open={pollDetail.isOpen}
        onClose={() => setPollDetail({ isOpen: false, pollId: null })}
        clientId={selectedClient?.id}
        pollId={pollDetail.pollId}
        onEdit={(poll) => {
          setActiveModal({
            type: 'polls',
            action: 'edit',
            itemData: poll
          });
          setPollDetail({ isOpen: false, pollId: null });
        }}
      />
    </div>
  );
}

export default ListManagementView;
// Force rebuild: Mon Jun 30 19:49:27 EST 2025
