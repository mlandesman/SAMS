/**
 * My Unit Report - Auto-detects user's unit and displays their report
 * Wrapper component for UnitReport that handles unit owner authentication
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';
import UnitReport from './UnitReport.jsx';

const MyUnitReport = () => {
  const { samsUser, currentClient } = useAuth();
  const [userUnitId, setUserUnitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (samsUser) {
      console.log('MyUnitReport: Starting unit detection with:', {
        currentClient,
        preferredClient: samsUser.preferredClient,
        clientAccess: samsUser.clientAccess
      });
      
      if (currentClient) {
        console.log('MyUnitReport: Using currentClient:', currentClient);
        determineUserUnitForClient(currentClient);
      } else if (samsUser.preferredClient) {
        console.log('MyUnitReport: No currentClient, trying preferredClient:', samsUser.preferredClient);
        determineUserUnitForClient(samsUser.preferredClient);
      } else {
        // Try the first available client from clientAccess
        const availableClients = Object.keys(samsUser.clientAccess || {});
        if (availableClients.length > 0) {
          console.log('MyUnitReport: No current/preferred client, trying first available:', availableClients[0]);
          determineUserUnitForClient(availableClients[0]);
        } else {
          console.log('MyUnitReport: No clients available');
          setError('No client access available');
          setLoading(false);
        }
      }
    }
  }, [samsUser, currentClient]);

  const determineUserUnitForClient = (clientId) => {
    try {
      setLoading(true);
      setError(null);

      console.log('MyUnitReport Debug (for client):', {
        samsUser,
        clientId,
        clientAccess: samsUser?.clientAccess,
        targetClientAccess: samsUser?.clientAccess?.[clientId]
      });

      // Get user's client access for specified client
      const clientAccess = samsUser?.clientAccess?.[clientId];
      
      if (!clientAccess) {
        console.error('No client access found for:', clientId);
        console.error('Available client access:', samsUser?.clientAccess);
        throw new Error(`No access to client: ${clientId}. Available: ${Object.keys(samsUser?.clientAccess || {}).join(', ')}`);
      }

      console.log('Found client access:', clientAccess);

      // Check if user has unitAssignments (new structure)
      if (clientAccess.unitAssignments && Array.isArray(clientAccess.unitAssignments)) {
        console.log('Found unitAssignments:', clientAccess.unitAssignments);
        
        // Find units where user is owner or manager
        const ownedUnits = clientAccess.unitAssignments.filter(
          unit => unit.role === 'unitOwner' || unit.role === 'unitManager'
        );
        
        if (ownedUnits.length === 0) {
          throw new Error('Access denied: You are not an owner or manager of any units');
        }
        
        // Use the first owned unit (or could let user select if multiple)
        const primaryUnit = ownedUnits[0];
        console.log('Setting unit ID from unitAssignments:', primaryUnit.unitId);
        setUserUnitId(primaryUnit.unitId);
      } 
      // Fallback to old structure (backward compatibility)
      else if (clientAccess.role && clientAccess.unitId) {
        if (clientAccess.role !== 'unitOwner' && clientAccess.role !== 'unitManager') {
          throw new Error(`Access denied: Role "${clientAccess.role}" cannot view unit reports`);
        }
        console.log('Setting unit ID from legacy structure:', clientAccess.unitId);
        setUserUnitId(clientAccess.unitId);
      } 
      else {
        throw new Error('No unit access information found in your account');
      }
    } catch (err) {
      console.error('Error determining user unit for client:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const determineUserUnit = () => {
    try {
      setLoading(true);
      setError(null);

      console.log('MyUnitReport Debug:', {
        samsUser,
        currentClient,
        clientAccess: samsUser?.clientAccess,
        currentClientId: currentClient?.id
      });

      // Get user's client access for current client
      // Try exact match first, then case-insensitive search
      let clientAccess = samsUser?.clientAccess?.[currentClient.id];
      
      if (!clientAccess && samsUser?.clientAccess) {
        // Try case-insensitive match
        const availableClients = Object.keys(samsUser.clientAccess);
        const matchingClient = availableClients.find(clientId => 
          clientId.toLowerCase() === currentClient.id.toLowerCase()
        );
        
        if (matchingClient) {
          clientAccess = samsUser.clientAccess[matchingClient];
          console.log('Found client access with case-insensitive match:', matchingClient);
        }
      }
      
      if (!clientAccess) {
        console.error('No client access found for:', currentClient.id);
        console.error('Available client access:', samsUser?.clientAccess);
        console.error('Available client IDs:', Object.keys(samsUser?.clientAccess || {}));
        throw new Error(`No access to current client: ${currentClient.id}. Available: ${Object.keys(samsUser?.clientAccess || {}).join(', ')}`);
      }

      console.log('Found client access:', clientAccess);

      // Check if user has unitAssignments (new structure)
      if (clientAccess.unitAssignments && Array.isArray(clientAccess.unitAssignments)) {
        console.log('Found unitAssignments:', clientAccess.unitAssignments);
        
        // Find units where user is owner or manager
        const ownedUnits = clientAccess.unitAssignments.filter(
          unit => unit.role === 'unitOwner' || unit.role === 'unitManager'
        );
        
        if (ownedUnits.length === 0) {
          throw new Error('Access denied: You are not an owner or manager of any units');
        }
        
        // Use the first owned unit (or could let user select if multiple)
        const primaryUnit = ownedUnits[0];
        console.log('Setting unit ID from unitAssignments:', primaryUnit.unitId);
        setUserUnitId(primaryUnit.unitId);
      } 
      // Fallback to old structure (backward compatibility)
      else if (clientAccess.role && clientAccess.unitId) {
        if (clientAccess.role !== 'unitOwner' && clientAccess.role !== 'unitManager') {
          throw new Error(`Access denied: Role "${clientAccess.role}" cannot view unit reports`);
        }
        console.log('Setting unit ID from legacy structure:', clientAccess.unitId);
        setUserUnitId(clientAccess.unitId);
      } 
      else {
        throw new Error('No unit access information found in your account');
      }
    } catch (err) {
      console.error('Error determining user unit:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e3e3e3',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'unitReportSpin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes unitReportSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
        <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>
          Loading your unit information...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: '#ffebee',
          border: '1px solid #ffcdd2',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '400px'
        }}>
          <h3 style={{ color: '#d32f2f', margin: '0 0 12px 0', fontSize: '18px' }}>
            Access Error
          </h3>
          <p style={{ color: '#6c757d', margin: '0 0 20px 0', fontSize: '14px' }}>
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
              minHeight: '48px'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!userUnitId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6c757d', fontSize: '16px' }}>
          No unit assigned to your account. Please contact your administrator.
        </p>
      </div>
    );
  }

  return <UnitReport unitId={userUnitId} />;
};

export default MyUnitReport;