const STRINGS = {
  EN: {
    'sidebar.activities': 'Activities',
    'sidebar.language': 'Language',
    'sidebar.languageToggle': 'Language: 🇺🇸',
    'sidebar.changeClient': 'Change Client',
    'sidebar.loadingMenu': 'Loading menu...',
    'sidebar.errorMenu': 'Error loading menu',
    'sidebar.reconciliation': 'Bank Reconciliation',
    'layout.loggedInAs': 'Logged in as',
    'layout.logout': 'Logout',
  },
  ES: {
    'sidebar.activities': 'Actividades',
    'sidebar.language': 'Idioma',
    'sidebar.languageToggle': 'Idioma: 🇲🇽',
    'sidebar.changeClient': 'Cambiar cliente',
    'sidebar.loadingMenu': 'Cargando menu...',
    'sidebar.errorMenu': 'Error al cargar menu',
    'sidebar.reconciliation': 'Conciliacion bancaria',
    'layout.loggedInAs': 'Sesion iniciada como',
    'layout.logout': 'Cerrar sesion',
  },
};

const MENU_LABELS_BY_ACTIVITY = {
  dashboard: { EN: 'Dashboard', ES: 'Inicio' },
  transactions: { EN: 'Transactions', ES: 'Transacciones' },
  settings: { EN: 'Settings', ES: 'Configuracion' },
  reports: { EN: 'Reports', ES: 'Reportes' },
  projects: { EN: 'Projects', ES: 'Proyectos' },
  budgets: { EN: 'Budgets', ES: 'Presupuestos' },
  lists: { EN: 'List Management', ES: 'Listas' },
  listmanagement: { EN: 'List Management', ES: 'Listas' },
  users: { EN: 'User Management', ES: 'Gestion de usuarios' },
  hoadues: { EN: 'HOA Dues', ES: 'Cuotas HOA' },
  waterbills: { EN: 'Water Bills', ES: 'Recibos de agua' },
  propane: { EN: 'Propane', ES: 'Gas propano' },
  propanetanks: { EN: 'Propane Tanks', ES: 'Tanques de gas' },
};

function normalizeLanguage(language) {
  return language === 'ES' ? 'ES' : 'EN';
}

export function getDesktopShellString(language, key, localizationEnabled = true) {
  const normalizedLanguage = normalizeLanguage(language);
  const resolvedLanguage = localizationEnabled ? normalizedLanguage : 'EN';
  const localized = STRINGS[resolvedLanguage][key];

  if (localized) {
    return localized;
  }

  const englishFallback = STRINGS.EN[key];
  if (englishFallback) {
    return englishFallback;
  }

  // Deterministic readable fallback for missing key cases.
  return `[missing: ${key}]`;
}

export function getLocalizedMenuLabel(language, activity, fallbackLabel, localizationEnabled = true) {
  const normalizedLanguage = normalizeLanguage(language);
  const resolvedLanguage = localizationEnabled ? normalizedLanguage : 'EN';
  const normalizedActivity = (activity || '').toLowerCase();
  const localizedEntry = MENU_LABELS_BY_ACTIVITY[normalizedActivity];

  if (localizedEntry && localizedEntry[resolvedLanguage]) {
    return localizedEntry[resolvedLanguage];
  }

  return fallbackLabel;
}

export function normalizeProfileLanguageToUi(raw) {
  if (raw == null || raw === '') return 'EN';
  const s = String(raw).trim().toLowerCase();
  if (s === 'es' || s === 'spanish' || s === 'esp' || s === 'es-mx' || s === 'es_mx') return 'ES';
  return 'EN';
}
