import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { getPaymentMethods } from '../../api/paymentMethods';

const ModernPaymentMethodList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '', refreshTrigger = 0 }) => {
  const { selectedClient } = useClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailPaymentMethod, setDetailPaymentMethod] = useState(null);

  // Define the columns for the payment method list
  const columns = [
    { field: 'name', headerName: 'Name', searchable: true, width: '25%' },
    { field: 'type', headerName: 'Type', searchable: true, width: '20%' },
    { field: 'currency', headerName: 'Currency', searchable: true, width: '15%' },
    { field: 'details', headerName: 'Account Number', searchable: true, width: '25%' },
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
    { key: 'type', label: 'Type' },
    { key: 'currency', label: 'Currency', type: 'currency' },
    { key: 'details', label: 'Account Number' },
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'institution', label: 'Financial Institution' },
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
