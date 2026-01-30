import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  IconButton,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faPlus, 
  faCheck, 
  faUndo,
  faEdit,
  faTrash,
  faFileAlt,
  faComments,
  faHistory,
  faBalanceScale,
  faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { getBids, createBid, updateBid, deleteBid, selectBid, unselectBid } from '../../api/projects';
import BidFormModal from './BidFormModal';
import BidComparisonView from './BidComparisonView';
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Get status color for bid
 */
function getStatusColor(status) {
  switch (status) {
    case 'selected': return 'success';
    case 'rejected': return 'error';
    case 'withdrawn': return 'default';
    default: return 'primary';
  }
}

/**
 * BidsManagementModal - Full bid management interface
 */
function BidsManagementModal({ isOpen, onClose, project, onProjectUpdate }) {
  const { selectedClient } = useClient();
  
  // State
  const [bids, setBids] = useState([]);
  const [selectedBidId, setSelectedBidId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [isBidFormOpen, setIsBidFormOpen] = useState(false);
  const [editingBid, setEditingBid] = useState(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  
  // Communication state
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('note');
  
  // Load bids when modal opens
  useEffect(() => {
    if (isOpen && project && selectedClient) {
      loadBids();
    }
  }, [isOpen, project, selectedClient]);
  
  const loadBids = async () => {
    if (!selectedClient || !project) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await getBids(selectedClient.id, project.projectId);
      setBids(result.data || []);
      
      // Auto-select first bid or the selected one
      if (result.data?.length > 0) {
        const selected = result.data.find(b => b.status === 'selected');
        setSelectedBidId(selected?.id || result.data[0].id);
      }
    } catch (err) {
      console.error('Error loading bids:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Get currently selected bid
  const selectedBid = useMemo(() => {
    return bids.find(b => b.id === selectedBidId) || null;
  }, [bids, selectedBidId]);
  
  // Get current revision of selected bid
  const currentRevision = useMemo(() => {
    if (!selectedBid) return null;
    return selectedBid.revisions[selectedBid.currentRevision - 1];
  }, [selectedBid]);
  
  // Check if any bid is selected (for the project)
  const hasSelectedBid = useMemo(() => {
    return bids.some(b => b.status === 'selected');
  }, [bids]);
  
  // Handlers
  const handleAddBid = () => {
    setEditingBid(null);
    setIsBidFormOpen(true);
  };
  
  const handleEditBid = () => {
    if (selectedBid) {
      setEditingBid(selectedBid);
      setIsBidFormOpen(true);
    }
  };
  
  const handleBidFormClose = () => {
    setIsBidFormOpen(false);
    setEditingBid(null);
  };
  
  const handleBidFormSave = async (bidData) => {
    if (!selectedClient || !project) return;
    
    try {
      if (editingBid) {
        // Update existing bid
        await updateBid(selectedClient.id, project.projectId, editingBid.id, bidData);
      } else {
        // Create new bid
        await createBid(selectedClient.id, project.projectId, bidData);
      }
      
      await loadBids();
      handleBidFormClose();
    } catch (err) {
      console.error('Error saving bid:', err);
      setError(err.message);
    }
  };
  
  const handleDeleteBid = async () => {
    if (!selectedClient || !project || !selectedBid) return;
    
    if (selectedBid.status === 'selected') {
      setError('Cannot delete a selected bid. Unselect it first.');
      return;
    }
    
    if (!window.confirm(`Delete bid from ${selectedBid.vendorName}?`)) return;
    
    try {
      await deleteBid(selectedClient.id, project.projectId, selectedBid.id);
      await loadBids();
    } catch (err) {
      console.error('Error deleting bid:', err);
      setError(err.message);
    }
  };
  
  const handleSelectBid = async () => {
    if (!selectedClient || !project || !selectedBid) return;
    
    const confirmMsg = `Select bid from ${selectedBid.vendorName} for ${formatCurrency(currentRevision?.amount)}?\n\nThis will:\n• Set project vendor to ${selectedBid.vendorName}\n• Set project budget to ${formatCurrency(currentRevision?.amount)}\n• Mark other bids as rejected`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      const result = await selectBid(selectedClient.id, project.projectId, selectedBid.id);
      await loadBids();
      
      // Notify parent to refresh project
      if (onProjectUpdate) {
        onProjectUpdate(result.data);
      }
    } catch (err) {
      console.error('Error selecting bid:', err);
      setError(err.message);
    }
  };
  
  const handleUnselectBid = async () => {
    if (!selectedClient || !project) return;
    
    if (!window.confirm('Unselect the current bid? This will allow re-selection.')) return;
    
    try {
      const result = await unselectBid(selectedClient.id, project.projectId);
      await loadBids();
      
      // Notify parent to refresh project
      if (onProjectUpdate) {
        onProjectUpdate(result.data);
      }
    } catch (err) {
      console.error('Error unselecting bid:', err);
      setError(err.message);
    }
  };
  
  const handleAddCommunication = async () => {
    if (!selectedClient || !project || !selectedBid || !newMessage.trim()) return;
    
    try {
      await updateBid(selectedClient.id, project.projectId, selectedBid.id, {
        newCommunication: {
          type: messageType,
          message: newMessage.trim(),
          by: 'Admin' // TODO: Get from user context
        }
      });
      
      setNewMessage('');
      await loadBids();
    } catch (err) {
      console.error('Error adding communication:', err);
      setError(err.message);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div 
        className="sandyland-modal" 
        onClick={e => e.stopPropagation()} 
        style={{ width: '1000px', maxWidth: '95vw', height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            Bids for: {project?.name || 'Project'}
          </h2>
          <IconButton
            onClick={onClose}
            sx={{ position: 'absolute', top: 12, right: 16, color: 'white' }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </IconButton>
        </div>
        
        {/* Project info bar */}
        <Box sx={{ px: 3, py: 1.5, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: 3, alignItems: 'center' }}>
          <Typography variant="body2">
            <strong>Status:</strong> {project?.status || '-'}
          </Typography>
          {project?.bidSettings?.bidDeadline && (
            <Typography variant="body2">
              <strong>Deadline:</strong> {formatDate(project.bidSettings.bidDeadline)}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>Bids:</strong> {bids.length}
          </Typography>
          {hasSelectedBid && (
            <Chip label="Bid Selected" color="success" size="small" />
          )}
        </Box>
        
        {/* Error display */}
        {error && (
          <Box sx={{ px: 3, py: 1, backgroundColor: '#ffebee' }}>
            <Typography variant="body2" color="error">{error}</Typography>
          </Box>
        )}
        
        {/* Main content - two column layout */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel - Bid list */}
          <Box sx={{ width: 280, borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FontAwesomeIcon icon={faPlus} />}
                onClick={handleAddBid}
                fullWidth
              >
                Add Bid
              </Button>
            </Box>
            
            <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
              {bids.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No bids yet
                  </Typography>
                </Box>
              ) : (
                bids.map((bid) => {
                  const revision = bid.revisions[bid.currentRevision - 1];
                  return (
                    <React.Fragment key={bid.id}>
                      <ListItemButton
                        selected={selectedBidId === bid.id}
                        onClick={() => setSelectedBidId(bid.id)}
                        sx={{ 
                          py: 1.5,
                          backgroundColor: bid.status === 'selected' ? 'rgba(76, 175, 80, 0.08)' : undefined
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {bid.status === 'selected' && (
                                <FontAwesomeIcon icon={faCheck} style={{ color: '#4caf50', fontSize: 12 }} />
                              )}
                              <Typography variant="body2" fontWeight="medium" noWrap>
                                {bid.vendorName}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="body2" color="primary" fontWeight="medium">
                                {formatCurrency(revision?.amount)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Rev {bid.currentRevision} • {formatDate(revision?.submittedAt)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                      <Divider />
                    </React.Fragment>
                  );
                })
              )}
            </List>
            
            {bids.length > 1 && (
              <Box sx={{ p: 2, borderTop: '1px solid #eee' }}>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<FontAwesomeIcon icon={faBalanceScale} />}
                  onClick={() => setIsComparisonOpen(true)}
                  fullWidth
                >
                  Compare Bids
                </Button>
              </Box>
            )}
          </Box>
          
          {/* Right panel - Bid details */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            {!selectedBid ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body1" color="text.secondary">
                  Select a bid to view details
                </Typography>
              </Box>
            ) : (
              <Box>
                {/* Bid header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                  <Box>
                    <Typography variant="h5">{selectedBid.vendorName}</Typography>
                    <Chip 
                      label={selectedBid.status.toUpperCase()} 
                      color={getStatusColor(selectedBid.status)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {selectedBid.status === 'active' && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<FontAwesomeIcon icon={faCheck} />}
                        onClick={handleSelectBid}
                      >
                        Select
                      </Button>
                    )}
                    {selectedBid.status === 'selected' && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FontAwesomeIcon icon={faUndo} />}
                        onClick={handleUnselectBid}
                      >
                        Unselect
                      </Button>
                    )}
                    <IconButton size="small" onClick={handleEditBid} title="Edit bid">
                      <FontAwesomeIcon icon={faEdit} />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={handleDeleteBid} 
                      title="Delete bid"
                      disabled={selectedBid.status === 'selected'}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </IconButton>
                  </Box>
                </Box>
                
                {/* Current revision details */}
                {currentRevision && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Amount</Typography>
                        <Typography variant="h6" color="primary">{formatCurrency(currentRevision.amount)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Timeline</Typography>
                        <Typography variant="body1">{currentRevision.timeline || '-'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Submitted</Typography>
                        <Typography variant="body1">{formatDate(currentRevision.submittedAt)}</Typography>
                      </Box>
                    </Box>
                    
                    {currentRevision.description && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">Description</Typography>
                        <Typography variant="body2">{currentRevision.description}</Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                      {currentRevision.inclusions && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Inclusions</Typography>
                          <Typography variant="body2">{currentRevision.inclusions}</Typography>
                        </Box>
                      )}
                      {currentRevision.exclusions && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Exclusions</Typography>
                          <Typography variant="body2">{currentRevision.exclusions}</Typography>
                        </Box>
                      )}
                    </Box>
                    
                    {currentRevision.paymentTerms && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">Payment Terms</Typography>
                        <Typography variant="body2">{currentRevision.paymentTerms}</Typography>
                      </Box>
                    )}
                  </Paper>
                )}
                
                {/* Vendor contact */}
                {selectedBid.vendorContact && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact</Typography>
                    <Typography variant="body2">
                      {selectedBid.vendorContact.name && `${selectedBid.vendorContact.name} • `}
                      {selectedBid.vendorContact.phone && `${selectedBid.vendorContact.phone} • `}
                      {selectedBid.vendorContact.email}
                    </Typography>
                  </Box>
                )}
                
                {/* Revision history accordion */}
                {selectedBid.revisions.length > 1 && (
                  <Accordion sx={{ mb: 2 }}>
                    <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} />}>
                      <FontAwesomeIcon icon={faHistory} style={{ marginRight: 8 }} />
                      <Typography>Revision History ({selectedBid.revisions.length})</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {selectedBid.revisions.slice().reverse().map((rev, idx) => (
                        <Box key={rev.revisionNumber} sx={{ mb: 2, pb: 2, borderBottom: idx < selectedBid.revisions.length - 1 ? '1px solid #eee' : 'none' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2">
                              Revision {rev.revisionNumber}
                              {rev.revisionNumber === selectedBid.currentRevision && ' (Current)'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(rev.submittedAt)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="primary" fontWeight="medium">
                            {formatCurrency(rev.amount)}
                          </Typography>
                          {rev.notes && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {rev.notes}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                )}
                
                {/* Communications accordion */}
                <Accordion sx={{ mb: 2 }}>
                  <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} />}>
                    <FontAwesomeIcon icon={faComments} style={{ marginRight: 8 }} />
                    <Typography>Messages ({selectedBid.communications?.length || 0})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {/* Message list */}
                    {selectedBid.communications?.length > 0 ? (
                      <Box sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                        {selectedBid.communications.map((comm, idx) => (
                          <Box key={idx} sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #eee' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {comm.by} • {comm.type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(comm.date)}
                              </Typography>
                            </Box>
                            <Typography variant="body2">{comm.message}</Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No messages yet
                      </Typography>
                    )}
                    
                    {/* Add message form */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Add a note..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleAddCommunication}
                        disabled={!newMessage.trim()}
                      >
                        Add
                      </Button>
                    </Box>
                  </AccordionDetails>
                </Accordion>
                
                {/* Documents accordion */}
                <Accordion>
                  <AccordionSummary expandIcon={<FontAwesomeIcon icon={faChevronDown} />}>
                    <FontAwesomeIcon icon={faFileAlt} style={{ marginRight: 8 }} />
                    <Typography>Documents ({currentRevision?.documents?.length || 0})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {currentRevision?.documents?.length > 0 ? (
                      <List dense>
                        {currentRevision.documents.map((doc, idx) => (
                          <ListItemButton key={idx}>
                            <ListItemText primary={doc.name || `Document ${idx + 1}`} />
                          </ListItemButton>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No documents attached to this revision
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Document upload coming in PM4
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Footer */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        </Box>
      </div>
      
      {/* Bid Form Modal */}
      <BidFormModal
        isOpen={isBidFormOpen}
        onClose={handleBidFormClose}
        onSave={handleBidFormSave}
        bid={editingBid}
        isEdit={!!editingBid}
      />
      
      {/* Comparison View Modal */}
      {isComparisonOpen && (
        <BidComparisonView
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          bids={bids}
        />
      )}
    </div>
  );
}

export default BidsManagementModal;
