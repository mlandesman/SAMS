import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  DirectionsBoat as BoatIcon,
  LocalCarWash as WashIcon
} from '@mui/icons-material';
import { 
  UNIT_CONFIG, 
  WASH_LABELS, 
  WASH_PRICES,
  getAllWashSummary,
  getUnitWashSummary 
} from '../utils/waterReadingHelpers.js';

const WashSummaryList = ({ readingsData }) => {
  
  // Get all washes from all units, sorted by date (newest first)
  const getAllWashes = () => {
    if (!readingsData?.readings) return [];
    
    const allWashes = [];
    
    Object.entries(readingsData.readings).forEach(([unitId, unitData]) => {
      if (unitData?.washes && Array.isArray(unitData.washes)) {
        unitData.washes.forEach(wash => {
          allWashes.push({
            ...wash,
            unitId,
            unitLabel: UNIT_CONFIG[unitId]?.label || unitId
          });
        });
      }
    });
    
    // Sort by date (newest first)
    return allWashes.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const allWashes = getAllWashes();
  const totalSummary = getAllWashSummary(readingsData);

  const getWashIcon = (washType) => {
    return washType === 'car' ? (
      <CarIcon sx={{ color: '#0ea5e9' }} />
    ) : (
      <BoatIcon sx={{ color: '#7c3aed' }} />
    );
  };

  const getWashColor = (washType) => {
    return washType === 'car' ? '#0ea5e9' : '#7c3aed';
  };

  const formatWashDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (allWashes.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f9fafb' }}>
        <WashIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No hay lavados registrados
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Usa el botón "Lavados" para agregar lavados
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Summary Header */}
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', mb: 2 }}>
        Lavados Registrados
      </Typography>

      {/* Wash List */}
      <Paper sx={{ 
        border: '1px solid #e5e7eb',
        mb: 2
      }}>
        <List sx={{ p: 0 }}>
          {allWashes.map((wash, index) => (
            <React.Fragment key={`${wash.unitId}-${wash.date}-${wash.type}-${index}`}>
              <ListItem sx={{ 
                py: 1.5,
                '&:hover': {
                  bgcolor: '#f9fafb'
                }
              }}>
                <ListItemAvatar>
                  <Avatar sx={{ 
                    bgcolor: `${getWashColor(wash.type)}20`,
                    width: 36,
                    height: 36
                  }}>
                    {getWashIcon(wash.type)}
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#1f2937' }}>
                          {wash.unitLabel}
                        </Typography>
                        <Chip
                          label={WASH_LABELS[wash.type]}
                          size="small"
                          sx={{
                            bgcolor: `${getWashColor(wash.type)}20`,
                            color: getWashColor(wash.type),
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatWashDate(wash.date)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              
              {index < allWashes.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Quick Stats */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: 1, 
        mt: 2 
      }}>
        <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f0f9ff' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0ea5e9' }}>
            {totalSummary.carWashes}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Autos
          </Typography>
        </Paper>
        
        <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#faf5ff' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#7c3aed' }}>
            {totalSummary.boatWashes}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Barcos
          </Typography>
        </Paper>
        
        <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#f0fdf4' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
            {totalSummary.totalWashes}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default WashSummaryList;