import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { clientAPI } from '../../services/api';
import DocumentViewer from '../documents/DocumentViewer';

/**
 * Fetch metadata for transaction attachment IDs and open DocumentViewer per file.
 */
export default function TransactionAttachmentsDialog({ open, onClose, clientId, documentIds }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [previewId, setPreviewId] = useState(null);

  const idsKey = documentIds?.join(',') ?? '';

  useEffect(() => {
    if (!open || !clientId || !documentIds?.length) {
      setItems([]);
      setError('');
      setPreviewId(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const results = await Promise.all(
          documentIds.map(async (id) => {
            try {
              const data = await clientAPI.getDocument(clientId, id);
              return {
                id,
                label: data.originalName || data.filename || `Document ${id}`,
                data,
              };
            } catch (e) {
              console.error('getDocument failed', id, e);
              return { id, label: `Document ${id}`, data: null, fetchError: e.message };
            }
          })
        );
        if (!cancelled) setItems(results);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load attachments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [open, clientId, idsKey]);

  const handleClose = () => {
    setPreviewId(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pr: 5 }}>
          Attachments ({documentIds?.length ?? 0})
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}
          {!loading && error && (
            <Typography color="error" variant="body2">{error}</Typography>
          )}
          {!loading && !error && (
            <List dense disablePadding>
              {items.map((row) => (
                <ListItemButton
                  key={row.id}
                  onClick={() => setPreviewId(row.id)}
                  disabled={!row.data}
                >
                  <ListItemText
                    primary={row.label}
                    secondary={row.fetchError || null}
                    primaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewId)}
        onClose={() => setPreviewId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 5 }}>
          Preview
          <IconButton
            aria-label="close"
            onClick={() => setPreviewId(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {previewId && (
            <DocumentViewer
              clientId={clientId}
              documentId={previewId}
              showDelete={false}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
