/**
 * Session-only preferences for mobile PWA (issue #251 extension).
 * Seeded from user profile on login when fields exist; never written back to profile from this app.
 * Hamburger Language | Idioma toggles EN/ES for this session only.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { normalizeProfileLanguageToUi, uiLanguageToStatementApi } from '../utils/sessionLanguage.js';

const SessionPreferencesContext = createContext(null);

export function SessionPreferencesProvider({ children }) {
  const { firebaseUser, samsUser } = useAuth();
  const [preferredLanguageUi, setPreferredLanguageUi] = useState('EN');
  /** Stub for future profile field + downstream formatting */
  const [preferredCurrency, setPreferredCurrency] = useState('MXN');
  const seededForUidRef = useRef(null);

  useEffect(() => {
    if (!firebaseUser) {
      seededForUidRef.current = null;
      setPreferredLanguageUi('EN');
      setPreferredCurrency('MXN');
      return;
    }

    if (!samsUser) return;

    const uid = firebaseUser.uid;
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;

    // getProfile() nests prefs under profile: { preferredLanguage, preferredCurrency }
    const prof = samsUser.profile || {};
    const rawLang =
      prof.preferredLanguage ??
      prof.preferred_language ??
      samsUser.preferredLanguage ??
      samsUser.preferred_language;
    setPreferredLanguageUi(normalizeProfileLanguageToUi(rawLang));

    const rawCur =
      prof.preferredCurrency ??
      prof.preferred_currency ??
      samsUser.preferredCurrency ??
      samsUser.preferred_currency;
    if (rawCur != null && String(rawCur).trim() !== '') {
      setPreferredCurrency(String(rawCur).trim().toUpperCase());
    } else {
      setPreferredCurrency('MXN');
    }
  }, [firebaseUser, samsUser]);

  const statementLanguageApi = useMemo(
    () => uiLanguageToStatementApi(preferredLanguageUi),
    [preferredLanguageUi],
  );

  const value = useMemo(
    () => ({
      preferredLanguageUi,
      setPreferredLanguageUi,
      statementLanguageApi,
      preferredCurrency,
    }),
    [preferredLanguageUi, statementLanguageApi, preferredCurrency],
  );

  return (
    <SessionPreferencesContext.Provider value={value}>
      {children}
    </SessionPreferencesContext.Provider>
  );
}

export function useSessionPreferences() {
  const ctx = useContext(SessionPreferencesContext);
  if (!ctx) {
    throw new Error('useSessionPreferences must be used within SessionPreferencesProvider');
  }
  return ctx;
}

export default SessionPreferencesContext;
