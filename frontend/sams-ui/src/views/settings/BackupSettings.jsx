import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert
} from '@mui/material';
import BackupIcon from '@mui/icons-material/Backup';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';

function BackupSettings() {
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const { samsUser } = useAuth();

  const getAuthHeaders = async () => {
    const { getAuthInstance } = await import('../../firebaseClient');
    const auth = getAuthInstance();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const callApi = async (url, options = {}) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${config.api.baseUrl}${url}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return response.json();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, backupsRes] = await Promise.all([
        callApi(`/admin/backup/status`),
        callApi(`/admin/backup/list?limit=10`)
      ]);
      setStatus(statusRes.status);
      setBackups(backupsRes.backups);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunBackup = async () => {
    try {
      setRunning(true);
      setError(null);
      await callApi('/admin/backup/run', { method: 'POST' });
      // Refresh after backup completes
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp._seconds 
      ? new Date(timestamp._seconds * 1000) 
      : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Backup & Recovery</Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {/* Status Card */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {status?.lastStatus === 'complete' ? (
            <CheckCircleIcon color="success" />
          ) : status?.lastStatus === 'failed' ? (
            <ErrorIcon color="error" />
          ) : null}
          <Typography>
            <strong>Status:</strong>{' '}
            {status?.lastStatus === 'complete' 
              ? 'Last backup successful' 
              : status?.lastStatus === 'failed'
              ? 'Last backup failed'
              : 'No backups yet'}
          </Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          Last Run: {formatDate(status?.lastRun)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Next Scheduled: {formatDate(status?.nextScheduled)}
        </Typography>
        
        <Button
          variant="contained"
          startIcon={running ? <CircularProgress size={16} /> : <BackupIcon />}
          onClick={handleRunBackup}
          disabled={running}
        >
          {running ? 'Running Backup...' : 'Run Backup Now'}
        </Button>
      </Paper>
      
      {/* Backup History Table */}
      <Typography variant="h6" gutterBottom>Recent Backups</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Environment</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No backups found
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>{formatDate(backup.timestamp)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={backup.environmentDisplay || backup.environment || 'Unknown'} 
                      size="small" 
                      color={
                        backup.environment === 'prod' ? 'error' :
                        backup.environment === 'staging' ? 'warning' :
                        'default'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={backup.triggeredBy} 
                      size="small" 
                      color={backup.triggeredBy === 'manual' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{formatSize(backup.sizeBytes)}</TableCell>
                  <TableCell>
                    {backup.durationMs ? `${(backup.durationMs / 1000).toFixed(1)}s` : '—'}
                  </TableCell>
                  <TableCell>
                    {backup.status === 'complete' ? (
                      <Chip label="Complete" size="small" color="success" />
                    ) : backup.status === 'running' ? (
                      <Chip label="Running" size="small" color="warning" />
                    ) : (
                      <Chip label="Failed" size="small" color="error" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Alert severity="info" sx={{ mt: 3 }}>
        ⚠️ For restore operations, use console scripts. Restore is not available in the UI for safety.
      </Alert>
      
      <Alert severity="warning" sx={{ mt: 2 }}>
        🔒 <strong>Environment Safety:</strong> Backups are tagged with their source environment (Dev/Staging/Production). 
        Always verify the environment before restoring to prevent accidental cross-environment data restoration.
      </Alert>
    </Box>
  );
}

export default BackupSettings;

