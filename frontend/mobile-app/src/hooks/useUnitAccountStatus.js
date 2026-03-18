/**
 * useUnitAccountStatus — Thin wrapper over UnitStatementContext
 *
 * All unit account data comes from the SoA (Statement of Account),
 * fetched once per unit selection by UnitStatementContext.
 * This hook preserves the { data, loading, error } shape that all
 * consumers expect.
 *
 * nextPaymentDueDate is derived from SoA lineItems, guaranteeing
 * mobile cards match the Statement of Account exactly.
 *
 * @param {string} [_clientId] - Ignored; context uses currentClient. Kept for API compatibility.
 * @param {string} [_unitId] - Ignored; context uses selectedUnitId. Kept for API compatibility.
 */
import { useUnitStatement } from '../context/UnitStatementContext.jsx';

export function useUnitAccountStatus(_clientId, _unitId) {
  const { accountData, loading, error } = useUnitStatement();
  return { data: accountData, loading, error };
}
