import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Box, Typography, Grid } from '@mui/material';
import { ErrorOutline as ErrorIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { LoadingSpinner } from '../common';
import { useErrorMonitor } from '../../hooks/useErrorMonitor';
import { useStatusBar } from '../../context/StatusBarContext';
import ErrorDetailModal from './ErrorDetailModal';

/**
 * ErrorMonitorSection: conditionally renders Grid item only when card should show.
 * When no errors: no card, no grid slot — status in StatusBar. Modal available via StatusBar click.
 * When errors/loading/fetchError: Grid item + Card + Modal.
 */
export function ErrorMonitorSection() {
  const monitor = useErrorMonitor();
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = useCallback(() => setModalOpen(true), []);
  const { setErrorMonitorStatus, clearErrorMonitorStatus } = useStatusBar();

  useEffect(() => {
    if (monitor.loading) {
      setErrorMonitorStatus({ count: 0, loading: true });
      return clearErrorMonitorStatus;
    }
    if (monitor.fetchError) {
      setErrorMonitorStatus({ count: 0, loading: false, error: monitor.fetchError, openModal });
      return clearErrorMonitorStatus;
    }
    setErrorMonitorStatus({ count: monitor.count, loading: false, openModal });
    return clearErrorMonitorStatus;
  }, [monitor.loading, monitor.fetchError, monitor.count, openModal, setErrorMonitorStatus, clearErrorMonitorStatus]);

  const content = (
    <ErrorMonitorCardInner
      {...monitor}
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
    />
  );

  if (!monitor.showCard) {
    return content;
  }
  return (
    <Grid item xs={12} sm={6} md={4}>
      {content}
    </Grid>
  );
}

function ErrorMonitorCardInner({
  errors,
  count,
  loading,
  fetchError,
  hasErrors,
  showCard,
  acknowledgeError,
  acknowledgeAll,
  modalOpen,
  setModalOpen,
}) {
  const modal = (
    <ErrorDetailModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      errors={errors}
      count={count}
      loading={loading}
      onAcknowledge={acknowledgeError}
      onAcknowledgeAll={acknowledgeAll}
    />
  );

  if (!showCard) {
    return modal;
  }

  return (
    <>
      <Card
        onClick={() => setModalOpen(true)}
        sx={{
          height: '100%',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          },
          backgroundColor: fetchError
            ? 'rgba(120, 120, 120, 0.95)'
            : hasErrors
              ? '#d32f2f'
              : 'rgba(46, 125, 50, 0.95)',
          color: 'white',
          backdropFilter: 'blur(10px)',
        }}
      >
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            {hasErrors ? (
              <ErrorIcon sx={{ mr: 1, fontSize: 28 }} />
            ) : (
              <CheckIcon sx={{ mr: 1, fontSize: 28 }} />
            )}
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              System Error Monitor
            </Typography>
          </Box>
          {loading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <LoadingSpinner size="small" />
            </Box>
          ) : fetchError ? (
            <>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                Unable to check
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                {fetchError}
              </Typography>
            </>
          ) : hasErrors ? (
            <>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {count} System Error{count !== 1 ? 's' : ''} Detected
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.95 }}>
                Click to view details
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                All Clear
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.95 }}>
                No system errors
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
      {modal}
    </>
  );
}

export default ErrorMonitorSection;
