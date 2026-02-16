import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Generic context for status bar information that can be used by any module
const StatusBarContext = createContext();

export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    return {
      statusInfo: null,
      setStatusInfo: () => {},
      clearStatusInfo: () => {},
      errorMonitorStatus: null,
      setErrorMonitorStatus: () => {},
      clearErrorMonitorStatus: () => {},
    };
  }
  return context;
};

export const StatusBarProvider = ({ children }) => {
  const [statusInfo, setStatusInfoState] = useState(null);
  const [centerContent, setCenterContentState] = useState(null);
  const [errorMonitorStatus, setErrorMonitorStatusState] = useState(null);

  const setStatusInfo = useCallback((info) => {
    // Only update if the info has actually changed
    setStatusInfoState(prevInfo => {
      if (!prevInfo || JSON.stringify(prevInfo) !== JSON.stringify(info)) {
        return info;
      }
      return prevInfo;
    });
  }, []);

  const clearStatusInfo = useCallback(() => {
    setStatusInfoState(null);
  }, []);

  const setCenterContent = useCallback((content) => {
    setCenterContentState(content);
  }, []);

  const clearCenterContent = useCallback(() => {
    setCenterContentState(null);
  }, []);

  const setErrorMonitorStatus = useCallback((status) => {
    setErrorMonitorStatusState(status);
  }, []);

  const clearErrorMonitorStatus = useCallback(() => {
    setErrorMonitorStatusState(null);
  }, []);

  const value = useMemo(() => ({
    statusInfo,
    setStatusInfo,
    clearStatusInfo,
    centerContent,
    setCenterContent,
    clearCenterContent,
    errorMonitorStatus,
    setErrorMonitorStatus,
    clearErrorMonitorStatus,
  }), [statusInfo, centerContent, errorMonitorStatus, setStatusInfo, clearStatusInfo, setCenterContent, clearCenterContent, setErrorMonitorStatus, clearErrorMonitorStatus]);

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
};
