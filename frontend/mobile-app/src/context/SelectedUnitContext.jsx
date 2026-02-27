import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';

const SelectedUnitContext = createContext({});

export const useSelectedUnit = () => {
  const context = useContext(SelectedUnitContext);
  if (!context) {
    throw new Error('useSelectedUnit must be used within a SelectedUnitProvider');
  }
  return context;
};

/**
 * Extracts units with unitOwner or unitManager role from clientAccess.
 * Supports both new unitAssignments array and legacy flat structure.
 */
function extractAvailableUnits(samsUser, clientId) {
  const clientAccess = samsUser?.clientAccess || samsUser?.propertyAccess;
  if (!clientAccess || !clientId) return [];

  const access = clientAccess[clientId];
  if (!access) return [];

  // New structure: unitAssignments array
  if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
    return access.unitAssignments
      .filter(u => u.role === 'unitOwner' || u.role === 'unitManager')
      .map(u => ({ unitId: u.unitId, role: u.role }));
  }

  // Legacy flat structure
  if (access.unitId && (access.role === 'unitOwner' || access.role === 'unitManager')) {
    return [{ unitId: access.unitId, role: access.role }];
  }

  return [];
}

export const SelectedUnitProvider = ({ children }) => {
  const { samsUser, currentClient } = useAuth();
  const [selectedUnitId, setSelectedUnitIdState] = useState(null);

  const availableUnits = useMemo(
    () => extractAvailableUnits(samsUser, currentClient),
    [samsUser, currentClient]
  );

  // Restore from localStorage or auto-select when client changes
  useEffect(() => {
    if (!currentClient) {
      setSelectedUnitIdState(null);
      return;
    }

    const key = `sams_mobile_selectedUnit_${currentClient}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored && availableUnits.some(u => u.unitId === stored)) {
        setSelectedUnitIdState(stored);
        return;
      }
    } catch (_) { /* ignore localStorage errors */ }

    // Auto-select first unit (or only unit)
    if (availableUnits.length > 0) {
      setSelectedUnitIdState(availableUnits[0].unitId);
    } else {
      setSelectedUnitIdState(null);
    }
  }, [currentClient, availableUnits]);

  const setSelectedUnitId = useCallback((unitId) => {
    setSelectedUnitIdState(unitId);
    if (currentClient && unitId) {
      try {
        localStorage.setItem(`sams_mobile_selectedUnit_${currentClient}`, unitId);
      } catch (_) { /* ignore */ }
    }
  }, [currentClient]);

  const value = useMemo(() => ({
    selectedUnitId,
    setSelectedUnitId,
    availableUnits,
  }), [selectedUnitId, setSelectedUnitId, availableUnits]);

  return (
    <SelectedUnitContext.Provider value={value}>
      {children}
    </SelectedUnitContext.Provider>
  );
};

export default SelectedUnitContext;
