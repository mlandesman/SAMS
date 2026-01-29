import React, { useMemo } from 'react';
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
  Link,
  Tooltip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

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
 * Format date for display
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

/**
 * VendorPaymentsTable - Displays vendor payments for a project
 * 
 * @param {object} props
 * @param {array} props.payments - Array of payment objects
 * @param {function} props.onTransactionClick - Optional callback when clicking transaction link
 */
function VendorPaymentsTable({ payments, onTransactionClick }) {
  // Sort payments by date descending (most recent first)
  const sortedPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    
    return [...payments].sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA; // Descending
    });
  }, [payments]);
  
  // Calculate total paid
  const totalPaid = useMemo(() => {
    return sortedPayments.reduce((sum, p) => sum + Math.abs(p.amount || 0), 0);
  }, [sortedPayments]);
  
  if (sortedPayments.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No vendor payments recorded for this project.
        </Typography>
      </Box>
    );
  }
  
  const handleTransactionClick = (transactionId) => {
    if (onTransactionClick && transactionId) {
      onTransactionClick(transactionId);
    }
  };
  
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.100' }}>
            <TableCell>Date</TableCell>
            <TableCell>Vendor</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell align="center" width={80}>Transaction</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPayments.map((payment, idx) => (
            <TableRow 
              key={payment.transactionId || idx}
              sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
            >
              <TableCell>
                <Typography variant="body2">
                  {formatDate(payment.date)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {payment.vendor || '-'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" color="error.main">
                  {formatCurrency(payment.amount)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    maxWidth: 200, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {payment.notes || '-'}
                </Typography>
              </TableCell>
              <TableCell align="center">
                {payment.transactionId ? (
                  <Tooltip title="View transaction">
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => handleTransactionClick(payment.transactionId)}
                      sx={{ 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5
                      }}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
                    </Link>
                  </Tooltip>
                ) : (
                  <Typography variant="body2" color="text.disabled">-</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
          
          {/* Totals row */}
          <TableRow sx={{ backgroundColor: 'grey.50' }}>
            <TableCell colSpan={2}>
              <Typography variant="body2" fontWeight="bold">
                Total ({sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''})
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold" color="error.main">
                {formatCurrency(-totalPaid)}
              </Typography>
            </TableCell>
            <TableCell colSpan={2}></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default VendorPaymentsTable;
