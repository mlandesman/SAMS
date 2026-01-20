import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';

// Sandyland Properties logo from Firebase Storage - using same URL as Sidebar
// TODO: Update to use transparent logo from sams-sandyland-prod bucket once file permissions are configured
const SANDYLAND_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-white-background.png?alt=media&token=1cab6b71-9325-408a-bd55-e00057c69bd5";

const AboutModal = ({ open, onClose, versionInfo }) => {
  const environmentColors = {
    development: '#ff9800',
    staging: '#2196f3', 
    production: '#4caf50'
  };


  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      {/* Header with Close Button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        borderBottom: '1px solid #e0e0e0'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          About {versionInfo.shortName}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {/* Main Content */}
        <Box sx={{ p: 4 }}>
          {/* App Header Section */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {/* App Logo */}
            <Box
              component="img"
              src={SANDYLAND_LOGO_URL}
              alt="Sandyland Properties Logo"
              sx={{ 
                maxWidth: 300,
                maxHeight: 80,
                width: 'auto',
                height: 'auto',
                mx: 'auto', 
                mb: 2,
                display: 'block',
                objectFit: 'contain'
              }}
            />
            
            {/* App Name */}
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
              {versionInfo.appName}
            </Typography>
            
            {/* App Description */}
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
              {versionInfo.description}
            </Typography>
            
            {/* Version & Environment Badge */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Chip 
                label={versionInfo.versionDisplay}
                variant="outlined"
                sx={{ 
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}
              />
              <Chip 
                label={`${versionInfo.environmentConfig.icon} ${versionInfo.displayEnvironment}`}
                sx={{ 
                  bgcolor: environmentColors[versionInfo.environment],
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Information Grid */}
          <Grid container spacing={3}>
            {/* Build Information */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ComputerIcon color="primary" />
                    Build Information
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Version:</strong> {versionInfo.version}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Build Date:</strong> {versionInfo.buildTimeFormatted}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Environment:</strong> {versionInfo.displayEnvironment}
                    </Typography>
                    {versionInfo.git?.hash && versionInfo.git.hash !== 'unknown' && (
                      <>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Git Commit:</strong> <code>{versionInfo.git.hash}</code>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Git Branch:</strong> {versionInfo.git.branch}
                        </Typography>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Company Information */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Company Information
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Company:</strong> {versionInfo?.companyName || 'Sandyland Properties'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Copyright:</strong> © {versionInfo?.copyright || '2026'} {versionInfo?.companyName || 'Sandyland Properties'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Developers:</strong> {versionInfo?.developers && Array.isArray(versionInfo.developers) ? versionInfo.developers.join(' & ') : 'Michael Landesman'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Type:</strong> Property Management System
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      {/* Footer Actions */}
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          sx={{ 
            px: 4,
            borderRadius: 2
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AboutModal;