import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTimes } from '@fortawesome/free-solid-svg-icons';
import '../../styles/SandylandModalTheme.css';

/**
 * ItemDetailModal - A reusable modal for displaying detailed item information
 * Supports various field types and custom rendering
 */
const ItemDetailModal = ({
  open,
  onClose,
  onEdit,
  item,
  title,
  fields = [],
  editable = true
}) => {
  if (!item || !open) return null;

  // Helper function to access nested properties using dot notation
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const renderFieldValue = (field, value) => {
    // Handle empty/null values
    if (value === null || value === undefined || value === '') {
      return <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Not specified</span>;
    }

    // Custom render function
    if (field.render) {
      return field.render(value, item);
    }

    // Built-in field types
    switch (field.type) {
      case 'status':
        return (
          <span 
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: value === 'inactive' ? '#fed7d7' : '#c6f6d5',
              color: value === 'inactive' ? '#c53030' : '#276749',
              border: `1px solid ${value === 'inactive' ? '#feb2b2' : '#9ae6b4'}`
            }}
          >
            {value === 'inactive' ? 'Inactive' : 'Active'}
          </span>
        );
      
      case 'currency':
        return <span style={{ color: '#2d3748', fontWeight: '600' }}>{value.toUpperCase()}</span>;
      
      case 'money':
        return (
          <span style={{ color: '#2d3748', fontWeight: '600' }}>
            MX${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      
      case 'number':
        return (
          <span style={{ color: '#2d3748', fontWeight: '600' }}>
            {Number(value).toLocaleString()}
          </span>
        );
      
      case 'percentage':
        return (
          <span style={{ color: '#2d3748', fontWeight: '600' }}>
            {Number(value).toFixed(2)}%
          </span>
        );
      
      case 'squareFeet':
        return (
          <span style={{ color: '#2d3748', fontWeight: '600' }}>
            {Number(value).toLocaleString()} sq ft
          </span>
        );
      
      case 'email':
        return (
          <a 
            href={`mailto:${value}`}
            style={{ 
              color: '#0863bf', 
              textDecoration: 'none',
              borderBottom: '1px solid transparent'
            }}
            onMouseOver={(e) => e.target.style.borderBottomColor = '#0863bf'}
            onMouseOut={(e) => e.target.style.borderBottomColor = 'transparent'}
          >
            {value}
          </a>
        );
      
      case 'phone':
        return (
          <a 
            href={`tel:${value}`}
            style={{ 
              color: '#0863bf', 
              textDecoration: 'none',
              borderBottom: '1px solid transparent'
            }}
            onMouseOver={(e) => e.target.style.borderBottomColor = '#0863bf'}
            onMouseOut={(e) => e.target.style.borderBottomColor = 'transparent'}
          >
            {value}
          </a>
        );
      
      case 'url':
        return (
          <a 
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#0863bf', 
              textDecoration: 'none',
              borderBottom: '1px solid transparent'
            }}
            onMouseOver={(e) => e.target.style.borderBottomColor = '#0863bf'}
            onMouseOut={(e) => e.target.style.borderBottomColor = 'transparent'}
          >
            {value}
          </a>
        );
      
      case 'multiline':
        return (
          <div style={{ 
            whiteSpace: 'pre-wrap',
            color: '#2d3748',
            lineHeight: '1.5'
          }}>
            {value}
          </div>
        );
      
      case 'date':
        return (
          <span style={{ color: '#2d3748' }}>
            {new Date(value).toLocaleDateString()}
          </span>
        );
      
      case 'datetime':
        return (
          <span style={{ color: '#2d3748' }}>
            {new Date(value).toLocaleString()}
          </span>
        );
      
      case 'boolean':
        return (
          <span 
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: value ? '#c6f6d5' : '#e2e8f0',
              color: value ? '#276749' : '#4a5568',
              border: `1px solid ${value ? '#9ae6b4' : '#cbd5e0'}`
            }}
          >
            {value ? 'Yes' : 'No'}
          </span>
        );
      
      default:
        return <span style={{ color: '#2d3748' }}>{String(value)}</span>;
    }
  };

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '900px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sandyland-modal-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 className="sandyland-modal-title" style={{ margin: 0 }}>{title}</h2>
              {item.name && (
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: '#000000',
                  letterSpacing: '0.01em',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px'
                }}>
                  {item.name}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="sandyland-modal-content">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '1.5rem 2rem',
            padding: '1.5rem 0'
          }}>
            {fields.map((field, index) => {
              const isEmail = field.key === 'email';
              return (
                <div key={field.key || field.label || index} style={{
                  gridColumn: field.fullWidth ? '1 / -1' : 'auto'
                }}>
                  <div 
                    style={{ 
                      fontSize: isEmail ? '0.875rem' : '0.75rem',
                      fontWeight: '600',
                      marginBottom: isEmail ? '0.75rem' : '0.5rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: '#6b7280'
                    }}
                  >
                    {field.label}
                  </div>
                  <div style={{ 
                    fontSize: isEmail ? '1.125rem' : '0.9375rem',
                    color: '#1f2937',
                    fontWeight: isEmail ? '600' : '500',
                    minHeight: '1.5rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {renderFieldValue(field, getNestedValue(item, field.key))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="sandyland-modal-buttons" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
          {item.id && (
            <div style={{
              fontSize: '1rem',
              fontWeight: '700',
              color: '#000000',
              fontFamily: 'monospace',
              letterSpacing: '0.05em'
            }}>
              ID: {item.id}
            </div>
          )}
          <button 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
            style={{ marginLeft: item.id ? 'auto' : '0' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
