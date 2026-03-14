/**
 * UnitAssessmentsTable - Unit assessments grid sourced from allocation engine
 *
 * Data from allocationSnapshot (PM5A) + installments (PM5B) + unitCollections (PM7).
 * Billed/Paid from project bills subcollection (unitCollections prop).
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Collapse
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getOwnerInfo } from '../../utils/unitUtils';
import { formatCurrency as formatCurrencyShared } from '@shared/utils/currencyUtils';

function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  return formatCurrencyShared(centavos, 'USD');
}

/**
 * Get status chip for a unit row
 * Paid = all billed amount paid (paid >= billed). Partial = some paid. Pending = none paid.
 * For noAssessmentRequired: No Bill (no unit billing; progress via vendor payments).
 */
function getStatusChip({ excluded, paid, billed, totalAssessed, noAssessmentRequired }) {
  if (excluded) {
    return { label: 'Excluded', color: 'default' };
  }
  if (totalAssessed <= 0) {
    return { label: '—', color: 'default' };
  }
  // noAssessmentRequired: no unit bills; progress tracked by vendor payments
  if (noAssessmentRequired && billed === 0) {
    return { label: 'No Bill', color: 'default' };
  }
  // Paid when all billed amount is paid (or fully paid on total assessment)
  if (billed > 0 && paid >= billed) {
    return { label: 'Paid', color: 'success' };
  }
  if (paid >= totalAssessed) {
    return { label: 'Paid', color: 'success' };
  }
  if (paid > 0) {
    return { label: 'Partial', color: 'warning' };
  }
  return { label: 'Pending', color: 'error' };
}

/**
 * Get next milestone label (text, not date).
 * For normal projects: based on billed milestones (unit collections).
 * For noAssessmentRequired: based on vendor payments (which vendor milestones have been paid).
 */
function getNextMilestone({ excluded, paid, totalAssessed, installments, billedMilestoneCount, noAssessmentRequired, vendorPayments }) {
  if (excluded || !installments || installments.length === 0) return '-';
  if (totalAssessed > 0 && paid >= totalAssessed) return '-';

  let nextIdx;
  if (noAssessmentRequired && Array.isArray(vendorPayments) && vendorPayments.length > 0) {
    // Derive from vendor payments: find first unpaid milestone index (handles non-sequential completion)
    const paidIndices = new Set();
    vendorPayments.forEach(vp => {
      if (vp.milestoneIndex != null) paidIndices.add(vp.milestoneIndex);
    });
    nextIdx = -1;
    for (let i = 0; i < installments.length; i++) {
      if (!paidIndices.has(i)) {
        nextIdx = i;
        break;
      }
    }
  } else {
    nextIdx = billedMilestoneCount ?? 0;
  }

  if (nextIdx < 0 || nextIdx >= installments.length) return '-';
  const milestone = installments[nextIdx]?.milestone;
  return (milestone != null && milestone !== '') ? milestone : '-';
}

/**
 * Expandable row with per-milestone breakdown
 */
