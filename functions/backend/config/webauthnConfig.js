/**
 * WebAuthn Relying Party configuration for SAMS passkey authentication.
 * rpID must match the domain. For local dev, use a tunnel or dev domain.
 */

export const webauthnConfig = {
  rpName: 'SAMS - Sandyland Asset Management',
  rpID: process.env.WEBAUTHN_RP_ID || 'sams.sandyland.com.mx',
  origin: process.env.WEBAUTHN_ORIGIN || 'https://sams.sandyland.com.mx',
};
