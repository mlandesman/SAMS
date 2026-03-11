/**
 * Passkey (WebAuthn) service - PK2 mobile API wrapper.
 * Login only; registration is desktop-only (InviteView, post-login prompt).
 */

import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
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

  async startPasskeyLogin(email) {
    const { options, challengeId } = await this.loginOptions(email);
    const optionsJSON = typeof options === 'string' ? JSON.parse(options) : options;
    const credential = await startAuthentication({ optionsJSON });
    return this.loginVerify(credential, challengeId);
  },
};
