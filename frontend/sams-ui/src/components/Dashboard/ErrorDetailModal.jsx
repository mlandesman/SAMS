import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  Box,
  Typography,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { acknowledgeError, acknowledgeAllErrors } from '../../api/systemErrors';
import { formatTimestampMexico } from '../../utils/timezone';

const MODULE_COLORS = {
  email: 'warning',
  payment: 'error',
  statement: 'info',
  auth: 'secondary',
  water: 'info',
  budget: 'warning',
  general: 'default',
};

function ErrorDetailModal({ open, onClose, errors, count, onAcknowledge, onAcknowledgeAll, loading }) {
  const [expandedId, setExpandedId] = useState(null);
  const [acknowledging, setAcknowledging] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  const handleAcknowledge = async (errorId) => {
    setAcknowledging(errorId);
    try {
      await acknowledgeError(errorId);
      onAcknowledge?.(errorId);
    } catch (err) {
      console.error('Failed to acknowledge error:', err);
    } finally {
      setAcknowledging(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    setClearingAll(true);
    try {
      await acknowledgeAllErrors();
      onAcknowledgeAll?.();
    } catch (err) {
      console.error('Failed to acknowledge all:', err);
    } finally {
      setClearingAll(false);
    }
  };

  const sortedErrors = [...(errors || [])].sort((a, b) => {
    const getMs = (ts) => {
      if (!ts) return 0;
      if (typeof ts?.toMillis === 'function') return ts.toMillis();
      const sec = ts.seconds ?? ts._seconds;
      if (sec != null) return sec * 1000;
      return 0;
    };
    return getMs(b.timestamp) - getMs(a.timestamp);
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">System Errors</Typography>
          {count != null && (
            <Chip label={count} size="small" color="error" />
          )}
        </Box>
        <Box>
          {count > 0 && (
            <Button
              size="small"
              color="primary"
              onClick={handleAcknowledgeAll}
              disabled={clearingAll}
              sx={{ mr: 1 }}
            >
              {clearingAll ? 'Clearing...' : 'Clear All'}
            </Button>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        ) : sortedErrors.length === 0 ? (
          <Box textAlign="center" py={4}>
            <CheckIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No system errors — all clear!
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {sortedErrors.map((err) => {
              const isExpanded = expandedId === err.id;
              const moduleColor = MODULE_COLORS[err.module] || 'default';
              return (
                <ListItem
                  key={err.id}
                  alignItems="flex-start"
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    py: 2,
                  }}
                >
                  <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
                    <Box flex={1} minWidth={0}>
                      <Box display="flex" flexWrap="wrap" gap={0.5} mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestampMexico(err.timestamp)}
                        </Typography>
                        <Chip
                          label={err.source === 'backend' ? 'Backend' : 'Frontend'}
                          size="small"
                          color={err.source === 'backend' ? 'info' : 'warning'}
                          sx={{ height: 20 }}
                        />
                        <Chip
                          label={err.module || 'general'}
                          size="small"
                          color={moduleColor}
                          sx={{ height: 20 }}
                        />
                      </Box>
                      <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                        {err.message || '—'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => handleAcknowledge(err.id)}
                      disabled={acknowledging === err.id}
                      title="Dismiss"
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {err.details && (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedId(isExpanded ? null : err.id)}
                        sx={{ mt: 0.5, p: 0 }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Collapse in={isExpanded}>
                        <Box
                          component="pre"
                          sx={{
                            mt: 1,
                            p: 1.5,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {err.details}
                        </Box>
                      </Collapse>
                    </>
                  )}
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ErrorDetailModal;
