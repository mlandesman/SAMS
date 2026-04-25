import { getFeatureFlags } from './featureFlags.js';

const ACCEPTED_ES_ALIASES = new Set(['es', 'spanish', 'espanol', 'español']);
const ACCEPTED_EN_ALIASES = new Set(['en', 'english']);

function normalizeRawLanguage(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized) return null;
  if (ACCEPTED_ES_ALIASES.has(normalized)) return 'ES';
  if (ACCEPTED_EN_ALIASES.has(normalized)) return 'EN';
  return null;
}

export function resolveRequestLanguage(req) {
  const headerLang = normalizeRawLanguage(req?.headers?.['x-sams-language']);
  const queryLang = normalizeRawLanguage(req?.query?.lang);
  const queryLanguage = normalizeRawLanguage(req?.query?.language);

  let requested = req?.headers?.['x-sams-language'] ?? req?.query?.lang ?? req?.query?.language ?? null;
  let resolved = 'EN';
  let source = 'default';

  if (headerLang) {
    resolved = headerLang;
    source = 'header';
  } else if (queryLang) {
    resolved = queryLang;
    source = 'lang';
  } else if (queryLanguage) {
    resolved = queryLanguage;
    source = 'language';
  }

  return {
    requestedLanguage: requested,
    resolvedLanguage: resolved,
    source,
    fallbackToEnglish: resolved === 'EN' && source === 'default',
  };
}

function parseFlagConfig(flags) {
  const fromNested = flags?.localizationContractV1;
  const enabled = fromNested?.enabled === true || flags?.localizationContractV1?.enabled === true;
  const shadowMode = fromNested?.shadowMode === true;
  const localizedCompanions = fromNested?.localizedCompanions === true;
  const translateFreeForm = fromNested?.translateFreeForm === true;
  const allowlist = Array.isArray(fromNested?.allowlist) ? fromNested.allowlist : [];

  return { enabled, shadowMode, localizedCompanions, translateFreeForm, allowlist };
}

export async function getLocalizationContext(req, endpointKey) {
  const language = resolveRequestLanguage(req);
  const flags = await getFeatureFlags().catch(() => ({}));
  const config = parseFlagConfig(flags || {});
  const endpointAllowed = config.allowlist.includes(endpointKey);
  const isOnForEndpoint = config.enabled && endpointAllowed;

  return {
    ...language,
    endpointKey,
    flags: {
      ...config,
      endpointAllowed,
      isOnForEndpoint,
      companionsOn: isOnForEndpoint && config.localizedCompanions,
      translateFreeFormOn: isOnForEndpoint && config.localizedCompanions && config.translateFreeForm,
      shadowOn: config.enabled && config.shadowMode,
    },
  };
}

export function languageToReportLanguage(resolvedLanguage) {
  return resolvedLanguage === 'ES' ? 'spanish' : 'english';
}

export function buildLocalizationMeta(ctx, extra = {}) {
  return {
    requestedLanguage: ctx.requestedLanguage || null,
    resolvedLanguage: ctx.resolvedLanguage,
    source: ctx.source,
    fallbackToEnglish: ctx.fallbackToEnglish,
    endpoint: ctx.endpointKey,
    mode: ctx.flags.shadowOn ? 'shadow' : (ctx.flags.companionsOn ? 'localized' : 'legacy'),
    ...extra,
  };
}

export function applyLocalizationHeaders(res, ctx) {
  res.setHeader('X-SAMS-Language-Resolved', ctx.resolvedLanguage);
  const mode = ctx.flags.shadowOn ? 'shadow' : (ctx.flags.companionsOn ? 'localized' : 'legacy');
  res.setHeader('X-SAMS-Localization-Mode', mode);
}
