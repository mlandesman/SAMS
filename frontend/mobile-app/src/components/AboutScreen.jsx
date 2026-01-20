import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';

// Sandyland Properties logo from Firebase Storage - using same URL as Sidebar
// TODO: Update to use transparent logo from sams-sandyland-prod bucket once file permissions are configured
const SANDYLAND_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-white-background.png?alt=media&token=1cab6b71-9325-408a-bd55-e00057c69bd5";
import { useNavigate } from 'react-router-dom';
import { getVersionInfo } from '../utils/versionUtils';

const AboutScreen = () => {
  const navigate = useNavigate();
  const versionInfo = getVersionInfo();

  const handleBack = () => {
    navigate(-1);
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
          {/* App Logo - Floating Above Card */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            position: 'relative',
            top: -30,
            mb: -2
          }}>
            <Box
              component="img"
              src={SANDYLAND_LOGO_URL}
              alt="Sandyland Properties Logo"
              sx={{ 
                maxWidth: 250,
                maxHeight: 60,
                width: 'auto',
                height: 'auto',
                bgcolor: 'transparent',
                boxShadow: '0 8px 24px rgba(25, 118, 210, 0.3)',
                border: '4px solid white',
                borderRadius: 1,
                objectFit: 'contain',
                display: 'block'
              }}
            />
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
                <Typography variant="body2">
                  <strong>Platform:</strong> Progressive Web App
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
                  <strong>Copyright:</strong> © {versionInfo.copyright || '2026'}
                </Typography>
                <Typography variant="body2">
                  <strong>Developers:</strong> {versionInfo?.developers && Array.isArray(versionInfo.developers) && versionInfo.developers.length > 0 ? versionInfo.developers.filter(d => d !== 'Claude AI').join(' & ') || 'Michael Landesman' : 'Michael Landesman'}
                </Typography>
              </Box>
            </Box>

          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default AboutScreen;