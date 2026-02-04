import React, { useCallback } from 'react';
import ModernBaseList from '../lists/ModernBaseList';
import { useClient } from '../../context/ClientContext';
import { getPolls } from '../../api/polls';

const formatDate = (value) => {
  if (!value) return '—';
  return value.display || value.ISO_8601 || value.iso || '—';
};

const formatStatus = (status) => {
  if (!status) return 'Draft';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const PollsList = ({ selectedItem, onItemSelect, onItemCountChange, onViewDetail, searchTerm = '', refreshTrigger = 0 }) => {
  const { selectedClient } = useClient();

  const columns = [
    { field: 'title', headerName: 'Title', searchable: true, width: '40%' },
    { field: 'status', headerName: 'Status', searchable: false, width: '15%', render: (item) => formatStatus(item.status) },
    { field: 'type', headerName: 'Type', searchable: true, width: '15%', render: (item) => (item.type === 'vote' ? 'Vote' : 'Poll') },
    { field: 'closesAt', headerName: 'Closes', searchable: false, width: '15%', render: (item) => formatDate(item.closesAt) },
    { field: 'category', headerName: 'Category', searchable: true, width: '15%' },
  ];

  const fetchPolls = useCallback(async () => {
    if (!selectedClient?.id) {
      return [];
    }
    const response = await getPolls(selectedClient.id);
    return response.data || [];
  }, [selectedClient?.id]);

  return (
    <ModernBaseList
      fetchItems={fetchPolls}
      onViewDetail={onViewDetail}
      onItemSelect={onItemSelect}
      selectedItem={selectedItem}
      onItemCountChange={onItemCountChange}
      searchTerm={searchTerm}
      columns={columns}
      emptyMessage="No polls found. Click 'Add New' to create your first poll."
      refreshTrigger={refreshTrigger}
      sortField="title"
    />
  );
};

export default PollsList;
