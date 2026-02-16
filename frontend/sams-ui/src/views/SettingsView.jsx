import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faChartLine, faDatabase, faCalendarAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { triggerManualExchangeRatesUpdate, checkTodaysExchangeRates } from '../api/exchangeRates';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { SuperAdminGuard } from '../components/security/PermissionGuard';
import ActivityActionBar from '../components/common/ActivityActionBar';
import ImportManagement from '../components/Settings/ImportManagement';
import YearEndProcessing from './settings/YearEndProcessing';
import BackupSettings from './settings/BackupSettings';
import SystemErrorsSection from '../components/Settings/SystemErrorsSection';
import '../layout/ActionBar.css';

function SettingsView() {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  const [updateStatus, setUpdateStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [exchangeRateInfo, setExchangeRateInfo] = useState(null);
  const [checkingRates, setCheckingRates] = useState(false);
  const [activeSection, setActiveSection] = useState('exchange-rates');

  // Check for onboarding mode and switch to data-management section
  useEffect(() => {
    const onboardingData = localStorage.getItem('onboardingClient');
    if (onboardingData) {
      console.log('📋 Onboarding mode detected, switching to Data Management section');
      setActiveSection('data-management');
    }
  }, []);

  // Check today's exchange rates
  const handleCheckRates = async () => {
    setCheckingRates(true);
    try {
      const result = await checkTodaysExchangeRates();
      setExchangeRateInfo(result);
      setUpdateStatus(`✅ Exchange rates check completed. Rates exist: ${result.exists}`);
    } catch (error) {
      setUpdateStatus(`❌ Failed to check exchange rates: ${error.message}`);
    } finally {
      setCheckingRates(false);
    }
  };

  // Manual exchange rate update handlers
  const handleQuickUpdate = async () => {
    setIsUpdating(true);
    setUpdateStatus('🔄 Running quick update (fill gaps only)...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'quick' 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Quick update completed successfully!');
      } else {
        setUpdateStatus(`⚠️ Quick update completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Quick update failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFillGaps = async () => {
    setIsUpdating(true);
    setUpdateStatus('🔄 Running gap filling for recent dates...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'fill-gaps',
        startDate: '2025-05-01', // Last month
        endDate: new Date().toISOString().split('T')[0] // Today
      });
      
      if (result.success) {
        setUpdateStatus('✅ Gap filling completed successfully!');
      } else {
        setUpdateStatus(`⚠️ Gap filling completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Gap filling failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkReplace = async () => {
    if (!window.confirm('⚠️ This will delete ALL existing exchange rates and rebuild from 2020+. This may take several minutes. Continue?')) {
      return;
    }
    
    setIsUpdating(true);
    setUpdateStatus('🔄 Running full bulk replacement (this may take several minutes)...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'bulk' 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Bulk replacement completed successfully!');
      } else {
        setUpdateStatus(`⚠️ Bulk replacement completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Bulk replacement failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDryRun = async () => {
    setIsUpdating(true);
    setUpdateStatus('🧪 Running dry-run test...');
    
    try {
      const result = await triggerManualExchangeRatesUpdate({ 
        mode: 'fill-gaps',
        dryRun: true 
      });
      
      if (result.success) {
        setUpdateStatus('✅ Dry-run completed - no changes made');
      } else {
        setUpdateStatus(`⚠️ Dry-run completed with issues: ${result.error}`);
      }
    } catch (error) {
      setUpdateStatus(`❌ Dry-run failed: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if user is SuperAdmin
  const isSuperAdmin = samsUser?.email === 'michael@landesman.com' || samsUser?.globalRole === 'superAdmin';

  // Map activeSection to tab index
  const sectionToIndex = {
    'exchange-rates': 0,
    'data-management': 1,
    'year-end': 2,
    'system': 3,
    'system-errors': 4,
    'backup': 5
  };

  const indexToSection = ['exchange-rates', 'data-management', 'year-end', 'system', 'system-errors', 'backup'];
  
  const handleTabChange = (event, newValue) => {
    setActiveSection(indexToSection[newValue]);
  };

  return (
    <div className="view-container">
      {/* ACTION BAR */}
      <ActivityActionBar>
        {/* No actions needed for Settings view - client name is sufficient */}
      </ActivityActionBar>
      
      {/* Navigation Tabs - using Material-UI Tabs for consistency */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, mb: 3 }}>
        <Tabs
          value={sectionToIndex[activeSection]}
          onChange={handleTabChange}
          aria-label="settings tabs"
        >
          <Tab
            label="Exchange Rates"
            icon={<FontAwesomeIcon icon={faChartLine} />}
            iconPosition="start"
          />
          <Tab
            label="Data Management"
            icon={<FontAwesomeIcon icon={faDatabase} />}
            iconPosition="start"
          />
          <Tab
            label="Year-End Processing"
            icon={<FontAwesomeIcon icon={faCalendarAlt} />}
            iconPosition="start"
          />
          <Tab
            label="System Settings"
            icon={<FontAwesomeIcon icon={faCog} />}
            iconPosition="start"
          />
          {isSuperAdmin && (
            <Tab
              label="System Errors"
              icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
              iconPosition="start"
            />
          )}
          {isSuperAdmin && (
            <Tab
              label="Backup & Recovery"
              icon={<FontAwesomeIcon icon={faDatabase} />}
              iconPosition="start"
            />
          )}
        </Tabs>
      </Box>

      {/* Scrollable content area for settings sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Exchange Rates Management Section */}
        {activeSection === 'exchange-rates' && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          marginBottom: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>📈 Exchange Rates Management</h2>
        <p>
          Exchange rates are automatically updated daily when users log in. 
          Use the tools below for manual management or testing.
        </p>
        
        {/* Status Display */}
        {updateStatus && (
          <div style={{ 
            padding: '10px', 
            margin: '10px 0', 
            backgroundColor: updateStatus.startsWith('✅') ? '#d4edda' : 
                           updateStatus.startsWith('⚠️') ? '#fff3cd' : 
                           updateStatus.startsWith('❌') ? '#f8d7da' : '#cce7ff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            {updateStatus}
          </div>
        )}
        
        {/* Exchange Rate Info */}
        {exchangeRateInfo && (
          <div style={{ 
            padding: '10px', 
            margin: '10px 0', 
            backgroundColor: '#e9ecef',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}>
            <h4>Today's Exchange Rates ({exchangeRateInfo.date})</h4>
            <p><strong>Status:</strong> {exchangeRateInfo.exists ? '✅ Available' : '❌ Missing'}</p>
            {exchangeRateInfo.data && (
              <div>
                <p><strong>Currencies Available:</strong></p>
                <ul>
                  {Object.keys(exchangeRateInfo.data.rates || {}).map(currency => (
                    <li key={currency}>
                      {currency}: {exchangeRateInfo.data.rates[currency].rate?.toFixed(6) || 'N/A'}
                      {exchangeRateInfo.data.rates[currency].source && ` (${exchangeRateInfo.data.rates[currency].source})`}
                    </li>
                  ))}
                </ul>
                <p><strong>Last Updated:</strong> {new Date(exchangeRateInfo.data.lastUpdated).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
          <button 
            onClick={handleCheckRates}
            disabled={checkingRates}
            style={{
              padding: '10px 15px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: checkingRates ? 'not-allowed' : 'pointer',
              opacity: checkingRates ? 0.6 : 1
            }}
          >
            {checkingRates ? '🔄 Checking...' : '🔍 Check Today\'s Rates'}
          </button>
          
          <button 
            onClick={handleQuickUpdate}
            disabled={isUpdating}
            style={{
              padding: '10px 15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isUpdating ? '🔄 Updating...' : '⚡ Quick Update'}
          </button>
          
          <button 
            onClick={handleFillGaps}
            disabled={isUpdating}
            style={{
              padding: '10px 15px',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isUpdating ? '🔄 Filling...' : '📊 Fill Recent Gaps'}
          </button>
          
          <button 
            onClick={handleDryRun}
            disabled={isUpdating}
            style={{
              padding: '10px 15px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isUpdating ? '🔄 Testing...' : '🧪 Dry Run Test'}
          </button>
          
          <button 
            onClick={handleBulkReplace}
            disabled={isUpdating}
            style={{
              padding: '10px 15px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.6 : 1
            }}
          >
            {isUpdating ? '🔄 Replacing...' : '🔥 Full Bulk Replace'}
          </button>
        </div>
        
        {/* Help Text */}
        <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
          <h4>Tool Descriptions:</h4>
          <ul>
            <li><strong>Check Today's Rates:</strong> View current exchange rate status</li>
            <li><strong>Quick Update:</strong> Fill gaps from last known date to today</li>
            <li><strong>Fill Recent Gaps:</strong> Fill any missing dates in the last month</li>
            <li><strong>Dry Run Test:</strong> Test what would be updated without making changes</li>
            <li><strong>Full Bulk Replace:</strong> ⚠️ Delete all data and rebuild from 2020+ (slow)</li>
          </ul>
        </div>
      </div>
      )}

      {/* Data Management Section */}
      {activeSection === 'data-management' && (
        <SuperAdminGuard>
          {selectedClient ? (
            <ImportManagement clientId={selectedClient.id} />
          ) : (
            // Check if we're in onboarding mode (data stored in localStorage)
            localStorage.getItem('onboardingClient') ? (
              <ImportManagement clientId={null} />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Please select a client to access Data Management features.</p>
                <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                  Or use the "🆕 - New Client -" option in the client switcher to onboard a new client.
                </p>
              </div>
            )
          )}
        </SuperAdminGuard>
      )}

      {/* Year-End Processing Section */}
      {activeSection === 'year-end' && (
        <SuperAdminGuard>
          {selectedClient ? (
            <YearEndProcessing />
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>Please select a client to access Year-End Processing.</p>
            </div>
          )}
        </SuperAdminGuard>
      )}
      
      {/* System Settings Section */}
      {activeSection === 'system' && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          backgroundColor: '#f9f9f9'
        }}>
          <h2>🔧 System Settings</h2>
          <p>Additional system settings and administration tools will be added here.</p>
          
          {/* User Management Notice */}
          {isSuperAdmin && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '4px', border: '1px solid #bee5eb' }}>
              <h4>👥 User Management</h4>
              <p>User Management has been moved to <strong>List Management</strong> for better organization.</p>
              <p>You can find the Users tab in List Management where you can create, edit, and manage user accounts and permissions.</p>
            </div>
          )}
          
          {/* User Information */}
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
            <h4>Current User Information</h4>
            <p><strong>Email:</strong> {samsUser?.email}</p>
            <p><strong>Role:</strong> {isSuperAdmin ? 'SuperAdmin' : 'User'}</p>
            <p><strong>Client Access:</strong> {samsUser?.propertyAccess && Array.isArray(samsUser.propertyAccess) ? samsUser.propertyAccess.join(', ') : 'None'}</p>
          </div>
        </div>
      )}

      {/* System Errors Section — SuperAdmin only */}
      {activeSection === 'system-errors' && isSuperAdmin && (
        <SuperAdminGuard>
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f9f9f9'
          }}>
            <h2>⚠️ System Errors</h2>
            <SystemErrorsSection />
          </div>
        </SuperAdminGuard>
      )}

      {/* Backup & Recovery Section */}
      {activeSection === 'backup' && isSuperAdmin && (
        <SuperAdminGuard>
          <BackupSettings />
        </SuperAdminGuard>
      )}
      </div>
    </div>
  );
}

export default SettingsView;
