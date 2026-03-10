/**
 * Passkey (WebAuthn) service - PK2 frontend API wrapper.
 * Encapsulates all WebAuthn API calls for login and registration.
 */

import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { config } from '../config';

const API_BASE = config.api.baseUrl;

export const passkeyService = {
  supportsPasskeys() {
    return browserSupportsWebAuthn();
  },

  /**
   * POST /auth/passkey/login/options
   * @param {string} [email] - Optional. For discoverable credentials, omit.
   * @returns {Promise<{options: object, challengeId: string}>}
   */
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

  /**
   * POST /auth/passkey/login/verify
   * @param {object} credential - WebAuthn credential from startAuthentication
   * @param {string} challengeId
   * @returns {Promise<{token: string, user: object}>}
   */
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

  /**
   * POST /auth/passkey/register/options
   * @param {string} email - Required
   * @param {string} [authToken] - Bearer token for bootstrap flow
   * @param {string} [inviteToken] - For invite flow
   * @returns {Promise<{options: object, challengeId: string}>}
   */
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

  /**
   * POST /auth/passkey/register/verify
   * @param {string} email
   * @param {object} credential - WebAuthn credential from startRegistration
   * @param {string} challengeId
   * @param {string} [deviceName]
   * @param {string} [inviteToken] - For invite flow
   * @returns {Promise<{token: string, user: object}>}
   */
  async registerVerify(email, credential, challengeId, deviceName, inviteToken) {
    const url = `${API_BASE}/auth/passkey/register/verify`;
    const body = {
      email: (email || '').trim().toLowerCase(),
      credential,
      challengeId,
      ...(deviceName && { deviceName: (deviceName || '').trim() || deviceName }),
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

  /**
   * Full passkey login flow: options → biometric → verify
   */
  async startPasskeyLogin(email) {
    const { options, challengeId } = await this.loginOptions(email);
    const optionsJSON = typeof options === 'string' ? JSON.parse(options) : options;
    const credential = await startAuthentication({ optionsJSON });
    return this.loginVerify(credential, challengeId);
  },

  /**
   * Full passkey registration flow: options → biometric → verify
   */
  async startPasskeyRegistration(email, authToken, deviceName, inviteToken) {
    const { options, challengeId } = await this.registerOptions(email, authToken, inviteToken);
    const optionsJSON = typeof options === 'string' ? JSON.parse(options) : options;
    const credential = await startRegistration({ optionsJSON });
    return this.registerVerify(email, credential, challengeId, deviceName, inviteToken);
  },
};
