const SYSTEM_SCHEDULER_UID = 'system-scheduler';
const SYSTEM_SCHEDULER_EMAIL = 'system@sams.sandyland.com.mx';

/**
 * Synthetic Firebase user used by scheduled jobs (internalApiClient);
 * not a person, so interactive login/password flows should be blocked.
 */
export function isSystemSchedulerAccount(userId, userData) {
  if (userId === SYSTEM_SCHEDULER_UID) return true;
  if (userData?.isSystemAccount === true) return true;
  const email = (userData?.email || '').trim().toLowerCase();
  return email === SYSTEM_SCHEDULER_EMAIL;
}

export { SYSTEM_SCHEDULER_UID, SYSTEM_SCHEDULER_EMAIL };
