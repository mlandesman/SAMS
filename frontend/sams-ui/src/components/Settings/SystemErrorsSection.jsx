/**
 * System Errors Section — SuperAdmin-only settings tab
 * Displays all system errors (acknowledged + unacknowledged) with detail view.
 * Uses getAllSystemErrors (?all=true) for full history.
 */
import React, { useState, useCallback } from 'react';
import SystemErrorsList from '../lists/SystemErrorsList';
import ItemDetailModal from '../modals/ItemDetailModal';
import { formatTimestampMexico } from '../../utils/timezone';

const SYSTEM_ERROR_DETAIL_FIELDS = [
  { key: 'id', label: 'ID' },
  {
    key: 'timestamp',
    label: 'Timestamp',
    render: (value, item) => formatTimestampMexico(item.timestamp),
  },
  { key: 'source', label: 'Source' },
  { key: 'module', label: 'Module' },
  { key: 'level', label: 'Level' },
  { key: 'message', label: 'Message' },
  {
    key: 'acknowledged',
    label: 'Status',
    render: (value) => (value ? 'Acknowledged' : 'Active'),
  },
  { key: 'environment', label: 'Environment' },
  { key: 'version', label: 'Version' },
  { key: 'url', label: 'URL' },
  { key: 'userAgent', label: 'User Agent' },
  {
    key: 'details',
    label: 'Details',
    render: (value) => value || 'No details',
  },
  { key: 'acknowledgedBy', label: 'Acknowledged By' },
  {
    key: 'acknowledgedAt',
    label: 'Acknowledged At',
    render: (value, item) => formatTimestampMexico(item.acknowledgedAt),
  },
];

function SystemErrorsSection() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailModal, setDetailModal] = useState({ isOpen: false, item: null });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleViewDetail = useCallback((item) => {
    setDetailModal({
      isOpen: true,
      item,
      title: 'System Error Details',
      fields: SYSTEM_ERROR_DETAIL_FIELDS,
    });
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ margin: 0, color: '#666' }}>
          System errors are read-only. Acknowledge/dismiss from the Dashboard card.
        </p>
        <button
          type="button"
          onClick={() => setRefreshTrigger((t) => t + 1)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
      <SystemErrorsList
        selectedItem={selectedItem}
        onItemSelect={setSelectedItem}
        onItemCountChange={() => {}}
        onViewDetail={handleViewDetail}
        searchTerm=""
        refreshTrigger={refreshTrigger}
      />
      <ItemDetailModal
        open={detailModal.isOpen}
        onClose={handleCloseDetail}
        item={detailModal.item}
        title="System Error Details"
        fields={SYSTEM_ERROR_DETAIL_FIELDS}
        editable={false}
      />
    </div>
  );
}

export default SystemErrorsSection;
