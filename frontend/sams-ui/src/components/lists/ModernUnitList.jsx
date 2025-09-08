import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { getUnits } from '../../api/units';

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
        if (!item.owners || !Array.isArray(item.owners)) return '';
        return item.owners.join(', ');
      }
    },
    { 
      field: 'managers', 
      headerName: 'Managers', 
      searchable: true, 
      width: '25%',
      render: (item) => {
        if (!item.managers || !Array.isArray(item.managers)) return '';
        return item.managers.join(', ');
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
      label: 'Owner Names',
      render: (value) => {
        if (!value || !Array.isArray(value)) return 'Not specified';
        return value.join(', ');
      }
    },
    { 
      key: 'emails', 
      label: 'Email Addresses',
      render: (value) => {
        if (!value || !Array.isArray(value)) return 'Not specified';
        return value.join(', ');
      }
    },
    { 
      key: 'managers', 
      label: 'Unit Managers',
      render: (value) => {
        if (!value || !Array.isArray(value)) return 'None assigned';
        return value.join(', ');
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
