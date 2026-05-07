const RECON_SESSION_STORAGE_PREFIX = 'reconciliation:last-session:';
export const RECON_SESSION_CONTEXT_CHANGED_EVENT = 'reconciliation-session-context-changed';

const RESUMABLE_RECON_STATUSES = new Set(['draft', 'matching', 'reviewing']);

function normalizeSessionId(value) {
  const id = String(value || '').trim();
  return id || '';
}

export function isResumableReconciliationSession(session) {
  if (!session || session.accepted) return false;
  const status = String(session.status || 'draft').trim().toLowerCase();
  return RESUMABLE_RECON_STATUSES.has(status);
}

function buildStorageKey(clientId) {
  const id = String(clientId || '').trim();
  return id ? `${RECON_SESSION_STORAGE_PREFIX}${id}` : '';
}

export function buildReconciliationPath(sessionId = '') {
  const normalized = normalizeSessionId(sessionId);
  return normalized ? `/reconciliation?session=${encodeURIComponent(normalized)}` : '/reconciliation';
}

export function saveReconciliationSessionContext(clientId, sessionId) {
  const key = buildStorageKey(clientId);
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!key) return;
  if (!normalizedSessionId) {
    sessionStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent(RECON_SESSION_CONTEXT_CHANGED_EVENT, {
      detail: { clientId, sessionId: '' }
    }));
    return;
  }
  sessionStorage.setItem(key, normalizedSessionId);
  window.dispatchEvent(new CustomEvent(RECON_SESSION_CONTEXT_CHANGED_EVENT, {
    detail: { clientId, sessionId: normalizedSessionId }
  }));
}

export function getReconciliationSessionContext(clientId) {
  const key = buildStorageKey(clientId);
  if (!key) return '';
  return normalizeSessionId(sessionStorage.getItem(key));
}

export function clearReconciliationSessionContext(clientId) {
  const key = buildStorageKey(clientId);
  if (!key) return;
  sessionStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(RECON_SESSION_CONTEXT_CHANGED_EVENT, {
    detail: { clientId, sessionId: '' }
  }));
}
