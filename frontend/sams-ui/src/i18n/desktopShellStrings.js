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
    'status.connected': 'Connected',
    'status.errorUnavailable': 'Unable to check errors',
    'status.noSystemErrors': 'No system errors',
    'status.systemErrorCount': '{count} system error{suffix}',
    'status.infoHint': 'Info',
    'about.title': 'About {shortName}',
    'about.buildInformation': 'Build Information',
    'about.companyInformation': 'Company Information',
    'about.version': 'Version',
    'about.buildDate': 'Build Date',
    'about.environment': 'Environment',
    'about.gitCommit': 'Git Commit',
    'about.gitBranch': 'Git Branch',
    'about.company': 'Company',
    'about.copyright': 'Copyright',
    'about.developers': 'Developers',
    'about.type': 'Type',
    'about.systemType': 'Property Management System',
    'about.close': 'Close',
    'search.placeholder': 'Search...',
    'search.open': 'Search',
    'search.clear': 'Clear search',
    'list.entries': 'Entries ({count})',
    'date.allTime': 'All Time',
    'date.yearToDate': 'Year to Date',
    'date.yearToDateFiscal': 'Year to Date (FY)',
    'date.previousYear': 'Previous Year',
    'date.previousYearFiscal': 'Previous Year (FY)',
    'date.currentMonth': 'Current Month',
    'date.previousMonth': 'Previous Month',
    'date.previous3Months': 'Previous 3 Months',
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'date.thisWeek': 'This Week',
    'date.lastWeek': 'Last Week',
    'date.customRange': 'Custom Range...',
    'date.customRangeLabel': 'Custom Range',
    'date.filtered': 'Filtered',
    'date.quickFilters': 'Quick Date Filters',
    'date.filterByRange': 'Filter by date range',
    'route.loading': 'Loading...',
    'route.loadingProfile': 'Loading user profile...',
    'route.accessDenied.title': 'Access Denied',
    'route.accessDenied.message': "You don't have permission to access this feature.",
    'route.accessDenied.requiredPermission': 'Required permission',
    'route.accessDenied.userRole': 'Your role',
    'route.accessDenied.noRole': 'No role assigned',
    'activity.comingSoon': 'This feature is coming soon.',
    'reports.activity.title': 'Activity Reports',
    'reports.activity.description': 'View activity and transaction history reports.',
    'reports.comingSoon': 'Coming soon',
    'reports.zoom': 'Zoom',
    'reports.zoom.fit': 'Fit',
    'reports.zoom.pageWidth': 'Page Width',
    'reports.zoom.singlePage': 'Single Page',
    'reports.zoom.percentage': 'Percentage',
    'reports.selectClient': 'Please select a client to view reports.',
    'reports.tab.statement': 'Statement of Account',
    'reports.tab.budgetActual': 'Budget vs Actual',
    'reports.tab.activity': 'Activity',
    'reports.tab.historySoon': 'History (Soon)',
    'reports.history.title': 'Report History',
    'reports.history.description': 'View previously generated reports.',
    'budget.selectClient': 'Please select a client to manage budgets',
    'budget.action.viewBudgetVsActual': 'View Budget vs Actual report',
    'budget.action.createVote': 'Create Vote',
    'budget.action.createPoll': 'Create Poll',
    'budget.action.generating': 'Generating...',
    'budget.action.createVoteTitle': 'Create budget approval vote',
    'budget.action.createPollTitle': 'Create budget discussion poll',
    'budget.voteSummary': 'Budget Vote: {title} • {status} • {responses}/{units} responses',
    'budget.tab.entry': 'Budget Entry',
    'budget.tab.report': 'Budget Report',
    'budget.zoom': 'Zoom',
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
    'status.connected': 'Conectado',
    'status.errorUnavailable': 'No se pudieron consultar errores',
    'status.noSystemErrors': 'Sin errores del sistema',
    'status.systemErrorCount': '{count} error{suffix} del sistema',
    'status.infoHint': 'Info',
    'about.title': 'Acerca de {shortName}',
    'about.buildInformation': 'Informacion de compilacion',
    'about.companyInformation': 'Informacion de la empresa',
    'about.version': 'Version',
    'about.buildDate': 'Fecha de compilacion',
    'about.environment': 'Entorno',
    'about.gitCommit': 'Commit Git',
    'about.gitBranch': 'Rama Git',
    'about.company': 'Empresa',
    'about.copyright': 'Copyright',
    'about.developers': 'Desarrolladores',
    'about.type': 'Tipo',
    'about.systemType': 'Sistema de administracion de propiedades',
    'about.close': 'Cerrar',
    'search.placeholder': 'Buscar...',
    'search.open': 'Buscar',
    'search.clear': 'Limpiar busqueda',
    'list.entries': 'Entradas ({count})',
    'date.allTime': 'Todo el tiempo',
    'date.yearToDate': 'Ano en curso',
    'date.yearToDateFiscal': 'Ano en curso (AF)',
    'date.previousYear': 'Ano anterior',
    'date.previousYearFiscal': 'Ano anterior (AF)',
    'date.currentMonth': 'Mes actual',
    'date.previousMonth': 'Mes anterior',
    'date.previous3Months': 'Ultimos 3 meses',
    'date.today': 'Hoy',
    'date.yesterday': 'Ayer',
    'date.thisWeek': 'Esta semana',
    'date.lastWeek': 'Semana pasada',
    'date.customRange': 'Rango personalizado...',
    'date.customRangeLabel': 'Rango personalizado',
    'date.filtered': 'Filtrado',
    'date.quickFilters': 'Filtros rapidos de fecha',
    'date.filterByRange': 'Filtrar por rango de fecha',
    'route.loading': 'Cargando...',
    'route.loadingProfile': 'Cargando perfil de usuario...',
    'route.accessDenied.title': 'Acceso denegado',
    'route.accessDenied.message': 'No tienes permisos para acceder a esta funcion.',
    'route.accessDenied.requiredPermission': 'Permiso requerido',
    'route.accessDenied.userRole': 'Tu rol',
    'route.accessDenied.noRole': 'Sin rol asignado',
    'activity.comingSoon': 'Esta funcion estara disponible pronto.',
    'reports.activity.title': 'Reportes de actividad',
    'reports.activity.description': 'Consulta reportes de actividad e historial de transacciones.',
    'reports.comingSoon': 'Proximamente',
    'reports.zoom': 'Zoom',
    'reports.zoom.fit': 'Ajuste',
    'reports.zoom.pageWidth': 'Ancho de pagina',
    'reports.zoom.singlePage': 'Pagina unica',
    'reports.zoom.percentage': 'Porcentaje',
    'reports.selectClient': 'Selecciona un cliente para ver reportes.',
    'reports.tab.statement': 'Estado de cuenta',
    'reports.tab.budgetActual': 'Presupuesto vs Real',
    'reports.tab.activity': 'Actividad',
    'reports.tab.historySoon': 'Historial (Pronto)',
    'reports.history.title': 'Historial de reportes',
    'reports.history.description': 'Consulta reportes generados previamente.',
    'budget.selectClient': 'Selecciona un cliente para administrar presupuestos',
    'budget.action.viewBudgetVsActual': 'Ver Presupuesto vs Real',
    'budget.action.createVote': 'Crear votacion',
    'budget.action.createPoll': 'Crear encuesta',
    'budget.action.generating': 'Generando...',
    'budget.action.createVoteTitle': 'Crear votacion de aprobacion de presupuesto',
    'budget.action.createPollTitle': 'Crear encuesta de discusion de presupuesto',
    'budget.voteSummary': 'Votacion de presupuesto: {title} • {status} • {responses}/{units} respuestas',
    'budget.tab.entry': 'Captura de presupuesto',
    'budget.tab.report': 'Reporte de presupuesto',
    'budget.zoom': 'Zoom',
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

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_match, token) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}

export function getDesktopShellString(language, key, localizationEnabled = true, params = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const resolvedLanguage = localizationEnabled ? normalizedLanguage : 'EN';
  const localized = STRINGS[resolvedLanguage][key];

  if (localized != null) {
    return typeof localized === 'string' ? interpolate(localized, params) : localized;
  }

  const englishFallback = STRINGS.EN[key];
  if (englishFallback) {
    return typeof englishFallback === 'string'
      ? interpolate(englishFallback, params)
      : englishFallback;
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
