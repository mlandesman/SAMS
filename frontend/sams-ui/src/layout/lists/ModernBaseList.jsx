import React, { useState, useEffect, useCallback } from 'react';
import './ModernBaseList.css';
import ActivityActionBar from '../common/ActivityActionBar';
import { LoadingSpinner } from '../common';
import '../../layout/ActionBar.css';

/**
 * ModernBaseList - A modern ActionBar-based list component that follows the TransactionsView pattern
 * Features:
 * - ActionBar with FontAwesome icons for Add/Edit/Delete actions
 * - Double-click row to open detail view
 * - No row-level action buttons
 * - Search functionality
 * - Consistent styling with TransactionsView
 * - Automatic alphabetical sorting by specified field (defaults to 'name')
 */
const ModernBaseList = ({ 
  fetchItems,
  onViewDetail,
  columns = [],
  emptyMessage = 'No items found',
  selectedItem,
  onItemSelect,
  onItemCountChange,
  searchTerm = '',
  sortField = 'name' // New prop for specifying which field to sort by
}) => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sort items alphabetically by the specified field
  const sortItems = useCallback((itemsToSort) => {
    return [...itemsToSort].sort((a, b) => {
      const aValue = a[sortField]?.toString().toLowerCase() ?? '';
      const bValue = b[sortField]?.toString().toLowerCase() ?? '';
      return aValue.localeCompare(bValue);
    });
  }, [sortField]);

  // Fetch items on component mount
  useEffect(() => {
    const loadItems = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchItems();
        const sortedData = sortItems(data);
        setItems(sortedData);
        setFilteredItems(sortedData);
      } catch (err) {
        console.error('Error fetching items:', err);
        setError(err.message || 'Failed to load items');
      } finally {
        setLoading(false);
      }
    };
    
    loadItems();
  }, [fetchItems, sortItems]);

  // Filter items based on search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredItems(items);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = items.filter(item => {
        // Search across all searchable columns
        return columns.some(column => {
          if (column.searchable === false) return false;
          
          const value = item[column.field];
          if (value == null) return false;
          
          return String(value).toLowerCase().includes(searchLower);
        });
      });
      setFilteredItems(filtered);
    }
  }, [items, searchTerm, columns]);

  // Notify parent when filtered item count changes
  useEffect(() => {
    if (onItemCountChange) {
      onItemCountChange(filteredItems.length);
    }
  }, [filteredItems.length, onItemCountChange]);

  // Handle row click for selection
  const handleRowClick = useCallback((item, event) => {
    // Prevent double-click from triggering row selection
    if (event.detail === 1) {
      setTimeout(() => {
        if (event.detail === 1) {
          onItemSelect?.(item);
        }
      }, 200);
    }
  }, [onItemSelect]);

  // Handle row double-click for detail view
  const handleRowDoubleClick = useCallback((item) => {
    onViewDetail?.(item);
  }, [onViewDetail]);

  // Format cell data based on column definition
  const formatCellData = (item, column) => {
    if (column.render) {
      return column.render(item);
    }
    
    return item[column.field];
  };

  // Refresh function to be called from parent
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchItems();
      const sortedData = sortItems(data);
      setItems(sortedData);
      setFilteredItems(sortedData);
    } catch (err) {
      console.error('Error refreshing items:', err);
      setError(err.message || 'Failed to refresh items');
    } finally {
      setLoading(false);
    }
  }, [fetchItems, sortItems]);

  // Expose refresh function to parent via ref or callback
  React.useImperativeHandle(React.useRef(), () => ({
    refresh
  }));

  return (
    <div className="modern-list-container">
      {/* List Content */}
      <div className="modern-list-content">
        {loading ? (
          <LoadingSpinner variant="logo" message="Loading..." size="medium" />
        ) : error ? (
          <div className="modern-list-error">
            <p style={{ color: '#dc2626', textAlign: 'center', padding: '2rem' }}>{error}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="modern-list-empty">
            <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>{emptyMessage}</p>
          </div>
        ) : (
          <div className="modern-list-table-container">
            <table className="modern-list-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th 
                      key={column.field} 
                      style={column.width ? { width: column.width } : {}}
                    >
                      {column.headerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  // Use a more robust ID system - prefer item.id, fall back to index
                  const itemId = item.id || item.docId || item._id || item.name || index;
                  const selectedId = selectedItem?.id || selectedItem?.docId || selectedItem?._id || selectedItem?.name;
                  const isSelected = selectedId !== undefined && selectedId === itemId;
                  
                  return (
                  <tr 
                    key={itemId}
                    className={isSelected ? 'selected' : ''}
                    onClick={(e) => handleRowClick(item, e)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                  >
                    {columns.map((column) => (
                      <td key={`${itemId}-${column.field}`}>
                        {formatCellData(item, column)}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernBaseList;
