import React, { useState, useMemo } from 'react';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { formatAsMXN } from '../utils/hoaDuesUtils';
import { isSuperAdmin, isAdmin } from '../utils/userRoles';
import { deleteCreditHistoryEntry } from '../api/hoaDuesService';
import CreditBalanceEditModal from './CreditBalanceEditModal';
import CreditBalanceEditEntryModal from './CreditBalanceEditEntryModal';
import CreditBalanceConfirmModal from './CreditBalanceConfirmModal';
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import '../styles/SandylandModalTheme.css';
import '../styles/CreditBalanceModals.css';

function CreditBalanceHistoryModal({ isOpen, onClose, unitId, creditBalanceHistory, currentBalance, year, onUpdate }) {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  const { t } = useDesktopStrings();
  
  const [contextMenu, setContextMenu] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addRemoveMode, setAddRemoveMode] = useState(null); // 'add' or 'remove'
  const [confirmModal, setConfirmModal] = useState(null);
  
  const canEdit = isSuperAdmin(samsUser) || isAdmin(samsUser, selectedClient?.id);


  // Format date from timestamp - use timestamp.display.display for display
  const formatDate = (entry) => {
    // Use display.display if available (user requirement)
    if (entry.timestamp && 
        typeof entry.timestamp === 'object' && 
        entry.timestamp.display && 
        typeof entry.timestamp.display === 'object' &&
        entry.timestamp.display.display) {
      return entry.timestamp.display.display;
    }
    
    // Fallback: try to parse and format
    let date = null;
    
    if (entry.timestamp !== undefined && entry.timestamp !== null) {
      if (typeof entry.timestamp === 'object') {
        // Check for raw ISO string (for sorting/parsing)
        if (entry.timestamp.raw && typeof entry.timestamp.raw === 'string') {
          date = new Date(entry.timestamp.raw);
        } else if (entry.timestamp.toDate && typeof entry.timestamp.toDate === 'function') {
          date = entry.timestamp.toDate();
        } else if (entry.timestamp._seconds !== undefined) {
          date = new Date(entry.timestamp._seconds * 1000);
        } else if (entry.timestamp.seconds !== undefined) {
          date = new Date(entry.timestamp.seconds * 1000);
        }
      } else if (typeof entry.timestamp === 'string') {
        date = new Date(entry.timestamp);
      }
    }
    
    if ((!date || isNaN(date.getTime())) && entry.date) {
      if (typeof entry.date === 'string') {
        date = new Date(entry.date);
      } else if (typeof entry.date === 'object' && entry.date.toDate) {
        date = entry.date.toDate();
      }
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'Unknown Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format entry type
  const formatType = (type) => {
    if (!type) return 'Unknown';
    return String(type)
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Format amount - amounts from getAllDuesDataForYear are already in pesos
  // No conversion needed, just format for display
  const formatAmount = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return formatAsMXN(0);
    }
    
    // Amounts are already in pesos from getAllDuesDataForYear
    return formatAsMXN(amount);
  };

  // Get date from entry for sorting - use timestamp.raw for sorting (user requirement)
  const getDateFromEntry = (entry) => {
    let date = null;
    
    if (entry.timestamp) {
      if (typeof entry.timestamp === 'object') {
        // Use raw ISO string for sorting (user requirement)
        if (entry.timestamp.raw && typeof entry.timestamp.raw === 'string') {
          date = new Date(entry.timestamp.raw);
        } else if (entry.timestamp.toDate && typeof entry.timestamp.toDate === 'function') {
          date = entry.timestamp.toDate();
        } else if (entry.timestamp._seconds !== undefined) {
          date = new Date(entry.timestamp._seconds * 1000);
        } else if (entry.timestamp.seconds !== undefined) {
          date = new Date(entry.timestamp.seconds * 1000);
        }
      } else if (typeof entry.timestamp === 'string') {
        // Direct ISO string
        date = new Date(entry.timestamp);
      }
    }
    
    if ((!date || isNaN(date.getTime())) && entry.date) {
      if (typeof entry.date === 'string') {
        date = new Date(entry.date);
      } else if (typeof entry.date === 'object' && entry.date.toDate) {
        date = entry.date.toDate();
      }
    }
    
    return date ? date.getTime() : 0;
  };

  // Calculate running balance
  // Amounts from getAllDuesDataForYear are already in pesos, so sum directly
  const calculateRunningBalance = (entries, index) => {
    let balancePesos = 0;
    for (let i = 0; i <= index; i++) {
      // Amounts are already in pesos, no conversion needed
      balancePesos += entries[i].amount || 0;
    }
    return balancePesos;
  };

  // Sort history entries chronologically (oldest first for running balance calculation)
  const sortedHistory = useMemo(() => {
    const history = [...(creditBalanceHistory || [])];
    return history.sort((a, b) => {
      const dateA = getDateFromEntry(a);
      const dateB = getDateFromEntry(b);
      return dateA - dateB; // Oldest first
    });
  }, [creditBalanceHistory]);

  // Handle right-click on table row
  const handleRowRightClick = (e, entry, index) => {
    e.preventDefault();
    if (!canEdit) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
      index
    });
  };


  // Handle delete entry confirmation
  const handleDeleteConfirm = () => {
    if (!contextMenu) return;
    
    setConfirmModal({
      type: 'delete',
      entry: contextMenu.entry,
      index: contextMenu.index
    });
    setContextMenu(null);
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!confirmModal || !confirmModal.entry) return;

    try {
      await deleteCreditHistoryEntry(
        selectedClient.id,
        unitId,
        confirmModal.entry.id
      );
      
      setConfirmModal(null);
      
      // Refresh data (await to ensure refresh completes)
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Error deleting credit history entry:', error);
      alert(`Failed to delete entry: ${error.message}`);
      setConfirmModal(null);
    }
  };

  // Handle edit entry confirmation
  const handleEditConfirm = () => {
    if (!contextMenu) return;
    
    setEditModal({
      entry: contextMenu.entry,
      index: contextMenu.index
    });
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="sandyland-modal-overlay" onClick={onClose}>
        <div className="sandyland-modal credit-balance-modal credit-balance-modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="sandyland-modal-header credit-balance-modal-header">
            <h2 className="sandyland-modal-title credit-balance-modal-title">{t('creditHistory.title', { unitId })}</h2>
            <button type="button" className="credit-modal-close" onClick={onClose} aria-label={t('creditHistory.close')}>×</button>
          </div>
          
          <div className="sandyland-modal-content credit-balance-modal-content">
            <div className="credit-balance-history-balance">
              <span className="label">{t('creditHistory.currentBalance')}</span>
              <span className="amount">{formatAsMXN(currentBalance || 0)}</span>
            </div>

            {canEdit && (
              <>
                <div className="credit-balance-action-buttons">
                  <button 
                    type="button"
                    className="sandyland-btn sandyland-btn-success"
                    onClick={() => {
                      setAddRemoveMode('add');
                      setShowAddModal(true);
                    }}
                  >
                    ➕ {t('creditHistory.addCredit')}
                  </button>
                  <button
                    type="button"
                    className="sandyland-btn sandyland-btn-danger"
                    onClick={() => {
                      setAddRemoveMode('remove');
                      setShowAddModal(true);
                    }}
                  >
                    ➖ {t('creditHistory.removeCredit')}
                  </button>
                </div>
                <div className="credit-balance-action-hint">
                  {t('creditHistory.contextHint')}
                </div>
              </>
            )}

            {sortedHistory.length === 0 ? (
              <div className="credit-balance-no-history">
                <p>{t('creditHistory.noHistory')}</p>
              </div>
            ) : (
              <div className="credit-balance-table-wrap">
                <table className="credit-balance-history-table">
                  <thead>
                    <tr>
                      <th>{t('creditHistory.date')}</th>
                      <th>{t('creditHistory.type')}</th>
                      <th>{t('creditHistory.amount')}</th>
                      <th>{t('creditHistory.runningBalance')}</th>
                      <th>{t('creditHistory.notes')}</th>
                      <th>{t('creditHistory.source')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((entry, index) => {
                      const amount = entry.amount || 0;
                      const runningBalance = calculateRunningBalance(sortedHistory, index);
                      const isPositive = amount >= 0;
                      
                      return (
                        <tr 
                          key={entry.id || index}
                          onContextMenu={(e) => canEdit && handleRowRightClick(e, entry, index)}
                          className={canEdit ? 'editable-row' : ''}
                        >
                          <td>{formatDate(entry)}</td>
                          <td>
                            <span className={`credit-balance-type-badge type-${entry.type || 'unknown'}`}>
                              {formatType(entry.type)}
                            </span>
                          </td>
                          <td className={isPositive ? 'credit-balance-amount-positive' : 'credit-balance-amount-negative'}>
                            {isPositive ? '+' : ''}{formatAmount(amount)}
                          </td>
                          <td className="credit-balance-running-balance">
                            {formatAsMXN(runningBalance)}
                          </td>
                          <td className="credit-balance-notes-cell">{entry.notes || ''}</td>
                          <td className="credit-balance-source-cell">{entry.source || t('creditHistory.na')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="sandyland-modal-buttons">
            <button type="button" className="sandyland-btn sandyland-btn-secondary" onClick={onClose}>
              {t('creditHistory.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="credit-balance-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <div
            className="credit-balance-context-menu-item"
            onClick={handleEditConfirm}
            role="menuitem"
          >
            {t('creditHistory.editEntry')}
          </div>
          <div
            className="credit-balance-context-menu-item credit-balance-context-menu-item--danger"
            onClick={handleDeleteConfirm}
            role="menuitem"
          >
            {t('creditHistory.deleteEntry')}
          </div>
        </div>
      )}

      {/* Add/Remove Credit Modal (reuse Edit modal with mode prop) */}
      {showAddModal && (
        <CreditBalanceEditModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setAddRemoveMode(null);
          }}
          unitId={unitId}
          currentBalance={currentBalance}
          year={year}
          mode={addRemoveMode} // 'add' or 'remove' for amount-based, undefined for balance-based
          onUpdate={async () => {
            setShowAddModal(false);
            setAddRemoveMode(null);
            if (onUpdate) {
              await onUpdate();
            }
          }}
        />
      )}

      {/* Edit Entry Modal */}
      {editModal && (
        <CreditBalanceEditEntryModal
          isOpen={!!editModal}
          onClose={() => setEditModal(null)}
          unitId={unitId}
          entry={editModal.entry}
          onUpdate={async () => {
            setEditModal(null);
            if (onUpdate) {
              await onUpdate();
            }
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <CreditBalanceConfirmModal
          isOpen={!!confirmModal}
          onClose={() => setConfirmModal(null)}
          onConfirm={executeDelete}
          title={t('creditHistory.deleteTitle')}
          message={t('creditHistory.deleteMessage')}
          confirmLabel={t('creditHistory.delete')}
          cancelLabel={t('creditHistory.cancel')}
          type="danger"
        />
      )}
    </>
  );
}

export default CreditBalanceHistoryModal;
