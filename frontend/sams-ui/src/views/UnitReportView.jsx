/**
 * Unit Report View for Desktop UI
 * Auto-detects user's unit and displays their financial report
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import UnitReport from '../components/reports/UnitReport';
import { FormControl, Select, MenuItem, Box } from '@mui/material';

const UnitReportView = () => {
  const { samsUser } = useAuth();
  const { selectedClient } = useClient();
  const [userUnitId, setUserUnitId] = useState(null);
  const [userUnits, setUserUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (samsUser && selectedClient) {
      determineUserUnit();
    }
  }, [samsUser, selectedClient]);

  const determineUserUnit = () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's client access for current client
      const propertyAccess = samsUser.samsProfile?.propertyAccess?.[selectedClient.id];
      
      if (!propertyAccess) {
        throw new Error('No access to current client');
      }

      if (propertyAccess.role !== 'unitOwner' && propertyAccess.role !== 'unitManager') {
        // Allow admins and superAdmins to view reports for testing, but they need to specify unit
        if (propertyAccess.role === 'admin' || samsUser.globalRole === 'superAdmin') {
          // For testing purposes, use a default unit or show error asking for unit selection
          throw new Error('Please specify a unit ID in the URL (e.g., /unit-report/101)');
        }
        throw new Error('Access denied: Only unit owners can view unit reports');
      }

      // Check if user has multiple units
      const units = [];
      if (propertyAccess.unitId) {
        units.push({ id: propertyAccess.unitId, name: `Unit ${propertyAccess.unitId}` });
      }
      
      // Check for additional units in propertyAccess
      if (propertyAccess.units && Array.isArray(propertyAccess.units)) {
        propertyAccess.units.forEach(unit => {
          if (!units.find(u => u.id === unit.id)) {
            units.push({ id: unit.id, name: unit.name || `Unit ${unit.id}` });
          }
        });
      }

      if (units.length === 0) {
        throw new Error('No unit assigned to your account');
      }

      setUserUnits(units);
      setUserUnitId(units[0].id);
      setSelectedUnitId(units[0].id);
    } catch (err) {
      console.error('Error determining user unit:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="view-container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e3e3e3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'unitReportDesktopSpin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes unitReportDesktopSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `
          }} />
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>
            Loading your unit information...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view-container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffebee',
            border: '1px solid #ffcdd2',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '500px'
          }}>
            <h3 style={{ color: '#d32f2f', margin: '0 0 16px 0', fontSize: '20px' }}>
              Access Error
            </h3>
            <p style={{ color: '#6c757d', margin: '0 0 24px 0', fontSize: '16px', lineHeight: '1.5' }}>
              {error}
            </p>
            <button
              onClick={determineUserUnit}
              style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!userUnitId) {
    return (
      <div className="view-container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#6c757d', margin: '0 0 16px 0' }}>No Unit Assigned</h3>
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>
            No unit assigned to your account. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const handleUnitChange = (event) => {
    setSelectedUnitId(event.target.value);
    setUserUnitId(event.target.value);
  };

  return (
    <div className="view-container">
      {userUnits.length > 1 && (
        <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <FormControl fullWidth variant="outlined" size="small">
            <Select
              value={selectedUnitId || ''}
              onChange={handleUnitChange}
              displayEmpty
              sx={{ backgroundColor: 'white' }}
            >
              {userUnits.map(unit => (
                <MenuItem key={unit.id} value={unit.id}>
                  {unit.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      <UnitReport unitId={userUnitId} />
    </div>
  );
};

export default UnitReportView;