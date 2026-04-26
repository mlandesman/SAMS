import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { useDesktopLanguage } from '../../context/DesktopLanguageContext';
import { getVendors } from '../../api/vendors';
import { resolveListEntityField } from '../../utils/listLocalization';

const ModernVendorList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '', refreshTrigger = 0 }) => {
  const { selectedClient } = useClient();
  const { language, localizationEnabled } = useDesktopLanguage();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState(null);

  // Define the columns for the vendor list
  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      searchable: true,
      width: '25%',
      render: (item) =>
        resolveListEntityField(item, 'vendor', 'name', { language, localizationEnabled, hardFallback: item.id || '' }),
      searchValue: (item) => resolveListEntityField(item, 'vendor', 'name', { language, localizationEnabled }),
    },
    {
      field: 'category',
      headerName: 'Category',
      searchable: true,
      width: '20%',
      render: (item) => resolveListEntityField(item, 'vendor', 'category', { language, localizationEnabled }),
      searchValue: (item) => resolveListEntityField(item, 'vendor', 'category', { language, localizationEnabled }),
    },
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
    {
      key: 'name',
      label: 'Name',
      render: (value, item) =>
        resolveListEntityField(item, 'vendor', 'name', { language, localizationEnabled, hardFallback: item.id || '' }),
    },
    {
      key: 'category',
      label: 'Category',
      render: (value, item) => resolveListEntityField(item, 'vendor', 'category', { language, localizationEnabled }),
    },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'phone' },
    { key: 'website', label: 'Website', type: 'url' },
    {
      key: 'address',
      label: 'Address',
      type: 'multiline',
      render: (value, item) => resolveListEntityField(item, 'vendor', 'address', { language, localizationEnabled }),
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'multiline',
      render: (value, item) => resolveListEntityField(item, 'vendor', 'notes', { language, localizationEnabled }),
    },
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
        refreshTrigger={refreshTrigger}
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
