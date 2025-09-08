import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  Avatar,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  IconButton
} from '@mui/material';
import {
  Business as BusinessIcon,
  Close as CloseIcon,
  Computer as ComputerIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Phone as PhoneIcon,
  Assessment as ReportIcon
} from '@mui/icons-material';

const AboutModal = ({ open, onClose, versionInfo }) => {
  const environmentColors = {
    development: '#ff9800',
    staging: '#2196f3', 
    production: '#4caf50'
  };

  const featureIcons = {
    'PWA Support': PhoneIcon,
    'Multi-Client Management': BusinessIcon,
    'Financial Reporting': ReportIcon,
    'Document Storage': CloudIcon,
    'Unit Management': SecurityIcon
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
            {/* App Icon */}
            <Avatar sx={{ 
              width: 80, 
              height: 80, 
              mx: 'auto', 
              mb: 2, 
              bgcolor: '#1976d2',
              boxShadow: '0 8px 24px rgba(25, 118, 210, 0.3)'
            }}>
              <BusinessIcon sx={{ fontSize: 40 }} />
            </Avatar>
            
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
                      <strong>Deployed:</strong> {versionInfo.buildTimeFormatted}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Environment:</strong> {versionInfo.displayEnvironment}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Platform:</strong> Desktop Web Application
                    </Typography>
                    <Typography variant="body2">
                      <strong>Port:</strong> 5173 (Development)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Company Information */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', border: '1px solid #e0e0e0' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon color="primary" />
                    Company Information
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Company:</strong> {versionInfo?.companyName || 'Sandyland Properties'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Copyright:</strong> © {versionInfo?.copyright || '2025'} {versionInfo?.companyName || 'Sandyland Properties'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Developers:</strong> {versionInfo?.developers && Array.isArray(versionInfo.developers) ? versionInfo.developers.join(' & ') : 'Michael Landesman & Claude AI'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Type:</strong> Property Management System
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Features Section */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpeedIcon color="primary" />
              Key Features
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1.5, 
              mt: 2,
              p: 2,
              bgcolor: '#f8f9fa',
              borderRadius: 2
            }}>
              {(versionInfo?.features || ['PWA Support', 'Multi-Client Management', 'Financial Reporting', 'Document Storage', 'Unit Management']).map(feature => {
                const IconComponent = featureIcons[feature] || SecurityIcon;
                return (
                  <Chip 
                    key={feature}
                    icon={<IconComponent />}
                    label={feature}
                    variant="outlined"
                    sx={{ 
                      bgcolor: 'white',
                      '& .MuiChip-icon': {
                        color: '#1976d2'
                      }
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {/* System Status */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="success" />
              System Status
            </Typography>
            <Box sx={{ 
              mt: 2,
              p: 2,
              bgcolor: '#e8f5e9',
              borderRadius: 2,
              border: '1px solid #c8e6c9'
            }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: '#4caf50' 
                }} />
                <strong>All systems operational</strong> - Connected to backend services
              </Typography>
            </Box>
          </Box>
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