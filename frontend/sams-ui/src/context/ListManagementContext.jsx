import React, { createContext, useContext, useState } from 'react';

// Context for sharing list management state between components
const ListManagementContext = createContext();

export const useListManagement = () => {
  const context = useContext(ListManagementContext);
  // Return default values if context is not available
  if (!context) {
    return {
      entryCount: 0,
      isGlobalSearchActive: false,
      searchTerm: '',
      handleGlobalSearch: () => {},
      handleClearGlobalSearch: () => {},
      updateEntryCount: () => {}
    };
  }
  return context;
};

export const ListManagementProvider = ({ children }) => {
  const [entryCount, setEntryCount] = useState(0);
  const [isGlobalSearchActive, setIsGlobalSearchActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleGlobalSearch = (searchTerm) => {
    console.log('List Management Global search triggered:', searchTerm);
    setSearchTerm(searchTerm);
    setIsGlobalSearchActive(true);
  };

  const handleClearGlobalSearch = () => {
    console.log('List Management Global search cleared');
    setSearchTerm('');
    setIsGlobalSearchActive(false);
  };

  const updateEntryCount = (count) => {
    setEntryCount(count);
  };

  return (
    <ListManagementContext.Provider
      value={{
        entryCount,
        isGlobalSearchActive,
        searchTerm,
        handleGlobalSearch,
        handleClearGlobalSearch,
        updateEntryCount
      }}
    >
      {children}
    </ListManagementContext.Provider>
  );
};
