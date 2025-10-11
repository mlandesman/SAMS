import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  BugReport as BugIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { getVersionInfo } from '../utils/versionUtils';
import { getBackendVersion, checkVersionCompatibility } from '../utils/versionChecker';

const VersionDebugPanel = ({ open, onClose }) => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [backendInfo, setBackendInfo] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Load all version information
  const loadVersionData = async () => {
    setLoading(true);
    try {
      // Get frontend version info
      const frontendInfo = getVersionInfo();
      setVersionInfo(frontendInfo);

      // Get backend version info
      const backendData = await getBackendVersion(true); // Force refresh
      setBackendInfo(backendData);

      // Check compatibility
      const compatibilityData = await checkVersionCompatibility();
      setCompatibility(compatibilityData);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading version data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data when panel opens
  useEffect(() => {
    if (open) {
      loadVersionData();
    }
  }, [open]);

  // Copy debug info to clipboard
  const copyDebugInfo = async () => {
    const debugInfo = `SAMS Debug Panel - ${lastRefresh.toLocaleString()}
==============================================

FRONTEND INFORMATION:
Version: ${versionInfo?.version || 'N/A'} (${versionInfo?.git?.hash || 'N/A'})
Environment: ${versionInfo?.displayEnvironment || 'N/A'}
Build Date: ${versionInfo?.buildTimeFormatted || 'N/A'}
Build Number: ${versionInfo?.build?.buildNumber || 'N/A'}
Git Branch: ${versionInfo?.git?.branch || 'N/A'}
Git Full Hash: ${versionInfo?.git?.fullHash || 'N/A'}
Node Version: ${versionInfo?.build?.nodeVersion || 'N/A'}
Platform: ${versionInfo?.build?.platform || 'N/A'}
Deployment ID: ${versionInfo?.deployment?.vercelDeploymentId || 'N/A'}

BACKEND INFORMATION:
Version: ${backendInfo?.version || 'N/A'} (${backendInfo?.git?.hash || 'N/A'})
Environment: ${backendInfo?.environment || 'N/A'}
Build Date: ${backendInfo?.buildDate || 'N/A'}
Deployment ID: ${backendInfo?.deployment?.deploymentId || 'N/A'}
Deployment URL: ${backendInfo?.deployment?.url || 'N/A'}
Region: ${backendInfo?.deployment?.region || 'N/A'}

COMPATIBILITY:
Status: ${compatibility?.compatible ? 'Compatible' : 'Incompatible'}
Message: ${compatibility?.message || 'N/A'}
Version Match: ${compatibility?.details?.versionMatch ? 'Yes' : 'No'}
Git Match: ${compatibility?.details?.gitMatch ? 'Yes' : 'No'}
Environment Match: ${compatibility?.details?.environmentMatch ? 'Yes' : 'No'}
Build Time Difference: ${compatibility?.details?.buildTimeDifference ? Math.round(compatibility.details.buildTimeDifference / 60000) + ' minutes' : 'N/A'}

BROWSER INFORMATION:
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Screen Resolution: ${window.screen.width}x${window.screen.height}
Viewport: ${window.innerWidth}x${window.innerHeight}
Local Storage: ${localStorage.length} items
Session Storage: ${sessionStorage.length} items

ENVIRONMENT VARIABLES:
${Object.keys(import.meta.env)
  .filter(key => key.startsWith('VITE_'))
  .map(key => `${key}: ${import.meta.env[key]}`)
  .join('\n')}

TIMESTAMP: ${new Date().toISOString()}`;

    try {
      await navigator.clipboard.writeText(debugInfo);
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to copy debug info:', error);
    }
  };

  const getCompatibilityIcon = () => {
    if (!compatibility) return '❓';
    if (compatibility.compatible === true) return '✅';
    if (compatibility.compatible === false) return '❌';
    return '⚠️';
  };

  const getCompatibilityColor = () => {
    if (!compatibility) return 'default';
    if (compatibility.compatible === true) return 'success';
    if (compatibility.compatible === false) return 'error';
    return 'warning';
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugIcon color="primary" />
            <Typography variant="h6" component="div">
              SAMS Debug Panel
            </Typography>
            <Chip 
              label={`Updated: ${lastRefresh.toLocaleTimeString()}`}
              size="small"
              variant="outlined"
            />
          </Box>
          <Box>
            <IconButton onClick={loadVersionData} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Compatibility Status */}
          {compatibility && (
            <Alert 
              severity={getCompatibilityColor()} 
              sx={{ mb: 3 }}
              icon={getCompatibilityIcon()}
            >
              <Typography variant="h6" gutterBottom>
                Compatibility Status
              </Typography>
              <Typography variant="body2">
                {compatibility.message}
              </Typography>
              {compatibility.details && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Version: ${compatibility.details.versionMatch ? 'Match' : 'Mismatch'}`}
                    size="small"
                    color={compatibility.details.versionMatch ? 'success' : 'error'}
                  />
                  <Chip 
                    label={`Git: ${compatibility.details.gitMatch ? 'Match' : 'Mismatch'}`}
                    size="small"
                    color={compatibility.details.gitMatch ? 'success' : 'error'}
                  />
                  <Chip 
                    label={`Environment: ${compatibility.details.environmentMatch ? 'Match' : 'Mismatch'}`}
                    size="small"
                    color={compatibility.details.environmentMatch ? 'success' : 'error'}
                  />
                </Box>
              )}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Frontend Information */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ComputerIcon color="primary" />
                    Frontend (Client)
                  </Typography>
                  {versionInfo ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Version:</strong> {versionInfo.version} ({versionInfo.git?.hash})
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Environment:</strong> {versionInfo.displayEnvironment}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Build Date:</strong> {versionInfo.buildTimeFormatted}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Build Number:</strong> {versionInfo.build?.buildNumber}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Git Branch:</strong> {versionInfo.git?.branch}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Node Version:</strong> {versionInfo.build?.nodeVersion}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Platform:</strong> {versionInfo.build?.platform}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">Loading...</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Backend Information */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StorageIcon color="primary" />
                    Backend (Server)
                  </Typography>
                  {backendInfo ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Version:</strong> {backendInfo.version} ({backendInfo.git?.hash})
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Environment:</strong> {backendInfo.environment}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Build Date:</strong> {new Date(backendInfo.buildDate).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Deployment ID:</strong> {backendInfo.deployment?.deploymentId || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Deployment URL:</strong> {backendInfo.deployment?.url}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Region:</strong> {backendInfo.deployment?.region}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography color="text.secondary">Loading...</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Environment Information */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudIcon color="primary" />
                    Environment & Browser Information
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Current URL:</strong> {window.location.href}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Screen Resolution:</strong> {window.screen.width}×{window.screen.height}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Viewport:</strong> {window.innerWidth}×{window.innerHeight}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Local Storage:</strong> {localStorage.length} items
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Session Storage:</strong> {sessionStorage.length} items
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>User Agent:</strong> {navigator.userAgent.substring(0, 50)}...
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Environment Variables */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon color="primary" />
                    Build Environment Variables
                  </Typography>
                  <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                    {Object.keys(import.meta.env)
                      .filter(key => key.startsWith('VITE_'))
                      .map(key => (
                        <Typography key={key} variant="body2" sx={{ mb: 0.5, fontFamily: 'monospace' }}>
                          <strong>{key}:</strong> {import.meta.env[key]}
                        </Typography>
                      ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>

        <Box sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={copyDebugInfo}
            variant="contained"
            startIcon={<CopyIcon />}
            sx={{ mr: 2 }}
          >
            Copy All Debug Info
          </Button>
          <Button 
            onClick={loadVersionData}
            variant="outlined"
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </Box>
      </Dialog>

      {/* Snackbar for copy feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          Debug information copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );
};

export default VersionDebugPanel;
