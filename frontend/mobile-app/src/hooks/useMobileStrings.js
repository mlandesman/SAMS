import { useCallback } from 'react';
import { useSessionPreferences } from '../context/SessionPreferencesContext.jsx';
import { getMobileString } from '../i18n/mobileStrings.js';

export function useMobileStrings() {
  const { preferredLanguageUi } = useSessionPreferences();

  return useCallback(
    (key, params = {}) => getMobileString(preferredLanguageUi, key, params),
    [preferredLanguageUi]
  );
}

