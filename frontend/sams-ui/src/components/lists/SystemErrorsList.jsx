import React, { useCallback } from 'react';
import ModernBaseList from './ModernBaseList';
import { getAllSystemErrors } from '../../api/systemErrors';
import { formatTimestampMexico } from '../../utils/timezone';
import { Chip } from '@mui/material';

const MODULE_COLORS = {
  email: 'warning',
  payment: 'error',
  statement: 'info',
  auth: 'secondary',
  water: 'info',
  budget: 'warning',
  general: 'default',
};

const SystemErrorsList = ({
  selectedItem,
  onItemSelect,
  onItemCountChange,
  onViewDetail,
  searchTerm = '',
  refreshTrigger = 0,
}) => {
  const columns = [
    {
      field: 'timestamp',
      headerName: 'Time',
      searchable: false,
      width: '15%',
      render: (item) => formatTimestampMexico(item.timestamp),
    },
    {
      field: 'source',
      headerName: 'Source',
      searchable: true,
      width: '10%',
      render: (item) => (
        <Chip
          label={item.source === 'backend' ? 'Backend' : 'Frontend'}
          size="small"
          color={item.source === 'backend' ? 'info' : 'warning'}
          sx={{ height: 22 }}
        />
      ),
    },
    {
      field: 'module',
      headerName: 'Module',
      searchable: true,
      width: '10%',
      render: (item) => (
        <Chip
          label={item.module || 'general'}
          size="small"
          color={MODULE_COLORS[item.module] || 'default'}
          sx={{ height: 22 }}
        />
      ),
    },
    {
      field: 'message',
      headerName: 'Message',
      searchable: true,
      width: '45%',
    },
    {
      field: 'acknowledged',
      headerName: 'Status',
      searchable: false,
      width: '10%',
      render: (item) => (
        <Chip
          label={item.acknowledged ? 'Cleared' : 'Active'}
          size="small"
          color={item.acknowledged ? 'default' : 'error'}
          variant={item.acknowledged ? 'outlined' : 'filled'}
          sx={{ height: 22 }}
        />
      ),
    },
    {
      field: 'environment',
      headerName: 'Env',
      searchable: false,
      width: '10%',
      render: (item) => item.environment || '—',
    },
  ];

  const fetchErrors = useCallback(async () => {
    const data = await getAllSystemErrors(200);
    return data.errors || [];
  }, []);

  return (
    <ModernBaseList
      fetchItems={fetchErrors}
      onViewDetail={onViewDetail}
      onItemSelect={onItemSelect}
      selectedItem={selectedItem}
      onItemCountChange={onItemCountChange}
      searchTerm={searchTerm}
      columns={columns}
      emptyMessage="No system errors recorded"
      refreshTrigger={refreshTrigger}
      sortField="timestamp"
    />
  );
};

export default SystemErrorsList;
