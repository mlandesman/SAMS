import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton
} from '@mui/material';
import {
  Download,
  Delete,
  Visibility,
  Close,
  PictureAsPdf,
  Image,
  Description,
  CalendarToday,
  Person,
  LocalOffer
} from '@mui/icons-material';
import { clientAPI } from '../../services/api';

const DocumentViewer = ({
  clientId,
  documentId,
  document = null, // If document data is already available
  showDownload = true,
  showDelete = false,
  showPreview = true,
  onDelete = () => {},
  onError = () => {},
  compact = false
}) => {
  const [documentData, setDocumentData] = useState(document);
  const [loading, setLoading] = useState(!document);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!document && documentId && clientId) {
      loadDocument();
    }
  }, [documentId, clientId, document]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await clientAPI.getDocument(clientId, documentId);
      setDocumentData(data);
    } catch (err) {
      console.error('Failed to load document:', err);
      setError(err.message);
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (documentData?.downloadURL) {
      // Create a temporary link element to trigger download
      const link = document.createElement('a');
      link.href = documentData.downloadURL;
      link.download = documentData.originalName || documentData.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await clientAPI.deleteDocument(clientId, documentId);
      setDeleteConfirmOpen(false);
      onDelete(documentId);
    } catch (err) {
      console.error('Failed to delete document:', err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') {
      return <PictureAsPdf color="error" fontSize={compact ? 'small' : 'medium'} />;
    } else if (mimeType?.startsWith('image/')) {
      return <Image color="primary" fontSize={compact ? 'small' : 'medium'} />;
    } else {
      return <Description color="action" fontSize={compact ? 'small' : 'medium'} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    let date;
    if (timestamp.toDate) {
      // Firestore timestamp
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card sx={{ maxWidth: compact ? '100%' : 400 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton variant="text" sx={{ fontSize: '1rem' }} />
              <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} width="60%" />
            </Box>
          </Box>
          <Skeleton variant="rectangular" height={60} />
        </CardContent>
      </Card>
    );
  }

  if (error || !documentData) {
    return (
      <Alert severity="error" sx={{ maxWidth: compact ? '100%' : 400 }}>
        {error || 'Document not found'}
      </Alert>
    );
  }

  const CompactView = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ mr: 2 }}>
        {getFileIcon(documentData.mimeType)}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {documentData.originalName || documentData.filename}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(documentData.fileSize)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {showPreview && (
          <IconButton size="small" onClick={() => setPreviewOpen(true)}>
            <Visibility fontSize="small" />
          </IconButton>
        )}
        {showDownload && (
          <IconButton size="small" onClick={handleDownload}>
            <Download fontSize="small" />
          </IconButton>
        )}
        {showDelete && (
          <IconButton size="small" onClick={() => setDeleteConfirmOpen(true)} color="error">
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );

  if (compact) {
    return (
      <>
        <CompactView />
        {/* Preview Dialog */}
        <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Document Preview
            <IconButton
              onClick={() => setPreviewOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {documentData.mimeType === 'application/pdf' ? (
              <embed
                src={documentData.downloadURL}
                type="application/pdf"
                width="100%"
                height="600px"
              />
            ) : documentData.mimeType?.startsWith('image/') ? (
              <img
                src={documentData.downloadURL}
                alt={documentData.originalName}
                style={{ width: '100%', height: 'auto' }}
              />
            ) : (
              <Alert severity="info">
                Preview not available for this file type. Click download to view the file.
              </Alert>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{documentData.originalName || documentData.filename}"?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" disabled={deleting}>
              {deleting ? <CircularProgress size={20} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card sx={{ maxWidth: 400 }}>
        <CardContent>
          {/* File Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{ mr: 2 }}>
              {getFileIcon(documentData.mimeType)}
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" noWrap>
                {documentData.originalName || documentData.filename}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(documentData.fileSize)} • {documentData.mimeType}
              </Typography>
            </Box>
          </Box>

          {/* Document Type and Category */}
          <Box sx={{ mb: 2 }}>
            <Chip
              label={documentData.documentType || 'Document'}
              size="small"
              variant="outlined"
              sx={{ mr: 1 }}
            />
            {documentData.category && (
              <Chip
                label={documentData.category}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          {/* Metadata */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarToday fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatDate(documentData.uploadedAt)}
              </Typography>
            </Box>
            
            {documentData.uploadedBy && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {documentData.uploadedBy}
                </Typography>
              </Box>
            )}

            {documentData.tags && documentData.tags.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                <LocalOffer fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                {documentData.tags.map((tag, index) => (
                  <Chip key={index} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            )}
          </Box>

          {/* Notes */}
          {documentData.notes && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {documentData.notes}
              </Typography>
            </Box>
          )}

          {/* Linked Information */}
          {documentData.linkedTo && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Linked to {documentData.linkedTo.type}: {documentData.linkedTo.description || documentData.linkedTo.id}
              </Typography>
            </Box>
          )}
        </CardContent>

        <CardActions>
          {showPreview && (
            <Button size="small" onClick={() => setPreviewOpen(true)} startIcon={<Visibility />}>
              Preview
            </Button>
          )}
          {showDownload && (
            <Button size="small" onClick={handleDownload} startIcon={<Download />}>
              Download
            </Button>
          )}
          {showDelete && (
            <Button
              size="small"
              onClick={() => setDeleteConfirmOpen(true)}
              startIcon={<Delete />}
              color="error"
            >
              Delete
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {documentData.originalName || documentData.filename}
          <IconButton
            onClick={() => setPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {documentData.mimeType === 'application/pdf' ? (
            <embed
              src={documentData.downloadURL}
              type="application/pdf"
              width="100%"
              height="600px"
            />
          ) : documentData.mimeType?.startsWith('image/') ? (
            <img
              src={documentData.downloadURL}
              alt={documentData.originalName}
              style={{ width: '100%', height: 'auto' }}
            />
          ) : (
            <Alert severity="info">
              Preview not available for this file type. Click download to view the file.
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{documentData.originalName || documentData.filename}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DocumentViewer;
