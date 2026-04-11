import { config } from '../config';
import { getAuthInstance } from '../firebaseClient';

async function authHeaderJson() {
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function authHeaderOnly() {
  const auth = getAuthInstance();
  const token = await auth.currentUser?.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function createSession(clientId, data) {
  const res = await fetch(`${config.api.baseUrl}/clients/${clientId}/reconciliations`, {
    method: 'POST',
    headers: await authHeaderJson(),
    body: JSON.stringify(data)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.session;
}

export async function getSession(clientId, sessionId, includeRows = false) {
  const q = includeRows ? '?include=rows' : '';
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}${q}`,
    { headers: await authHeaderJson() }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.session;
}

export async function listSessions(clientId, accountId) {
  const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations${q}`,
    { headers: await authHeaderJson() }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.sessions || [];
}

export async function updateSession(clientId, sessionId, data) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}`,
    {
      method: 'PUT',
      headers: await authHeaderJson(),
      body: JSON.stringify(data)
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j.session;
}

export async function deleteSession(clientId, sessionId) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}`,
    {
      method: 'DELETE',
      headers: await authHeaderJson()
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function importBankFile(clientId, sessionId, bankFile, statementPdf) {
  const fd = new FormData();
  fd.append('bankFile', bankFile);
  if (statementPdf) fd.append('statementPdf', statementPdf);
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/import`,
    {
      method: 'POST',
      headers: await authHeaderOnly(),
      body: fd
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function runMatching(clientId, sessionId) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/match`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify({})
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function resolveException(clientId, sessionId, body) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/resolve`,
    {
      method: 'PUT',
      headers: await authHeaderJson(),
      body: JSON.stringify(body)
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function acceptSession(clientId, sessionId, body = {}) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/accept`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify(body)
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function getWorkbench(clientId, sessionId) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/workbench`,
    { headers: await authHeaderJson() }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

/**
 * @param {object} payload
 *   - Many-to-many: { normalizedRowIds: string[], transactionIds: string[], justification? }
 *   - Legacy 1:1: { normalizedRowId, transactionId, justification? }
 */
export async function manualPair(clientId, sessionId, payload) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/manual-pair`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify(payload || {})
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

/**
 * Create a Bank Adjustments transaction for the signed workbench gap (any magnitude / direction).
 * Server recomputes gap from the session and selected ids. Payload must include `justification` (non-empty).
 */
export async function applyMatchGapAdjustment(clientId, sessionId, payload) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/match-gap-adjustment`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify(payload || {})
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

/** Rebuild PDF from saved session + normalized rows + current txn docs (no Accept). */
export async function regenerateReconciliationReport(clientId, sessionId) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/regenerate-report`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify({})
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export async function excludeReconciliationItem(clientId, sessionId, payload) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/exclude`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify(payload)
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}
