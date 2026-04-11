/**
 * Canonical display-name resolution for SAMS user records (Firestore users collection shape).
 * Used by backend unit contact resolution and frontend owner/manager surfaces.
 *
 * Precedence when multiple fields are populated (see userManagementController createUser / updateUser):
 * — Display label (getDisplayNameFromUser): **current (NRM) profile first**, then legacy scalars.
 *   1. profile.firstName + profile.lastName (structured name from create/update)
 *   2. profile.displayName
 *   3. name, displayName (root — updated by updateUser / createUser)
 *   4. contactName (older legacy)
 *   5. root email, then profile.email (use as label only when no name)
 * — Email (getCanonicalEmailFromUser): **root email** (source in createUser), then profile.email (legacy).
 * — Phone (getCanonicalPhoneFromUser): **profile.phone** (source in createUser), then root phone (legacy).
 *
 * Non-string field values are coerced (Firestore may store legacy scalars).
 */

function strField(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  return '';
}

export function getDisplayNameFromUser(userData = {}) {
  if (!userData || typeof userData !== 'object') return '';

  const profile = userData.profile || {};
  const firstName = strField(profile.firstName);
  const lastName = strField(profile.lastName);
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;

  const profileDisplayName = strField(profile.displayName);
  if (profileDisplayName) return profileDisplayName;

  const name = strField(userData.name);
  if (name) return name;

  const displayName = strField(userData.displayName);
  if (displayName) return displayName;

  const contactName = strField(userData.contactName);
  if (contactName) return contactName;

  const email = strField(userData.email);
  if (email) return email;

  const profileEmail = strField(profile.email);
  if (profileEmail) return profileEmail;

  return '';
}

/**
 * Contact/login email for API responses: root `email` (createUser / Auth-aligned), then `profile.email` (legacy).
 */
export function getCanonicalEmailFromUser(userData = {}) {
  if (!userData || typeof userData !== 'object') return '';
  const root = strField(userData.email);
  if (root) return root;
  const profile = userData.profile || {};
  return strField(profile.email);
}

/**
 * Phone for API responses: `profile.phone` (createUser), then root `phone` (legacy).
 */
export function getCanonicalPhoneFromUser(userData = {}) {
  if (!userData || typeof userData !== 'object') return '';
  const profile = userData.profile || {};
  const fromProfile = strField(profile.phone);
  if (fromProfile) return fromProfile;
  return strField(userData.phone);
}
