import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useAuth } from './AuthContext';
import { normalizeProfileLanguageToUi } from '../i18n/desktopShellStrings';

const DesktopLanguageContext = createContext(null);
const LANGUAGE_STORAGE_KEY = 'desktopLanguageUi';
const FEATURE_FLAG_DOC = 'system/featureFlags';

function getStoredLanguage() {
  if (typeof window === 'undefined') {
    return 'EN';
  }

  const stored = window.sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'ES' ? 'ES' : 'EN';
}

function isLocalizationFeatureEnabled(flags) {
  const localizationFlags = flags?.localizationContractV1;
  if (!localizationFlags) return false;
  return localizationFlags.enabled === true && localizationFlags.localizedCompanions === true;
}

export function DesktopLanguageProvider({ children }) {
  const { currentUser, samsUser } = useAuth();
  const [selectedLanguage, setSelectedLanguageState] = useState(getStoredLanguage);
  const [localizationEnabled, setLocalizationEnabled] = useState(false);
  const seededForUidRef = useRef(null);
  const fetchedFlagForUidRef = useRef(null);

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = nextLanguage === 'ES' ? 'ES' : 'EN';
    setSelectedLanguageState(normalized);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      seededForUidRef.current = null;
      fetchedFlagForUidRef.current = null;
      setSelectedLanguageState('EN');
      setLocalizationEnabled(false);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(LANGUAGE_STORAGE_KEY);
      }
      return;
    }

    if (!samsUser) return;

    const uid = currentUser.uid;
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;

    const profile = samsUser.profile || {};
    const rawPreferredLanguage =
      profile.preferredLanguage ??
      profile.preferred_language ??
      samsUser.preferredLanguage ??
      samsUser.preferred_language;

    const hasProfilePreferredLanguage =
      rawPreferredLanguage != null && String(rawPreferredLanguage).trim() !== '';

    const initialLanguage = hasProfilePreferredLanguage
      ? normalizeProfileLanguageToUi(rawPreferredLanguage)
      : getStoredLanguage();

    setSelectedLanguageState(initialLanguage);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, initialLanguage);
    }
  }, [currentUser, samsUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalizationFeatureFlag() {
      if (!currentUser) return;
      const uid = currentUser.uid;
      if (fetchedFlagForUidRef.current === uid) return;
      fetchedFlagForUidRef.current = uid;

      try {
        const snapshot = await getDoc(doc(db, FEATURE_FLAG_DOC));
        const flags = snapshot.exists() ? snapshot.data() : {};
        if (!cancelled) {
          setLocalizationEnabled(isLocalizationFeatureEnabled(flags));
        }
      } catch (error) {
        console.warn('Failed to load localization feature flag. Falling back to legacy-safe mode.', error);
        if (!cancelled) {
          setLocalizationEnabled(false);
        }
      }
    }

    loadLocalizationFeatureFlag();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const effectiveLanguage = localizationEnabled ? selectedLanguage : 'EN';

  const value = useMemo(
    () => ({
      language: effectiveLanguage,
      selectedLanguage,
      setLanguage,
      localizationEnabled,
      isSpanish: effectiveLanguage === 'ES',
    }),
    [effectiveLanguage, selectedLanguage, setLanguage, localizationEnabled]
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
