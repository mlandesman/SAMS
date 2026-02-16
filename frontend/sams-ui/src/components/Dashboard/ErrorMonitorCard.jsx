import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Box, Typography } from '@mui/material';
import { ErrorOutline as ErrorIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { LoadingSpinner } from '../common';
import { getSystemErrors } from '../../api/systemErrors';
import ErrorDetailModal from './ErrorDetailModal';

const POLL_INTERVAL_MS = 60000;

function ErrorMonitorCard() {
  const [errors, setErrors] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchErrors = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await getSystemErrors(50);
      setErrors(data.errors || []);
      setCount(data.count ?? (data.errors?.length ?? 0));
    } catch (err) {
      setFetchError(err.message || 'Unable to check');
      setErrors([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  const handleAcknowledge = (errorId) => {
    setErrors((prev) => prev.filter((e) => e.id !== errorId));
    setCount((prev) => Math.max(0, prev - 1));
  };

  const handleAcknowledgeAll = () => {
    setErrors([]);
    setCount(0);
  };

  const hasErrors = count > 0;

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
      <ErrorDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        errors={errors}
        count={count}
        loading={loading}
        onAcknowledge={handleAcknowledge}
        onAcknowledgeAll={handleAcknowledgeAll}
      />
    </>
  );
}

export default ErrorMonitorCard;
