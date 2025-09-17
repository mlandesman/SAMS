import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Computer as ComputerIcon,
  Phone as PhoneIcon,
  Cloud as CloudIcon,
  Assessment as ReportIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getVersionInfo, getEnvironmentStyles } from '../utils/versionUtils';

const AboutScreen = () => {
  const navigate = useNavigate();
  const versionInfo = getVersionInfo();
  const envStyles = getEnvironmentStyles();

  const handleBack = () => {
    navigate(-1);
  };

  const featureIcons = {
    'PWA Support': PhoneIcon,
    'Multi-Client Management': BusinessIcon,
    'Financial Reporting': ReportIcon,
    'Document Storage': CloudIcon,
    'Unit Management': SecurityIcon
  };

  return (
    <Box className="mobile-content" sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(180deg, rgba(8, 99, 191, 1) 0%, rgba(131, 196, 242, 1) 72%, rgba(247, 228, 194, 1) 100%)',
      pb: 10 // Account for bottom navigation
    }}>
      {/* Header with Back Navigation */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 2,
        bgcolor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <IconButton 
          onClick={handleBack}
          sx={{ 
            mr: 2,
            bgcolor: 'rgba(255, 255, 255, 0.2)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.3)'
            }
          }}
        >
          <ArrowBackIcon sx={{ color: 'white' }} />
        </IconButton>
        <Typography variant="h6" sx={{ 
          flex: 1, 
          color: 'white',
          fontWeight: 600,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          About {versionInfo.shortName}
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 2 }}>
        {/* App Information Card */}
        <Card sx={{ 
          maxWidth: 400, 
          mx: 'auto', 
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
          position: 'relative',
          mt: -2 // Overlap with header slightly
        }}>
          {/* App Icon - Floating Above Card */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            position: 'relative',
            top: -30,
            mb: -2
          }}>
            <Avatar sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: '#1976d2',
              boxShadow: '0 8px 24px rgba(25, 118, 210, 0.3)',
              border: '4px solid white'
            }}>
              <BusinessIcon sx={{ fontSize: 40 }} />
            </Avatar>
          </Box>

          <CardContent sx={{ pt: 1, textAlign: 'center' }}>
            {/* App Name */}
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
              {versionInfo.appName}
            </Typography>
            
            {/* App Description */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {versionInfo.description}
            </Typography>
            
            {/* Version and Environment Badges */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              <Chip 
                label={versionInfo.versionDisplay}
                variant="outlined"
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
              <Chip 
                label={`${versionInfo.environmentConfig.icon} ${versionInfo.displayEnvironment}`}
                size="small"
                sx={{ 
                  bgcolor: versionInfo.environmentConfig.color,
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Build Information */}
            <Box sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2
              }}>
                <ComputerIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Build Information
              </Typography>
              
              <Box sx={{ pl: 3 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Deployed:</strong> {versionInfo.buildDateFormatted}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Environment:</strong> {versionInfo.displayEnvironment}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Platform:</strong> Progressive Web App
                </Typography>
                <Typography variant="body2">
                  <strong>Port:</strong> 5174 (Mobile PWA)
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Company Information */}
            <Box sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2
              }}>
                <BusinessIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Company Information
              </Typography>
              
              <Box sx={{ pl: 3 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Company:</strong> {versionInfo.companyName}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Copyright:</strong> © {versionInfo.copyright}
                </Typography>
                <Typography variant="body2">
                  <strong>Developers:</strong> {versionInfo.developers.join(' & ')}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Features List */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2
              }}>
                <PhoneIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Key Features
              </Typography>
              
              <List dense sx={{ pl: 1 }}>
                {versionInfo.features.map((feature, index) => {
                  const IconComponent = featureIcons[feature] || SecurityIcon;
                  return (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <IconComponent sx={{ fontSize: 16, color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature}
                        primaryTypographyProps={{ 
                          variant: 'body2',
                          fontWeight: 500
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>

            {/* System Status */}
            <Box sx={{ 
              bgcolor: '#e8f5e9',
              borderRadius: 2,
              p: 2,
              border: '1px solid #c8e6c9'
            }}>
              <Typography variant="body2" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                justifyContent: 'center',
                fontWeight: 500
              }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                All systems operational
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Additional Mobile-Specific Information */}
        <Box sx={{ mt: 3, px: 1 }}>
          <Card sx={{ 
            borderRadius: '12px',
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)'
          }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Optimized for mobile devices and PWA installation
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default AboutScreen;