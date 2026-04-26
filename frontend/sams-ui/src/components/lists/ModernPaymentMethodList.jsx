import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { useDesktopLanguage } from '../../context/DesktopLanguageContext';
import { getPaymentMethods } from '../../api/paymentMethods';
import { resolveListEntityField } from '../../utils/listLocalization';

const ModernPaymentMethodList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '', refreshTrigger = 0 }) => {
  const { selectedClient } = useClient();
  const { language, localizationEnabled } = useDesktopLanguage();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailPaymentMethod, setDetailPaymentMethod] = useState(null);

  // Define the columns for the payment method list
  const columns = [
    {
      field: 'name',
      headerName: 'Name',
      searchable: true,
      width: '25%',
      render: (item) =>
        resolveListEntityField(item, 'method', 'name', { language, localizationEnabled, hardFallback: item.id || '' }),
      searchValue: (item) => resolveListEntityField(item, 'method', 'name', { language, localizationEnabled }),
    },
    {
      field: 'type',
      headerName: 'Type',
      searchable: true,
      width: '20%',
      render: (item) => resolveListEntityField(item, 'method', 'type', { language, localizationEnabled }),
      searchValue: (item) => resolveListEntityField(item, 'method', 'type', { language, localizationEnabled }),
    },
    { field: 'currency', headerName: 'Currency', searchable: true, width: '15%' },
    {
      field: 'details',
      headerName: 'Account Number',
      searchable: true,
      width: '25%',
      render: (item) => resolveListEntityField(item, 'method', 'details', { language, localizationEnabled }),
      searchValue: (item) => resolveListEntityField(item, 'method', 'details', { language, localizationEnabled }),
    },
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
        resolveListEntityField(item, 'method', 'name', { language, localizationEnabled, hardFallback: item.id || '' }),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value, item) => resolveListEntityField(item, 'method', 'type', { language, localizationEnabled }),
    },
    { key: 'currency', label: 'Currency', type: 'currency' },
    {
      key: 'details',
      label: 'Account Number',
      render: (value, item) => resolveListEntityField(item, 'method', 'details', { language, localizationEnabled }),
    },
    {
      key: 'description',
      label: 'Description',
      type: 'multiline',
      render: (value, item) => resolveListEntityField(item, 'method', 'description', { language, localizationEnabled }),
    },
    {
      key: 'institution',
      label: 'Financial Institution',
      render: (value, item) => resolveListEntityField(item, 'method', 'institution', { language, localizationEnabled }),
    },
    { key: 'status', label: 'Status', type: 'status' }
  ];
  
  // API fetch function for payment methods
  const fetchPaymentMethods = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected, cannot fetch payment methods');
      return [];
    }

    try {
      console.log(`📋 Fetching payment methods for client: ${selectedClient.id}`);
      const response = await getPaymentMethods(selectedClient.id);
      return response.data || [];
    } catch (error) {
      console.error('❌ Error fetching payment methods:', error);
      throw error;
    }
  }, [selectedClient?.id]);

  // Handle view detail
  const handleViewDetail = useCallback((paymentMethod) => {
    setDetailPaymentMethod(paymentMethod);
    setDetailModalOpen(true);
  }, []);

  return (
    <>
      <ModernBaseList
        fetchItems={fetchPaymentMethods}
        onViewDetail={() => handleViewDetail(selectedItem)}
        onItemSelect={onItemSelect}
        selectedItem={selectedItem}
        onItemCountChange={onItemCountChange}
        searchTerm={searchTerm}
        columns={columns}
        emptyMessage="No payment methods found. Click 'Add New' to create your first payment method."
        refreshTrigger={refreshTrigger}
      />

      {/* Detail Modal */}
      <ItemDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        item={detailPaymentMethod}
        title="Payment Method Details"
        fields={detailFields}
        editable={false}
      />
    </>
  );
};

export default ModernPaymentMethodList;
