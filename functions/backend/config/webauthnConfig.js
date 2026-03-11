/**
 * WebAuthn Relying Party configuration for SAMS passkey authentication.
 * rpID must match the domain. For local dev, use a tunnel or dev domain.
 * origin supports comma-separated values for multi-origin (desktop + mobile + ngrok).
 */

const DEFAULT_ORIGIN = 'https://sams.sandyland.com.mx,https://mobile.sams.sandyland.com.mx';

function parseOrigins(value) {
  if (!value) return DEFAULT_ORIGIN;
  const origins = value.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) return DEFAULT_ORIGIN;
  return origins.length === 1 ? origins[0] : origins;
}

export const webauthnConfig = {
  rpName: 'SAMS - Sandyland Asset Management',
  rpID: process.env.WEBAUTHN_RP_ID || 'sandyland.com.mx',
  origin: parseOrigins(process.env.WEBAUTHN_ORIGIN || DEFAULT_ORIGIN),
};
