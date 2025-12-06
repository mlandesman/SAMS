import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Box,
  Typography,
  Chip,
  Paper
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { 
  WORKER_ROUTE_ORDER, 
  UNIT_CONFIG, 
  validateReading, 
  formatReading, 
  parseReading 
} from '../utils/waterReadingHelpers.js';

const MeterReadingTable = ({ 
  readings = {}, 
  previousReadings = {}, 
  onReadingChange, 
  disabled = false,
  onFieldFocus = null
}) => {

  const handleInputChange = (unitId, value) => {
    if (onReadingChange) {
      onReadingChange(unitId, value);
    }
  };

  const getReadingValidation = (unitId, currentReading) => {
    if (!currentReading || currentReading === '') return null;
    
    const previousReading = previousReadings[unitId];
    return validateReading(unitId, currentReading, previousReading);
  };

  const getStatusIcon = (validation) => {
    if (!validation) return null;
    
    if (!validation.valid) {
      return <ErrorIcon sx={{ color: '#dc2626', fontSize: 16, ml: 0.5 }} />;
    }
    
    if (validation.warning) {
      return <WarningIcon sx={{ color: '#d97706', fontSize: 16, ml: 0.5 }} />;
    }
    
    return <CheckIcon sx={{ color: '#059669', fontSize: 16, ml: 0.5 }} />;
  };

  const getConsumptionDisplay = (validation) => {
    if (!validation || !validation.valid) return '-';
    return `${validation.consumption || 0}`;
  };

  const getConsumptionColor = (validation) => {
    if (!validation || !validation.valid) return '#6b7280';
    if (validation.warning || validation.rollover) return '#d97706';
    if (validation.consumption > 50) return '#0ea5e9';
    return '#059669';
  };

  return (
    <TableContainer 
      component={Paper} 
      sx={{ 
        border: '1px solid #e5e7eb',
        borderRadius: 2
      }}
    >
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell 
              sx={{ 
                bgcolor: '#f9fafb', 
                fontWeight: 700, 
                fontSize: '0.875rem',
                textAlign: 'center',
                minWidth: '60px'
              }}
            >
              Depto
            </TableCell>
            <TableCell 
              sx={{ 
                bgcolor: '#f9fafb', 
                fontWeight: 700, 
                fontSize: '0.875rem',
                textAlign: 'center',
                minWidth: '70px'
              }}
            >
              Previa
            </TableCell>
            <TableCell 
              sx={{ 
                bgcolor: '#f9fafb', 
                fontWeight: 700, 
                fontSize: '0.875rem',
                textAlign: 'center',
                minWidth: '110px'
              }}
            >
              Actual
            </TableCell>
            <TableCell 
              sx={{ 
                bgcolor: '#f9fafb', 
                fontWeight: 700, 
                fontSize: '0.875rem',
                textAlign: 'center',
                minWidth: '60px'
              }}
            >
              Uso
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {WORKER_ROUTE_ORDER.map((unitId) => {
            const unitConfig = UNIT_CONFIG[unitId];
            const currentReading = readings[unitId] || '';
            const previousReading = previousReadings[unitId];
            const validation = getReadingValidation(unitId, currentReading);
            
            return (
              <TableRow 
                key={unitId}
                sx={{ 
                  '&:nth-of-type(odd)': { 
                    bgcolor: '#f9fafb' 
                  },
                  '&:hover': {
                    bgcolor: '#f3f4f6'
                  }
                }}
              >
                {/* Unit/Department Column */}
                <TableCell sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: unitConfig.type === 'unit' ? '#0ea5e9' : '#6b7280'
                    }}
                  >
                    {unitConfig.label}
                  </Typography>
                </TableCell>

                {/* Previous Reading Column */}
                <TableCell sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: previousReading ? '#374151' : '#9ca3af',
                      fontWeight: 500
                    }}
                  >
                    {formatReading(previousReading) || '-----'}
                  </Typography>
                </TableCell>

                {/* Current Reading Input Column */}
                <TableCell sx={{ textAlign: 'center', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TextField
                      value={currentReading}
                      onChange={(e) => handleInputChange(unitId, e.target.value)}
                      onFocus={() => onFieldFocus && onFieldFocus(unitId, currentReading)}
                      disabled={disabled}
                      size="small"
                      placeholder="-----"
                      inputMode="numeric"
                      inputProps={{
                        readOnly: !!onFieldFocus, // Read-only when using keypad
                        maxLength: 5,
                        style: { 
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          minHeight: '24px'
                        }
                      }}
                      sx={{
                        width: '85px',
                        '& .MuiInputBase-root': {
                          minHeight: '48px', // Touch-friendly size
                          bgcolor: validation && !validation.valid ? '#fef2f2' : 'white',
                          border: validation && !validation.valid ? '1px solid #dc2626' : 'none'
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '16px' // Prevent iOS zoom
                        },
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': {
                            borderColor: validation && !validation.valid ? '#dc2626' : '#0ea5e9'
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: validation && !validation.valid ? '#dc2626' : '#0ea5e9',
                            borderWidth: 2
                          }
                        }
                      }}
                    />
                    {getStatusIcon(validation)}
                  </Box>
                  
                  {/* Validation Message */}
                  {validation && (validation.error || validation.warning) && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: validation.error ? '#dc2626' : '#d97706',
                        fontSize: '0.7rem',
                        display: 'block',
                        mt: 0.5,
                        lineHeight: 1.2
                      }}
                    >
                      {validation.error || validation.warning}
                    </Typography>
                  )}
                </TableCell>

                {/* Consumption Column */}
                <TableCell sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: getConsumptionColor(validation),
                      fontWeight: 600
                    }}
                  >
                    {getConsumptionDisplay(validation)}
                  </Typography>
                  {validation && validation.consumption > 50 && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#6b7280',
                        fontSize: '0.65rem',
                        display: 'block'
                      }}
                    >
                      m³
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MeterReadingTable;