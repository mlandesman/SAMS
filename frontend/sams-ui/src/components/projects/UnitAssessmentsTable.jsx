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

/**
 * Format centavos to currency display (US style, no currency code)
 * @param {number} centavos - Amount in centavos
 * @returns {string} Formatted currency string
 */
function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  const amount = centavos / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Get payment status for a unit assessment
 * @param {object} assessment - Unit assessment object
 * @returns {object} Status info with label and color
 */
function getPaymentStatus(assessment) {
  if (assessment.exempt) {
    return { label: 'Exempt', color: 'default' };
  }
  
  const expected = assessment.expectedAmount || 0;
  const paid = assessment.actualPaid || 0;
  
  if (paid >= expected && expected > 0) {
    return { label: 'Paid', color: 'success' };
  } else if (paid > 0) {
    return { label: 'Partial', color: 'warning' };
  } else {
    return { label: 'Pending', color: 'error' };
  }
}

/**
 * Row component with expandable transaction details
 */
function AssessmentRow({ assessment, collections }) {
  const [open, setOpen] = useState(false);
  const status = getPaymentStatus(assessment);
  
  // Find collections for this unit
  const unitCollections = useMemo(() => {
    return (collections || []).filter(c => c.unitId === assessment.unitId);
  }, [collections, assessment.unitId]);
  
  const hasPaidAmount = (assessment.actualPaid || 0) > 0;
  const hasCollections = unitCollections.length > 0;
  
  return (
    <>
      <TableRow 
        sx={{ 
          '& > *': { borderBottom: 'unset' },
          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
        }}
      >
        <TableCell component="th" scope="row">
          <Typography variant="body2" fontWeight="medium">
            {assessment.unitId}
          </Typography>
        </TableCell>
        <TableCell align="right">
          {assessment.exempt ? (
            <Typography variant="body2" color="text.secondary">-</Typography>
          ) : (
            formatCurrency(assessment.expectedAmount)
          )}
        </TableCell>
        <TableCell 
          align="right"
          sx={{ 
            cursor: hasCollections ? 'pointer' : 'default',
            '&:hover': hasCollections ? { 
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              borderRadius: 1
            } : {}
          }}
          onClick={() => hasCollections && setOpen(!open)}
        >
          {hasPaidAmount ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              <Typography variant="body2" color="success.main">
                {formatCurrency(assessment.actualPaid)}
              </Typography>
              {hasCollections && (
                open ? 
                  <KeyboardArrowUpIcon fontSize="small" sx={{ color: 'text.secondary' }} /> :
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>
        <TableCell align="center">
          <Chip 
            label={status.label} 
            color={status.color}
            size="small"
            sx={{ minWidth: 70 }}
          />
        </TableCell>
      </TableRow>
      
      {/* Expandable transaction details */}
      {hasCollections && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1, ml: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Payment Transactions
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Transaction ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unitCollections.map((collection, idx) => (
                      <TableRow key={collection.transactionId || idx}>
                        <TableCell>{collection.date || '-'}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="success.main">
                            {formatCurrency(collection.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {collection.transactionId || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * UnitAssessmentsTable - Displays unit assessments with payment status
 * 
 * @param {object} props
 * @param {object} props.unitAssessments - Map of unitId -> assessment data
 * @param {array} props.collections - Array of collection transactions
 */
function UnitAssessmentsTable({ unitAssessments, collections }) {
  // Convert unitAssessments object to sorted array
  const assessmentsList = useMemo(() => {
    if (!unitAssessments) return [];
    
    return Object.entries(unitAssessments)
      .map(([unitId, data]) => ({
        unitId,
        ...data
      }))
      .sort((a, b) => {
        // Sort by unit ID (alphanumeric sort)
        return a.unitId.localeCompare(b.unitId, undefined, { numeric: true });
      });
  }, [unitAssessments]);
  
  if (assessmentsList.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No unit assessments defined for this project.
        </Typography>
      </Box>
    );
  }
  
  // Calculate totals
  const totals = useMemo(() => {
    return assessmentsList.reduce((acc, a) => ({
      expected: acc.expected + (a.exempt ? 0 : (a.expectedAmount || 0)),
      paid: acc.paid + (a.actualPaid || 0)
    }), { expected: 0, paid: 0 });
  }, [assessmentsList]);
  
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.100' }}>
            <TableCell>Unit</TableCell>
            <TableCell align="right">Assessment</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell align="center">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assessmentsList.map((assessment) => (
            <AssessmentRow 
              key={assessment.unitId} 
              assessment={assessment}
              collections={collections}
            />
          ))}
          
          {/* Totals row */}
          <TableRow sx={{ backgroundColor: 'grey.50' }}>
            <TableCell>
              <Typography variant="body2" fontWeight="bold">Total</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totals.expected)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold" color="success.main">
                {formatCurrency(totals.paid)}
              </Typography>
            </TableCell>
            <TableCell align="center">
              <Typography variant="caption" color="text.secondary">
                {assessmentsList.length} units
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default UnitAssessmentsTable;