function UnitRow({
  unitId,
  ownerLastName,
  totalAssessed,
  billed,
  paid,
  balance,
  excluded,
  nextMilestone,
  installments,
  allocationSnapshot,
  statusChip
}) {
  const [open, setOpen] = useState(false);
  const unitAllocation = allocationSnapshot?.allocations?.[unitId] ?? 0;
  const hasInstallments = installments && installments.length > 0;

  return (
    <>
      <TableRow
        sx={{
          '& > *': { borderBottom: 'unset' },
          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
          cursor: 'pointer'
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell component="th" scope="row">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" fontWeight="medium">
              {unitId}
            </Typography>
            {open ? (
              <KeyboardArrowUpIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            ) : (
              <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{ownerLastName || '—'}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{excluded ? '-' : formatCurrency(totalAssessed)}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{excluded ? '-' : formatCurrency(billed)}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{excluded ? '-' : formatCurrency(paid)}</Typography>
        </TableCell>
        <TableCell align="right">
          <Typography variant="body2">{excluded ? '-' : formatCurrency(balance)}</Typography>
        </TableCell>
        <TableCell align="center">
          <Chip label={statusChip.label} color={statusChip.color} size="small" sx={{ minWidth: 70 }} />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{nextMilestone}</Typography>
        </TableCell>
      </TableRow>

      {!excluded && hasInstallments && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1, ml: 2, mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                      <TableCell>Milestone</TableCell>
                      <TableCell align="right">%</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {installments.map((row, i) => {
                      const totalAllocated = Object.values(allocationSnapshot?.allocations || {}).reduce((s, v) => s + v, 0) || 1;
                      const amount = row.amountCentavos != null && totalAllocated > 0
                        ? Math.round((row.amountCentavos || 0) * (unitAllocation || 0) / totalAllocated)
                        : Math.round((unitAllocation || 0) * (row.percentOfTotal || 0) / 100);
                      const statusLabel = row.status === 'billed' ? 'Billed' : 'Not Billed';
                      return (
                        <TableRow key={i}>
                          <TableCell>{row.milestone}</TableCell>
                          <TableCell align="right">{row.percentOfTotal}%</TableCell>
                          <TableCell align="right">{formatCurrency(amount)}</TableCell>
                          <TableCell>{statusLabel}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {excluded && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1, ml: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Unit excluded from this project.
                </Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {!excluded && !hasInstallments && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1, ml: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No installment schedule defined.
                </Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * UnitAssessmentsTable - Displays unit assessments from allocation engine
 *
 * @param {object} props
 * @param {object} props.allocationSnapshot - { allocations: { unitId: centavos }, inputs: { participation: { unitId: 'in'|'out' } } }
 * @param {array} props.installments - [{ milestone, percentOfTotal }]
 * @param {array} props.units - Unit objects with owner info (for owner names)
 * @param {object} props.unitCollections - Per-unit billed/paid from project bills (PM7): { unitId: { billed, paid } } in centavos
 * @param {boolean} props.noAssessmentRequired - Project funded from reserve; no unit billing
 * @param {array} props.vendorPayments - Vendor payments (for noAssessmentRequired: next milestone derived from these)
 */
function UnitAssessmentsTable({ allocationSnapshot, installments, units = [], unitCollections = {}, noAssessmentRequired = false, vendorPayments = [] }) {
  const rows = useMemo(() => {
    const allocations = allocationSnapshot?.allocations || {};
    const participation = allocationSnapshot?.inputs?.participation || {};
    const allocationUnitIds = new Set(Object.keys(allocations));
    const excludedUnitIds = Object.entries(participation)
      .filter(([, v]) => v === 'out')
      .map(([k]) => k);
    const unitIds = [...new Set([...allocationUnitIds, ...excludedUnitIds])];

    if (unitIds.length === 0) return [];

    const unitsMap = new Map((units || []).map(u => [u.unitId || u.id, u]));

    return unitIds
      .map(unitId => {
        const centavos = allocations[unitId] ?? 0;
        const isExcluded = participation[unitId] === 'out';
        const unit = unitsMap.get(unitId);
        const { lastName } = getOwnerInfo(unit || { unitId });

        // Billed/Paid from project bills (PM7)
        const coll = unitCollections[unitId] || {};
        const billed = coll.billed ?? 0;
        const paid = coll.paid ?? 0;
        // Balance = remaining due on BILLED amount (not total assessed)
        const balance = isExcluded ? 0 : Math.max(0, billed - paid);

        const statusChip = getStatusChip({
          excluded: isExcluded,
          paid,
          billed,
          totalAssessed: centavos,
          noAssessmentRequired
        });

        // billedMilestoneCount = first unbilled index (from project-level installments status)
        // For noAssessmentRequired: next milestone derived from vendor payments
        const billedMilestoneCount = (installments || []).filter(i => i.status === 'billed').length;
        const nextMilestone = getNextMilestone({
          excluded: isExcluded,
          paid,
          totalAssessed: centavos,
          installments,
          billedMilestoneCount,
          noAssessmentRequired,
          vendorPayments
        });

        return {
          unitId,
          ownerLastName: lastName || '—',
          totalAssessed: centavos,
          billed,
          paid,
          balance,
          excluded: isExcluded,
          nextMilestone,
          statusChip
        };
      })
      .sort((a, b) => (a.unitId || '').localeCompare(b.unitId || '', undefined, { numeric: true }));
  }, [allocationSnapshot, installments, units, unitCollections, noAssessmentRequired, vendorPayments]);

  const totals = useMemo(() => {
    const participating = rows.filter(r => !r.excluded);
    return {
      totalAssessed: participating.reduce((s, r) => s + r.totalAssessed, 0),
      billed: participating.reduce((s, r) => s + r.billed, 0),
      paid: participating.reduce((s, r) => s + r.paid, 0),
      balance: participating.reduce((s, r) => s + r.balance, 0),
      participatingCount: participating.length,
      totalCount: rows.length
    };
  }, [rows]);

  if (!allocationSnapshot || !allocationSnapshot.allocations || Object.keys(allocationSnapshot.allocations).length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No allocations — select and approve a bid to generate unit assessments.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.100' }}>
            <TableCell>Unit</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell align="right">Total Assessed</TableCell>
            <TableCell align="right">Billed</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell align="right">Due</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell>Next Milestone</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(row => (
            <UnitRow
              key={row.unitId}
              {...row}
              installments={installments}
              allocationSnapshot={allocationSnapshot}
            />
          ))}

          <TableRow sx={{ backgroundColor: 'grey.50' }}>
            <TableCell>
              <Typography variant="body2" fontWeight="bold">
                Total
              </Typography>
            </TableCell>
            <TableCell />
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totals.totalAssessed)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totals.billed)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold" color="success.main">
                {formatCurrency(totals.paid)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totals.balance)}
              </Typography>
            </TableCell>
            <TableCell align="center">
              <Typography variant="caption" color="text.secondary">
                {totals.participatingCount} / {totals.totalCount} units
              </Typography>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default UnitAssessmentsTable;
