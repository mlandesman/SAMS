import { useCallback } from 'react';
import { useDesktopLanguage } from '../context/DesktopLanguageContext';
import { getDesktopShellString, getLocalizedMenuLabel } from '../i18n/desktopShellStrings';

export function useDesktopStrings() {
  const { language, localizationEnabled } = useDesktopLanguage();

  const t = useCallback(
    (key) => getDesktopShellString(language, key, localizationEnabled),
    [language, localizationEnabled]
  );

  const menuLabel = useCallback(
    (activity, fallbackLabel) => getLocalizedMenuLabel(language, activity, fallbackLabel, localizationEnabled),
    [language, localizationEnabled]
  );

  return {
    language,
    localizationEnabled,
    t,
    menuLabel,
  };
}
