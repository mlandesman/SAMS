import { useCallback, useEffect, useMemo, useState } from 'react';

const INSTALL_DISMISSED_KEY = 'samsInstallDismissed';
const INSTALL_CONFIRMED_KEY = 'samsInstalled';
const INSTALL_INTERACTED_KEY = 'samsInstallInteracted';

const MOBILE_USER_AGENT_REGEX = /iPhone|iPad|iPod|Android/i;
const IOS_USER_AGENT_REGEX = /iPhone|iPad|iPod/i;

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mobile = MOBILE_USER_AGENT_REGEX.test(window.navigator.userAgent);
    const ios = IOS_USER_AGENT_REGEX.test(window.navigator.userAgent);
    const standalone = isStandaloneMode();
    const markedInstalled = localStorage.getItem(INSTALL_CONFIRMED_KEY) === 'true';
    const wasDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';

    setIsMobile(mobile);
    setIsIOS(ios);
    setIsInstalled(standalone || markedInstalled);
    setDismissed(wasDismissed);

    const promptHandler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const installedHandler = () => {
      localStorage.setItem(INSTALL_CONFIRMED_KEY, 'true');
      localStorage.setItem(INSTALL_INTERACTED_KEY, 'true');
      setIsInstalled(true);
      setDismissed(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', promptHandler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleModeChange = () => {
      if (mediaQuery.matches) {
        localStorage.setItem(INSTALL_CONFIRMED_KEY, 'true');
        setIsInstalled(true);
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleModeChange);
      return () => mediaQuery.removeEventListener('change', handleModeChange);
    }

    mediaQuery.addListener(handleModeChange);
    return () => mediaQuery.removeListener(handleModeChange);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    const accepted = outcome === 'accepted';

    localStorage.setItem(INSTALL_INTERACTED_KEY, 'true');
    setDeferredPrompt(null);

    if (accepted) {
      localStorage.setItem(INSTALL_CONFIRMED_KEY, 'true');
      setIsInstalled(true);
      setDismissed(true);
    }

    return accepted;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
    localStorage.setItem(INSTALL_INTERACTED_KEY, 'true');
    setDismissed(true);
  }, []);

  const reopenInstallUI = useCallback(() => {
    localStorage.removeItem(INSTALL_DISMISSED_KEY);
    setDismissed(false);
  }, []);

  const showInstallUI = useMemo(() => {
    return isMobile && !isInstalled && !dismissed;
  }, [dismissed, isInstalled, isMobile]);

  return {
    showInstallUI,
    isIOS,
    isMobile,
    isInstalled,
    canPromptInstall: Boolean(deferredPrompt),
    promptInstall,
    dismiss,
    reopenInstallUI
  };
}
