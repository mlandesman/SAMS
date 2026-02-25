// src/components/common/ActivityActionBar.jsx
import React from 'react';
import '../../layout/ActionBar.css';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';

function ActivityActionBar({ children }) {
  const { samsUser } = useAuth();
  const { selectedClient, selectedUnitId, unitOwnerNames } = useClient();
  const clientName = selectedClient ? (selectedClient.basicInfo?.fullName || selectedClient.name || selectedClient.id) : "Client Name";
  const propertyAccess = selectedClient?.id
    ? (samsUser?.samsProfile?.propertyAccess?.[selectedClient.id] ?? samsUser?.propertyAccess?.[selectedClient.id])
    : null;
  const isUnitOwnerOrManager = propertyAccess && (propertyAccess.role === 'unitOwner' || propertyAccess.role === 'unitManager');
  const baseTitle = isUnitOwnerOrManager && selectedUnitId
    ? `${clientName} • Unit ${selectedUnitId}`
    : clientName;
  const title = isUnitOwnerOrManager && selectedUnitId && unitOwnerNames
    ? `${baseTitle} — ${unitOwnerNames}`
    : baseTitle;

  return (
    <div className="action-bar">
      <h2 className="action-bar-title">
        {title}
      </h2>
      <div className="action-items">
        {children}
      </div>
    </div>
  );
}

export default ActivityActionBar;