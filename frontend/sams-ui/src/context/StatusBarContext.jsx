import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Generic context for status bar information that can be used by any module
const StatusBarContext = createContext();

export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    return {
      statusInfo: null,
      setStatusInfo: () => {},
      clearStatusInfo: () => {}
    };
  }
  return context;
};

export const StatusBarProvider = ({ children }) => {
  const [statusInfo, setStatusInfoState] = useState(null);

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

  const value = useMemo(() => ({
    statusInfo,
    setStatusInfo,
    clearStatusInfo
  }), [statusInfo, setStatusInfo, clearStatusInfo]);

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
};
