/**
 * Passkey (WebAuthn) service - PK2 mobile API wrapper.
 * Mirrors desktop passkeyService; uses mobile config.
 */

import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { config } from '../config/index.js';

const API_BASE = config.api.baseUrl;

export const passkeyService = {
  supportsPasskeys() {
    return browserSupportsWebAuthn();
  },

  async loginOptions(email) {
    const url = `${API_BASE}/auth/passkey/login/options`;
    const body = email ? { email: (email || '').trim().toLowerCase() } : {};
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Login options failed: ${response.status}`);
    }
    return response.json();
  },

  async loginVerify(credential, challengeId) {
    const url = `${API_BASE}/auth/passkey/login/verify`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, challengeId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Login verify failed: ${response.status}`);
    }
    return response.json();
  },

  async registerOptions(email, authToken, inviteToken) {
    const url = `${API_BASE}/auth/passkey/register/options`;
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    };
    const body = {
      email: (email || '').trim().toLowerCase(),
      ...(inviteToken && { inviteToken }),
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Register options failed: ${response.status}`);
    }
    return response.json();
  },

  async registerVerify(email, credential, challengeId, deviceName, inviteToken) {
    const url = `${API_BASE}/auth/passkey/register/verify`;
    const body = {
      email: (email || '').trim().toLowerCase(),
      credential,
      challengeId,
      ...(deviceName && { deviceName: (deviceName || '').trim() }),
      ...(inviteToken && { inviteToken }),
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Register verify failed: ${response.status}`);
    }
    return response.json();
  },

  async startPasskeyLogin(email) {
    const { options, challengeId } = await this.loginOptions(email);
    const optionsJSON = typeof options === 'string' ? JSON.parse(options) : options;
    const credential = await startAuthentication({ optionsJSON });
    return this.loginVerify(credential, challengeId);
  },

  async startPasskeyRegistration(email, authToken, deviceName, inviteToken) {
    const { options, challengeId } = await this.registerOptions(email, authToken, inviteToken);
    const optionsJSON = typeof options === 'string' ? JSON.parse(options) : options;
    const credential = await startRegistration({ optionsJSON });
    return this.registerVerify(email, credential, challengeId, deviceName, inviteToken);
  },
};
