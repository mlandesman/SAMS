/**
 * Simple test version of UnifiedExpenseEntry
 */
import React from 'react';

const UnifiedExpenseEntry = ({ mode = 'modal', isOpen = true, onClose, onSubmit }) => {
  if (mode === 'modal' && !isOpen) {
    return null;
  }

  return (
    <div className={`unified-expense-entry ${mode}`}>
      <div className="expense-entry-container">
        <div className="expense-entry-header">
          <h2>Test Expense Entry</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <div className="expense-entry-content">
          <p>This is a test version of the unified expense entry component.</p>
          <button onClick={() => onSubmit?.({ test: true })}>Test Submit</button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedExpenseEntry;
