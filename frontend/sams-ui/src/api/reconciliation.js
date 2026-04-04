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

export async function manualPair(clientId, sessionId, normalizedRowId, transactionId, justification = null) {
  const res = await fetch(
    `${config.api.baseUrl}/clients/${clientId}/reconciliations/${sessionId}/manual-pair`,
    {
      method: 'POST',
      headers: await authHeaderJson(),
      body: JSON.stringify({ normalizedRowId, transactionId, justification })
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
