/**
 * Bridge Component for PWA to use UnifiedExpenseEntry
 * This allows the PWA to use the unified component in screen mode
 * while maintaining compatibility with the existing ExpenseEntryScreen
 */

import React from 'react';
import UnifiedExpenseEntry from '../../../sams-ui/src/components/UnifiedExpenseEntry';

const ExpenseFormUnified = ({ clientId, onSubmit, onCancel, samsUser }) => {
  return (
    <UnifiedExpenseEntry
      mode="screen"
      isOpen={true}
      onClose={onCancel}
      onSubmit={onSubmit}
      clientId={clientId}
      samsUser={samsUser}
    />
  );
};

export default ExpenseFormUnified;
