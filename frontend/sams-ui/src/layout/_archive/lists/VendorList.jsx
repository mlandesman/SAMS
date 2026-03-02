import React, { useState, useCallback } from 'react';
import BaseList from './BaseList';
import { useClient } from '../../context/ClientContext';
import { getVendors, deleteVendor } from '../../api/vendors';
import DeleteConfirmationModal from '../modals/DeleteConfirmationModal';

const VendorList = ({ onEdit }) => {
  const { selectedClient } = useClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);

  // Define the columns for the vendor list
  const columns = [
    { field: 'name', headerName: 'Name', searchable: true },
    { field: 'category', headerName: 'Category', searchable: true },
    { field: 'email', headerName: 'Email', searchable: true },
    { field: 'phone', headerName: 'Phone', searchable: false },
    { 
      field: 'status', 
      headerName: 'Status', 
      searchable: false,
      render: (item) => (
        <span className={`status-${item.status || 'active'}`}>
          {item.status === 'inactive' ? 'Inactive' : 'Active'}
        </span>
      )
    },
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
  
  const handleDeleteVendor = (vendor) => {
    if (!selectedClient?.id) {
      console.error('No client selected');
      return;
    }

    setVendorToDelete(vendor);
    setDeleteModalOpen(true);
  };

  // Confirm and execute deletion
  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return;

    try {
      console.log(`🗑️ Deleting vendor: ${vendorToDelete.name}`);
      await deleteVendor(selectedClient.id, vendorToDelete.id);
      
      // Trigger refresh by changing the key
      setRefreshKey(prev => prev + 1);
      
      console.log('✅ Vendor deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting vendor:', error);
      alert(`Failed to delete vendor: ${error.message}`);
    } finally {
      setDeleteModalOpen(false);
      setVendorToDelete(null);
    }
  };

  // Cancel deletion
  const cancelDeleteVendor = () => {
    setDeleteModalOpen(false);
    setVendorToDelete(null);
  };

  // Trigger refresh when component receives new data
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <>
      <BaseList
        key={refreshKey} // This will cause BaseList to re-mount and refresh data
        title="Vendors"
        fetchItems={fetchVendors}
        onEdit={onEdit}
        onDelete={handleDeleteVendor}
        onRefresh={handleRefresh}
        columns={columns}
        emptyMessage="No vendors found. Click 'Add New' to create your first vendor."
        searchPlaceholder="Search vendors..."
      />
      
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={cancelDeleteVendor}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        itemName={vendorToDelete?.name}
        itemType="vendor"
      />
    </>
  );
};

export default VendorList;
