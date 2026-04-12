/**
 * Quick regression check for BUGSWEEP-231: legacy propertyAccess.unitId + unitManager
 * must authorize the same unit (mirrors unitOwner). Run: node testing/verify-cross-client-unit-access.mjs
 */
import { hasUnitAccess } from '../middleware/unitAuthorization.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const mgr = { role: 'unitManager', unitId: '101' };
assert(hasUnitAccess(mgr, '101', 'user') === true, 'unitManager + matching unitId should allow');
assert(hasUnitAccess(mgr, '202', 'user') === false, 'unitManager + other unit should deny');

const owner = { role: 'unitOwner', unitId: '101' };
assert(hasUnitAccess(owner, '101', 'user') === true, 'unitOwner + matching unitId should allow');

const mgrViaAssignments = { role: 'unitManager', unitAssignments: [{ unitId: '303', role: 'unitManager' }] };
assert(hasUnitAccess(mgrViaAssignments, '303', 'user') === true, 'unitAssignments path for manager');

console.log('OK: verify-cross-client-unit-access checks passed');
