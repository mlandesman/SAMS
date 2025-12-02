import React, { useState } from 'react';
import { useClient } from '../context/ClientContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFileInvoice,
  faChartLine,
  faHistory
} from '@fortawesome/free-solid-svg-icons';
import StatementOfAccountTab from '../components/reports/StatementOfAccountTab';
import './ReportsView.css';

function ActivityTab() {
  return (
    <div className="reports-tab-content">
      <div className="reports-placeholder">
        <FontAwesomeIcon icon={faChartLine} size="3x" className="placeholder-icon" />
        <h2>Activity Reports</h2>
        <p>View activity and transaction history reports.</p>
        <p className="coming-soon">Coming soon</p>
      </div>
    </div>
  );
}

function ReportsView() {
  const { selectedClient } = useClient();
  const [activeTab, setActiveTab] = useState('statement');

  if (!selectedClient) {
    return (
      <div className="reports-view">
        <div className="reports-placeholder">
          <p>Please select a client to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-view">
      <div className="reports-header">
        <h1>Reports</h1>
        <p className="reports-subtitle">Generate and manage financial reports</p>
      </div>

      <div className="reports-tabs">
        <button
          className={`reports-tab ${activeTab === 'statement' ? 'active' : ''}`}
          onClick={() => setActiveTab('statement')}
        >
          <FontAwesomeIcon icon={faFileInvoice} />
          <span>Statement of Account</span>
        </button>
        <button
          className={`reports-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <FontAwesomeIcon icon={faChartLine} />
          <span>Activity</span>
        </button>
        <button
          className={`reports-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          disabled
        >
          <FontAwesomeIcon icon={faHistory} />
          <span>History</span>
          <span className="tab-badge">Soon</span>
        </button>
      </div>

      <div className="reports-content">
        {activeTab === 'statement' && <StatementOfAccountTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'history' && (
          <div className="reports-tab-content">
            <div className="reports-placeholder">
              <FontAwesomeIcon icon={faHistory} size="3x" className="placeholder-icon" />
              <h2>Report History</h2>
              <p>View previously generated reports.</p>
              <p className="coming-soon">Coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsView;

