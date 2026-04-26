import React, { createContext, useContext, useMemo, useState } from 'react';

const DesktopLanguageContext = createContext(null);
const LANGUAGE_STORAGE_KEY = 'desktopLanguageUi';

function getInitialLanguage() {
  if (typeof window === 'undefined') {
    return 'EN';
  }

  const stored = window.sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'ES' ? 'ES' : 'EN';
}

export function DesktopLanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = (nextLanguage) => {
    const normalized = nextLanguage === 'ES' ? 'ES' : 'EN';
    setLanguageState(normalized);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isSpanish: language === 'ES',
    }),
    [language]
  );

  return (
    <DesktopLanguageContext.Provider value={value}>
      {children}
    </DesktopLanguageContext.Provider>
  );
}

export function useDesktopLanguage() {
  const context = useContext(DesktopLanguageContext);

  if (!context) {
    throw new Error('useDesktopLanguage must be used within DesktopLanguageProvider');
  }

  return context;
}
