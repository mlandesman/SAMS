import React, { useState } from 'react';
import './InfoTooltip.css';

export function InfoTooltip({ content, title }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="info-tooltip-container">
      <button 
        className="info-icon"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        type="button"
      >
        ℹ️
      </button>
      {isOpen && (
        <div className="info-tooltip-popup">
          {title && <div className="info-tooltip-title">{title}</div>}
          <div className="info-tooltip-content">{content}</div>
        </div>
      )}
    </div>
  );
}

