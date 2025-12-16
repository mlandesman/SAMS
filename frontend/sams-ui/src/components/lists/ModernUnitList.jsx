import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { getUnits } from '../../api/units';
import { getOwnerNames, getManagerNames, normalizeOwners, normalizeManagers } from '../../utils/unitContactUtils';

const ModernUnitList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '' }) => {
  const { selectedClient } = useClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailUnit, setDetailUnit] = useState(null);

  // Define the columns for the unit list - Unit ID, Owner Names, Managers, Status, and Notes
  const columns = [
    { field: 'unitId', headerName: 'Unit ID', searchable: true, width: '10%' },
    { 
      field: 'owners', 
      headerName: 'Owners', 
      searchable: true, 
      width: '25%',
      render: (item) => {
        try {
          if (!item || !item.owners) return '';
          if (!getOwnerNames) {
            console.error('getOwnerNames function is not defined!');
            // Fallback: try to extract names manually
            if (Array.isArray(item.owners)) {
              return item.owners.map(o => typeof o === 'string' ? o : (o?.name || '')).filter(Boolean).join(', ');
            }
            return '';
          }
          const ownerNames = getOwnerNames(item.owners);
          if (!Array.isArray(ownerNames)) {
            console.error('getOwnerNames returned non-array:', ownerNames, 'for item:', item);
            // Fallback: try to extract names manually
            if (Array.isArray(item.owners)) {
              return item.owners.map(o => typeof o === 'string' ? o : (o?.name || '')).filter(Boolean).join(', ');
            }
            return '';
          }
          return ownerNames.length > 0 ? ownerNames.join(', ') : '';
        } catch (error) {
          console.error('Error rendering owners:', error, 'item:', item);
          // Fallback: try to extract names manually
          if (Array.isArray(item?.owners)) {
            return item.owners.map(o => typeof o === 'string' ? o : (o?.name || '')).filter(Boolean).join(', ');
          }
          return '';
        }
      }
    },
    { 
      field: 'managers', 
      headerName: 'Managers', 
      searchable: true, 
      width: '25%',
      render: (item) => {
        try {
          if (!item || !item.managers) return '';
          if (!getManagerNames) {
            console.error('getManagerNames function is not defined!');
            // Fallback: try to extract names manually
            if (Array.isArray(item.managers)) {
              return item.managers.map(m => typeof m === 'string' ? m : (m?.name || '')).filter(Boolean).join(', ');
            }
            return '';
          }
          const managerNames = getManagerNames(item.managers);
          if (!Array.isArray(managerNames)) {
            console.error('getManagerNames returned non-array:', managerNames, 'for item:', item);
            // Fallback: try to extract names manually
            if (Array.isArray(item.managers)) {
              return item.managers.map(m => typeof m === 'string' ? m : (m?.name || '')).filter(Boolean).join(', ');
            }
            return '';
          }
          return managerNames.length > 0 ? managerNames.join(', ') : '';
        } catch (error) {
          console.error('Error rendering managers:', error, 'item:', item);
          // Fallback: try to extract names manually
          if (Array.isArray(item?.managers)) {
            return item.managers.map(m => typeof m === 'string' ? m : (m?.name || '')).filter(Boolean).join(', ');
          }
          return '';
        }
      }
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      searchable: false,
      width: '12%',
      render: (item) => (
        <span className={`status-${(item.status || 'active').toLowerCase()}`}>
          {item.status || 'active'}
        </span>
      )
    },
    { 
      field: 'notes', 
      headerName: 'Notes', 
      searchable: true, 
      width: '28%',
      render: (item) => {
        if (!item.notes) return '';
        // Truncate long notes for table display
        return item.notes.length > 50 ? `${item.notes.substring(0, 50)}...` : item.notes;
      }
    },
  ];

  // Define detail modal fields
  const detailFields = [
    { key: 'unitId', label: 'Unit ID' },
    { key: 'unitName', label: 'Unit Name' },
    { key: 'address', label: 'Address' },
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
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'propertyType', label: 'Property Type' },
    { key: 'squareFeet', label: 'Square Feet', type: 'squareFeet' },
    { 
      key: 'squareMeters', 
      label: 'Square Meters', 
      render: (value, item) => {
        // Calculate square meters from square feet (don't store this field)
        const squareFeet = item.squareFeet;
        if (!squareFeet) return 'Not specified';
        const squareMeters = squareFeet * 0.092903;
        return `${Number(squareMeters).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sq m`;
      }
    },
    { key: 'percentOwned', label: 'Percentage Owned', type: 'percentage' },
    { key: 'duesAmount', label: 'Monthly Dues', type: 'money' },
    { key: 'accessCode', label: 'Access Code' },
    { key: 'notes', label: 'Notes', type: 'multiline' }
  ];
  
  // API fetch function for units
  const fetchUnits = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected, cannot fetch units');
      return [];
    }

    try {
      const response = await getUnits(selectedClient.id);
      return response.data || [];
    } catch (error) {
      console.error('❌ Error fetching units:', error);
      throw error;
    }
  }, [selectedClient?.id]);

  // Handle view detail
  const handleViewDetail = useCallback((unit) => {
    setDetailUnit(unit);
    setDetailModalOpen(true);
  }, []);

  return (
    <>
      <ModernBaseList
        fetchItems={fetchUnits}
        onViewDetail={() => handleViewDetail(selectedItem)}
        onItemSelect={onItemSelect}
        selectedItem={selectedItem}
        onItemCountChange={onItemCountChange}
        searchTerm={searchTerm}
        columns={columns}
        emptyMessage="No units found. Click 'Add New' to create your first unit."
        sortField="unitId"
      />

      {/* Detail Modal */}
      <ItemDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        item={detailUnit}
        title="Unit Details"
        fields={detailFields}
        editable={false}
      />
    </>
  );
};

export default ModernUnitList;
