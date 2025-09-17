/**
 * Mobile App Loading Spinner Component
 * Uses SAMS logo by default for consistent branding
 */

import React from 'react';
import { Box } from '@mui/material';
import './LoadingSpinner.css';
import samsSpinnerSvg from '../../assets/sams-spinner.svg';

const LoadingSpinner = ({
  size = 'medium',
  variant = 'logo', // Default to logo for consistent branding
  message = '',
  fullScreen = false,
  show = true
}) => {
  if (!show) return null;

  const sizeMap = {
    small: 24,
    medium: 48,
    large: 72
  };

  const pixelSize = sizeMap[size] || 48;

  const spinnerStyle = {
    width: `${pixelSize}px`,
    height: `${pixelSize}px`,
    backgroundImage: variant === 'logo' ? `url(${samsSpinnerSvg})` : 'none',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    animation: variant === 'logo' ? 'sandylandSpin 3s ease-in-out infinite' : 'spin 1s linear infinite',
    border: variant === 'logo' ? 'none' : '4px solid #f3f4f6',
    borderTop: variant === 'logo' ? 'none' : '4px solid #3b82f6',
    borderRadius: '50%',
    display: 'inline-block'
  };

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexDirection: 'column'
        }}
      >
        <div style={spinnerStyle} />
        {message && (
          <Box sx={{ mt: 2, color: 'white', textAlign: 'center' }}>
            {message}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        textAlign: 'center'
      }}
    >
      <div style={spinnerStyle} />
      {message && (
        <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
          {message}
        </Box>
      )}
    </Box>
  );
};

export default LoadingSpinner;