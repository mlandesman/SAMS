import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { getVendors } from '../../api/vendors';

const ModernVendorList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '' }) => {
  const { selectedClient } = useClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState(null);

  // Define the columns for the vendor list
  const columns = [
    { field: 'name', headerName: 'Name', searchable: true, width: '25%' },
    { field: 'category', headerName: 'Category', searchable: true, width: '20%' },
    { field: 'email', headerName: 'Email', searchable: true, width: '25%' },
    { field: 'phone', headerName: 'Phone', searchable: false, width: '15%' },
    { 
      field: 'status', 
      headerName: 'Status', 
      searchable: false,
      width: '15%',
      render: (item) => (
        <span className={`status-${item.status || 'active'}`}>
          {item.status === 'inactive' ? 'Inactive' : 'Active'}
        </span>
      )
    },
  ];

  // Define detail modal fields
  const detailFields = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'website', label: 'Website', type: 'url' },
    { key: 'address', label: 'Address', type: 'multiline' },
    { key: 'notes', label: 'Notes', type: 'multiline' },
    { key: 'status', label: 'Status', type: 'status' }
  ];
  
  // API fetch function for vendors
  const fetchVendors = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected, cannot fetch vendors');
      return [];
    }

    try {
      console.log(`📋 Fetching vendors for client: ${selectedClient.id}`);
      const response = await getVendors(selectedClient.id);
      return response.data || [];
    } catch (error) {
      console.error('❌ Error fetching vendors:', error);
      throw error;
    }
  }, [selectedClient?.id]);

  // Handle view detail
  const handleViewDetail = useCallback((vendor) => {
    setDetailVendor(vendor);
    setDetailModalOpen(true);
  }, []);

  return (
    <>
      <ModernBaseList
        fetchItems={fetchVendors}
        onViewDetail={() => handleViewDetail(selectedItem)}
        onItemSelect={onItemSelect}
        selectedItem={selectedItem}
        onItemCountChange={onItemCountChange}
        searchTerm={searchTerm}
        columns={columns}
        emptyMessage="No vendors found. Click 'Add New' to create your first vendor."
      />

      {/* Detail Modal */}
      <ItemDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        item={detailVendor}
        title="Vendor Details"
        fields={detailFields}
        editable={false}
      />
    </>
  );
};

export default ModernVendorList;
