/**
 * ProjectDocumentsList - Display and manage documents for projects/bids
 * 
 * Features:
 * - Folder grouping with collapsible sections
 * - Document description/notes
 * - Upload with folder selection
 * - Inline editing of description
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilePdf, 
  faFileImage, 
  faFile, 
  faDownload, 
  faTrash,
  faPlus,
  faFolder,
  faFolderOpen,
  faChevronDown,
  faChevronRight,
  faEdit,
  faSave
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { 
  getDocuments, 
  uploadDocument, 
  deleteDocument,
  updateDocumentMetadata
} from '../../api/documents';
import DocumentUploader from '../documents/DocumentUploader';

// Default folders for projects
const DEFAULT_FOLDERS = [
  'Plans & Drawings',
  'Photos',
  'Permits & Approvals',
  'Contracts',
  'Invoices',
  'Other'
];

/**
 * Get icon for file type
 */
function getFileIcon(filename, contentType) {
  if (contentType?.includes('pdf') || filename?.endsWith('.pdf')) {
    return faFilePdf;
  }
  if (contentType?.includes('image') || /\.(jpg|jpeg|png|gif)$/i.test(filename)) {
    return faFileImage;
  }
  return faFile;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format date for display - handles Firestore Timestamps and strings
 */
function formatDate(dateValue) {
  if (!dateValue) return '-';
  
  try {
    let date;
    
    // Handle Firestore Timestamp objects
    if (dateValue._seconds !== undefined) {
      date = new Date(dateValue._seconds * 1000);
    }
    // Handle Firestore Timestamp with toDate()
    else if (typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    }
    // Handle string or number
    else {
      date = new Date(dateValue);
    }
    
    // Check for valid date
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '-';
  }
}

/**
 * ProjectDocumentsList Component
 */
function ProjectDocumentsList({ 
  linkedToType,  // 'project' or 'bid'
  linkedToId,    // The project or bid ID
  documentType = 'project_document',
  category = 'project',
  title = 'Documents',
  showUploader = true,
  compact = false,
  onDocumentChange = null  // Callback when documents change
}) {
  const { selectedClient } = useClient();
  
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUploadArea, setShowUploadArea] = useState(false);
  
  // Folder state
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedFolder, setSelectedFolder] = useState('Other');
  const [customFolders, setCustomFolders] = useState([]);
  
  // New folder dialog
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Edit state
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  
  // Pending uploads for description (supports multiple)
  const [pendingDocs, setPendingDocs] = useState([]);
  const [pendingDescriptions, setPendingDescriptions] = useState({});
  
  // Load documents
  const loadDocuments = useCallback(async () => {
    if (!selectedClient || !linkedToId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await getDocuments(selectedClient.id, {
        linkedToType,
        linkedToId
      });
      const docs = result.documents || [];
      setDocuments(docs);
      
      // Extract custom folders from documents
      const folders = new Set();
      docs.forEach(doc => {
        if (doc.folder && !DEFAULT_FOLDERS.includes(doc.folder)) {
          folders.add(doc.folder);
        }
      });
      setCustomFolders(Array.from(folders));
      
      // Keep folders collapsed by default - user can expand as needed
      // (Removed auto-expand to show content below documents section)
      
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClient, linkedToType, linkedToId]);
  
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);
  
  // Group documents by folder
  const documentsByFolder = useMemo(() => {
    const grouped = {};
    
    documents.forEach(doc => {
      const folder = doc.folder || 'Other';
      if (!grouped[folder]) {
        grouped[folder] = [];
      }
      grouped[folder].push(doc);
    });
    
    return grouped;
  }, [documents]);
  
  // All available folders
  const allFolders = useMemo(() => {
    const folders = new Set([...DEFAULT_FOLDERS, ...customFolders]);
    // Add any folders from documents that aren't in our lists
    documents.forEach(doc => {
      if (doc.folder) folders.add(doc.folder);
    });
    return Array.from(folders).sort();
  }, [customFolders, documents]);
  
  // Toggle folder expansion
  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };
  
  // Handle upload complete
  const handleUploadComplete = async (uploadedDocs) => {
    console.log('📄 Documents uploaded:', uploadedDocs);
    
    if (uploadedDocs && uploadedDocs.length > 0) {
      // Add to pending docs for description entry
      setPendingDocs(prev => [...prev, ...uploadedDocs]);
    }
  };
  
  // Finalize a single upload with metadata
  const finalizeUpload = async (doc, description) => {
    if (!doc || !selectedClient) return;
    
    try {
      // Update with folder, description, link, and proper document type
      await updateDocumentMetadata(selectedClient.id, doc.id, {
        linkedTo: {
          type: linkedToType,
          id: linkedToId
        },
        folder: selectedFolder,
        notes: description || '',
        documentType: documentType,
        category: category
      });
      
      console.log(`✅ Document linked with folder: ${selectedFolder}`);
      
      // Remove from pending
      setPendingDocs(prev => prev.filter(d => d.id !== doc.id));
      setPendingDescriptions(prev => {
        const updated = { ...prev };
        delete updated[doc.id];
        return updated;
      });
      
      // Refresh the list
      await loadDocuments();
      
      if (onDocumentChange) {
        onDocumentChange(documents);
      }
    } catch (err) {
      console.error('Error finalizing upload:', err);
      setError(err.message);
    }
  };
  
  // Finalize all pending uploads (keep upload area open)
  const finalizeAllUploads = async () => {
    for (const doc of pendingDocs) {
      await finalizeUpload(doc, pendingDescriptions[doc.id] || '');
    }
    // Don't close upload area - let user add more or click Done
  };
  
  // Skip a pending upload (still save it, just without description)
  const skipPendingDoc = async (doc) => {
    await finalizeUpload(doc, '');
  };
  
  // Handle upload error
  const handleUploadError = (err) => {
    console.error('Upload error:', err);
    setError(err.message || 'Upload failed');
  };
  
  // Handle delete document
  const handleDelete = async (documentId) => {
    if (!window.confirm('Delete this document?')) return;
    
    try {
      await deleteDocument(selectedClient.id, documentId);
      await loadDocuments();
      
      if (onDocumentChange) {
        onDocumentChange(documents.filter(d => d.id !== documentId));
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err.message);
    }
  };
  
  // Handle download
  const handleDownload = (doc) => {
    if (doc.downloadURL) {
      window.open(doc.downloadURL, '_blank');
    }
  };
  
  // Start editing description
  const startEditDescription = (doc) => {
    setEditingDocId(doc.id);
    setEditDescription(doc.notes || '');
  };
  
  // Save description
  const saveDescription = async (docId) => {
    try {
      await updateDocumentMetadata(selectedClient.id, docId, {
        notes: editDescription
      });
      setEditingDocId(null);
      await loadDocuments();
    } catch (err) {
      console.error('Error saving description:', err);
      setError(err.message);
    }
  };
  
  // Create new folder
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      setCustomFolders(prev => [...prev, newFolderName.trim()]);
      setSelectedFolder(newFolderName.trim());
      setNewFolderName('');
      setNewFolderDialogOpen(false);
    }
  };
  
  if (loading && documents.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Header with add button - always show add button when showUploader is true */}
      {!compact && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          {title && <Typography variant="subtitle2">{title}</Typography>}
          {!title && <Box />} {/* Spacer when no title */}
          {showUploader && !showUploadArea && (
            <IconButton 
              size="small" 
              onClick={() => setShowUploadArea(true)}
              title="Add document"
            >
              <FontAwesomeIcon icon={faPlus} />
            </IconButton>
          )}
        </Box>
      )}
      
      {/* Compact add button */}
      {compact && showUploader && !showUploadArea && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => setShowUploadArea(true)}
            title="Add document"
          >
            <FontAwesomeIcon icon={faPlus} />
          </IconButton>
        </Box>
      )}
      
      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* Upload area with folder selection */}
      {showUploadArea && showUploader && (
        <Box sx={{ mb: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
          <Box sx={{ mb: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Folder</InputLabel>
              <Select
                value={selectedFolder}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setNewFolderDialogOpen(true);
                  } else {
                    setSelectedFolder(e.target.value);
                  }
                }}
                label="Folder"
                MenuProps={{
                  sx: { zIndex: 9999 },
                  onClick: (e) => e.stopPropagation(),
                  onMouseDown: (e) => e.stopPropagation()
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {allFolders.map(folder => (
                  <MenuItem key={folder} value={folder}>{folder}</MenuItem>
                ))}
                <MenuItem 
                  value="__new__" 
                  sx={{ fontStyle: 'italic', color: 'primary.main' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  + New folder...
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <DocumentUploader
            clientId={selectedClient?.id}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            mode="immediate"
            multiple={true}
          />
          
          {/* Pending documents - add descriptions */}
          {pendingDocs.length > 0 && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid #4caf50', borderRadius: 1, backgroundColor: 'rgba(76, 175, 80, 0.04)' }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                ✓ {pendingDocs.length} file(s) uploaded - add descriptions:
              </Typography>
              
              {pendingDocs.map((doc) => (
                <Box key={doc.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0', '&:last-child': { borderBottom: 'none', mb: 0, pb: 0 } }}>
                  <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                    {doc.filename || 'Document'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Description (optional)"
                      value={pendingDescriptions[doc.id] || ''}
                      onChange={(e) => setPendingDescriptions(prev => ({ ...prev, [doc.id]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                    />
                    <Button 
                      size="small" 
                      onClick={() => skipPendingDoc(doc)}
                    >
                      Skip
                    </Button>
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={() => finalizeUpload(doc, pendingDescriptions[doc.id] || '')}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              ))}
              
              {pendingDocs.length > 1 && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Button 
                    size="small" 
                    variant="contained"
                    onClick={finalizeAllUploads}
                  >
                    Save All
                  </Button>
                </Box>
              )}
            </Box>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {pendingDocs.length > 0 && (
              <Button 
                size="small" 
                color="error"
                onClick={() => {
                  setPendingDocs([]);
                  setPendingDescriptions({});
                }}
              >
                Cancel Pending
              </Button>
            )}
            <Button 
              size="small" 
              variant="outlined"
              onClick={() => {
                setPendingDocs([]);
                setPendingDescriptions({});
                setShowUploadArea(false);
              }}
            >
              Done
            </Button>
          </Box>
        </Box>
      )}
      
      {/* Documents grouped by folder */}
      {documents.length === 0 ? (
        <Box sx={{ py: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No documents yet
          </Typography>
          {showUploader && !showUploadArea && (
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ cursor: 'pointer', mt: 1 }}
              onClick={() => setShowUploadArea(true)}
            >
              + Add document
            </Typography>
          )}
        </Box>
      ) : (
        <Box>
          {Object.entries(documentsByFolder).map(([folder, docs]) => (
            <Box key={folder} sx={{ mb: 1 }}>
              {/* Folder header */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                }}
                onClick={() => toggleFolder(folder)}
              >
                <FontAwesomeIcon 
                  icon={expandedFolders[folder] ? faChevronDown : faChevronRight} 
                  style={{ fontSize: 10, marginRight: 8, color: '#666' }}
                />
                <FontAwesomeIcon 
                  icon={expandedFolders[folder] ? faFolderOpen : faFolder} 
                  style={{ fontSize: 14, marginRight: 8, color: '#f9a825' }}
                />
                <Typography variant="body2" fontWeight="medium">
                  {folder}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({docs.length})
                </Typography>
              </Box>
              
              {/* Folder contents */}
              <Collapse in={expandedFolders[folder]}>
                <List dense disablePadding sx={{ pl: 3 }}>
                  {docs.map((doc) => (
                    <ListItem 
                      key={doc.id}
                      sx={{ 
                        px: 1,
                        py: 0.5,
                        borderBottom: '1px solid #f0f0f0',
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <FontAwesomeIcon 
                          icon={getFileIcon(doc.originalName, doc.mimeType)} 
                          style={{ color: '#666', fontSize: 14 }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" noWrap sx={{ maxWidth: compact ? 150 : 250 }}>
                            {doc.originalName || doc.originalFilename || doc.filename || 'Document'}
                          </Typography>
                        }
                        secondary={
                          editingDocId === doc.id ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <TextField
                                size="small"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Description..."
                                sx={{ flex: 1 }}
                                inputProps={{ style: { fontSize: 12, padding: '4px 8px' } }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveDescription(doc.id);
                                  if (e.key === 'Escape') setEditingDocId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                autoFocus
                              />
                              <IconButton 
                                size="small" 
                                onClick={(e) => { e.stopPropagation(); saveDescription(doc.id); }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <FontAwesomeIcon icon={faSave} style={{ fontSize: 10 }} />
                              </IconButton>
                            </Box>
                          ) : (
                            <Box>
                              {doc.notes && (
                                <Typography variant="caption" color="text.primary" display="block">
                                  {doc.notes}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {formatFileSize(doc.fileSize || doc.size)} • {formatDate(doc.uploadedAt)}
                                {!doc.notes && (
                                  <span 
                                    style={{ marginLeft: 8, cursor: 'pointer', color: '#1976d2' }}
                                    onClick={(e) => { e.stopPropagation(); startEditDescription(doc); }}
                                  >
                                    + Add description
                                  </span>
                                )}
                              </Typography>
                            </Box>
                          )
                        }
                      />
                      <ListItemSecondaryAction>
                        {doc.notes && editingDocId !== doc.id && (
                          <IconButton 
                            size="small" 
                            onClick={(e) => { e.stopPropagation(); startEditDescription(doc); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Edit description"
                            sx={{ mr: 0.5 }}
                          >
                            <FontAwesomeIcon icon={faEdit} style={{ fontSize: 10 }} />
                          </IconButton>
                        )}
                        <IconButton 
                          size="small" 
                          onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Download"
                          sx={{ mr: 0.5 }}
                        >
                          <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12 }} />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          ))}
        </Box>
      )}
      
      {/* New Folder Dialog */}
      <Dialog 
        open={newFolderDialogOpen} 
        onClose={() => setNewFolderDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{ zIndex: 10000 }}
      >
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={(e) => { e.stopPropagation(); setNewFolderDialogOpen(false); }}>Cancel</Button>
          <Button onClick={(e) => { e.stopPropagation(); handleCreateFolder(); }} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProjectDocumentsList;
