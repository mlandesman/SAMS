import React, { useState, useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { useClient } from '../../context/ClientContext';
import { getCategories } from '../../api/categories';

const ModernCategoryList = ({ selectedItem, onItemSelect, onItemCountChange, searchTerm = '' }) => {
  const { selectedClient } = useClient();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailCategory, setDetailCategory] = useState(null);

  // Define the columns for the category list
  const columns = [
    { field: 'name', headerName: 'Name', searchable: true, width: '30%' },
    { field: 'type', headerName: 'Type', searchable: true, width: '20%' },
    { field: 'description', headerName: 'Description', searchable: true, width: '35%' },
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
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'code', label: 'Category Code' },
    { key: 'parentCategory', label: 'Parent Category' },
    { key: 'status', label: 'Status', type: 'status' }
  ];
  
  // API fetch function for categories
  const fetchCategories = useCallback(async () => {
    if (!selectedClient?.id) {
      console.warn('No client selected, cannot fetch categories');
      return [];
    }

    try {
      console.log(`📋 Fetching categories for client: ${selectedClient.id}`);
      const response = await getCategories(selectedClient.id);
      return response.data || [];
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      throw error;
    }
  }, [selectedClient?.id]);

  // Handle view detail
  const handleViewDetail = useCallback((category) => {
    setDetailCategory(category);
    setDetailModalOpen(true);
  }, []);

  return (
    <>
      <ModernBaseList
        fetchItems={fetchCategories}
        onViewDetail={() => handleViewDetail(selectedItem)}
        onItemSelect={onItemSelect}
        selectedItem={selectedItem}
        onItemCountChange={onItemCountChange}
        searchTerm={searchTerm}
        columns={columns}
        emptyMessage="No categories found. Click 'Add New' to create your first category."
      />

      {/* Detail Modal */}
      <ItemDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        item={detailCategory}
        title="Category Details"
        fields={detailFields}
        editable={false}
      />
    </>
  );
};

export default ModernCategoryList;
