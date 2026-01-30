import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import '../../styles/SandylandModalTheme.css';

/**
 * Format centavos to currency display
 */
function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  const amount = centavos / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * BidComparisonView - Side-by-side bid comparison
 */
function BidComparisonView({ isOpen, onClose, bids }) {
  // Process bids for comparison
  const comparisonData = useMemo(() => {
    if (!bids || bids.length === 0) return [];
    
    return bids.map(bid => {
      const revision = bid.revisions[bid.currentRevision - 1];
      return {
        id: bid.id,
        vendorName: bid.vendorName,
        status: bid.status,
        amount: revision?.amount || 0,
        timeline: revision?.timeline || '-',
        submittedAt: revision?.submittedAt,
        revisions: bid.currentRevision,
        inclusions: revision?.inclusions || '-',
        exclusions: revision?.exclusions || '-',
        paymentTerms: revision?.paymentTerms || '-',
        documents: revision?.documents?.length || 0
      };
    }).sort((a, b) => a.amount - b.amount); // Sort by amount ascending (lowest first)
  }, [bids]);
  
  // Find lowest amount for highlighting
  const lowestAmount = useMemo(() => {
    if (comparisonData.length === 0) return 0;
    return Math.min(...comparisonData.map(b => b.amount));
  }, [comparisonData]);
  
  if (!isOpen) return null;
  
  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div 
        className="sandyland-modal" 
        onClick={e => e.stopPropagation()} 
        style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            Compare Bids ({bids.length})
          </h2>
          <IconButton
            onClick={onClose}
            sx={{ position: 'absolute', top: 12, right: 16, color: 'white' }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </IconButton>
        </div>
        
        <div className="sandyland-modal-content" style={{ padding: 0 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: 150 }}>Criteria</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center" sx={{ fontWeight: 'bold' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {bid.status === 'selected' && (
                          <FontAwesomeIcon icon={faCheck} style={{ color: '#4caf50' }} />
                        )}
                        {bid.vendorName}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Status */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Status</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center">
                      <Chip 
                        label={bid.status} 
                        size="small"
                        color={bid.status === 'selected' ? 'success' : bid.status === 'rejected' ? 'error' : 'default'}
                      />
                    </TableCell>
                  ))}
                </TableRow>
                
                {/* Amount */}
                <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.04)' }}>
                  <TableCell sx={{ fontWeight: 'medium' }}>Amount</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell 
                      key={bid.id} 
                      align="center"
                      sx={{ 
                        fontWeight: 'bold',
                        color: bid.amount === lowestAmount ? 'success.main' : 'inherit',
                        backgroundColor: bid.amount === lowestAmount ? 'rgba(76, 175, 80, 0.08)' : 'inherit'
                      }}
                    >
                      {formatCurrency(bid.amount)}
                      {bid.amount === lowestAmount && (
                        <Typography variant="caption" color="success.main" display="block">
                          Lowest
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                
                {/* Timeline */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Timeline</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center">{bid.timeline}</TableCell>
                  ))}
                </TableRow>
                
                {/* Submitted */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Submitted</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center">{formatDate(bid.submittedAt)}</TableCell>
                  ))}
                </TableRow>
                
                {/* Revisions */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Revisions</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center">{bid.revisions}</TableCell>
                  ))}
                </TableRow>
                
                {/* Inclusions */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium', verticalAlign: 'top' }}>Inclusions</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {bid.inclusions}
                    </TableCell>
                  ))}
                </TableRow>
                
                {/* Exclusions */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium', verticalAlign: 'top' }}>Exclusions</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {bid.exclusions}
                    </TableCell>
                  ))}
                </TableRow>
                
                {/* Payment Terms */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Payment Terms</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} sx={{ fontSize: '0.85rem' }}>
                      {bid.paymentTerms}
                    </TableCell>
                  ))}
                </TableRow>
                
                {/* Documents */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'medium' }}>Documents</TableCell>
                  {comparisonData.map(bid => (
                    <TableCell key={bid.id} align="center">{bid.documents}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
        
        <div className="sandyland-modal-buttons">
          <button 
            className="sandyland-btn sandyland-btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BidComparisonView;
