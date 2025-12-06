/**
 * CompactCard - Compact dashboard card for PWA
 * Designed for 2-column grid layout with tap-to-expand
 */
import React from 'react';
import { Box, Typography, Card, CardContent, CircularProgress } from '@mui/material';

const CompactCard = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  color = '#0863bf',
  loading = false,
  onClick,
  badge,
  progress,
  secondaryValue,
  secondaryLabel,
  fullWidth = false,
  children
}) => {
  return (
    <Card 
      onClick={onClick}
      sx={{ 
        height: '100%',
        minHeight: fullWidth ? 'auto' : 130,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'visible',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        } : {},
        '&:active': onClick ? {
          transform: 'scale(0.98)',
        } : {},
      }}
    >
      {/* Badge (optional) */}
      {badge && (
        <Box
          sx={{
            position: 'absolute',
            top: -6,
            right: -6,
            backgroundColor: badge.color || '#dc2626',
            color: 'white',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            zIndex: 1,
          }}
        >
          {badge.text}
        </Box>
      )}
      
      <CardContent sx={{ p: fullWidth ? 2 : 1.5, pb: fullWidth ? '16px !important' : '12px !important' }}>
        {/* Icon and Title Row */}
        <Box display="flex" alignItems="center" mb={1}>
          {Icon && (
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '10px',
                backgroundColor: `${color}15`,
                mr: 1,
              }}
            >
              <Icon sx={{ color, fontSize: 18 }} />
            </Box>
          )}
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 600, 
              color: '#374151',
              fontSize: '0.8rem',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
        </Box>
        
        {/* Content */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={1}>
            <CircularProgress size={24} sx={{ color }} />
          </Box>
        ) : (
          <>
            {/* Main Value with optional progress ring */}
            <Box display="flex" alignItems="center" mb={0.5}>
              {progress !== undefined ? (
                <Box position="relative" display="inline-flex" mr={1}>
                  <CircularProgress
                    variant="determinate"
                    value={progress}
                    size={40}
                    thickness={4}
                    sx={{ color }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem' }}>
                      {Math.round(progress)}%
                    </Typography>
                  </Box>
                </Box>
              ) : null}
              <Typography 
                variant="h5" 
                sx={{ 
                  color, 
                  fontWeight: 700,
                  fontSize: fullWidth ? '1.5rem' : '1.25rem',
                  lineHeight: 1,
                }}
              >
                {value}
              </Typography>
            </Box>
            
            {/* Subtitle */}
            {subtitle && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#6b7280',
                  fontSize: '0.7rem',
                  display: 'block',
                }}
              >
                {subtitle}
              </Typography>
            )}
            
            {/* Secondary Value */}
            {secondaryValue && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0, 0, 0, 0.06)' }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    color: '#6b7280',
                    fontSize: '0.7rem',
                  }}
                >
                  <span>{secondaryLabel}</span>
                  <strong style={{ color: '#374151' }}>{secondaryValue}</strong>
                </Typography>
              </Box>
            )}
            
            {/* Custom children for expanded content */}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactCard;
