// src/components/common/ActivityActionBar.jsx
import React from 'react';
import '../../layout/ActionBar.css';
import { useClient } from '../../context/ClientContext';

function ActivityActionBar({ children }) {
  const { selectedClient } = useClient();
  const clientName = selectedClient ? (selectedClient.basicInfo?.fullName || selectedClient.name || selectedClient.id) : "Client Name";
  
  return (
    <div className="action-bar">
      <h2 className="action-bar-title">
        {clientName}
      </h2>
      <div className="action-items">
        {children}
      </div>
    </div>
  );
}

export default ActivityActionBar;