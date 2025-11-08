import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

/**
 * Reusable Context Menu Component
 * 
 * Usage:
 * <ContextMenu
 *   isOpen={showMenu}
 *   position={{ x: 100, y: 200 }}
 *   onClose={() => setShowMenu(false)}
 *   options={[
 *     { label: 'Edit', icon: '✏️', onClick: handleEdit },
 *     { label: 'Delete', icon: '🗑️', onClick: handleDelete, danger: true },
 *     { type: 'divider' },
 *     { label: 'Details', icon: 'ℹ️', onClick: handleDetails }
 *   ]}
 * />
 */
function ContextMenu({ isOpen, position, onClose, options }) {
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Adjust position to keep menu on screen
  const adjustPosition = () => {
    if (!menuRef.current) return position;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Adjust horizontal position if menu would go off screen
    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 10;
    }

    // Adjust vertical position if menu would go off screen
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 10;
    }

    return { x, y };
  };

  const finalPosition = adjustPosition();

  const handleOptionClick = (option) => {
    if (option.onClick) {
      option.onClick();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: `${finalPosition.x}px`,
        top: `${finalPosition.y}px`,
        zIndex: 10000
      }}
    >
      {options.map((option, index) => {
        if (option.type === 'divider') {
          return <div key={`divider-${index}`} className="context-menu-divider" />;
        }

        return (
          <div
            key={index}
            className={`context-menu-item ${option.danger ? 'danger' : ''} ${option.disabled ? 'disabled' : ''}`}
            onClick={() => !option.disabled && handleOptionClick(option)}
          >
            {option.icon && <span className="context-menu-icon">{option.icon}</span>}
            <span className="context-menu-label">{option.label}</span>
            {option.shortcut && (
              <span className="context-menu-shortcut">{option.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ContextMenu;

