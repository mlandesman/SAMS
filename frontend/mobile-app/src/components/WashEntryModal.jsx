import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  Box,
  Typography,
  Divider,
  Alert
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  DirectionsBoat as BoatIcon,
  LocalCarWash as WashIcon
} from '@mui/icons-material';
import { 
  WORKER_ROUTE_ORDER, 
  UNIT_CONFIG, 
  WASH_PRICES, 
  WASH_LABELS,
  formatWashDate 
} from '../utils/waterReadingHelpers.js';

const WashEntryModal = ({ 
  open, 
  onClose, 
  onSave, 
  loading = false 
}) => {
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatWashDate());
  const [washType, setWashType] = useState('car');
  const [error, setError] = useState('');

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedUnit('');
      setSelectedDate(formatWashDate());
      setWashType('car');
      setError('');
    }
  }, [open]);

  // Get available units (only residential units, not building/common)
  const availableUnits = WORKER_ROUTE_ORDER.filter(unitId => 
    UNIT_CONFIG[unitId].type === 'unit'
  );

  const handleSave = async () => {
    // Validation
    if (!selectedUnit) {
      setError('Selecciona un departamento');
      return;
    }
    
    if (!selectedDate) {
      setError('Selecciona una fecha');
      return;
    }

    if (!washType) {
      setError('Selecciona el tipo de lavado');
      return;
    }

    try {
      setError('');
      
      const washEntry = {
        type: washType,
        date: selectedDate,
        timestamp: new Date().toISOString(),
        cost: WASH_PRICES[washType]
      };

      await onSave(selectedUnit, washEntry);
      onClose();
      
    } catch (err) {
      console.error('Error saving wash:', err);
      setError(err.message || 'Error guardando el lavado');
    }
  };

  const handleCancel = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          mx: 2 // Mobile margin
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        bgcolor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <WashIcon sx={{ color: '#0ea5e9' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Agregar Lavado
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Unit Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Departamento</InputLabel>
          <Select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            label="Departamento"
            disabled={loading}
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '48px' // Touch-friendly
              }
            }}
          >
            {availableUnits.map(unitId => (
              <MenuItem key={unitId} value={unitId}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    Depto {UNIT_CONFIG[unitId].label}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Date Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel shrink>Fecha</InputLabel>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px', // Prevent iOS zoom
              fontFamily: 'inherit',
              backgroundColor: loading ? '#f3f4f6' : 'white'
            }}
          />
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Wash Type Selection */}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Tipo de Lavado:
        </Typography>
        
        <RadioGroup
          value={washType}
          onChange={(e) => setWashType(e.target.value)}
          sx={{ gap: 1 }}
        >
          {/* Car Wash Option */}
          <FormControlLabel
            value="car"
            control={<Radio disabled={loading} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <CarIcon sx={{ color: '#0ea5e9', fontSize: 24 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {WASH_LABELS.car}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${WASH_PRICES.car} pesos
                  </Typography>
                </Box>
              </Box>
            }
            sx={{
              m: 0,
              p: 1.5,
              border: '2px solid',
              borderColor: washType === 'car' ? '#0ea5e9' : '#e5e7eb',
              borderRadius: 2,
              bgcolor: washType === 'car' ? '#f0f9ff' : 'transparent',
              '&:hover': {
                bgcolor: '#f0f9ff',
                borderColor: '#0ea5e9'
              }
            }}
          />

          {/* Boat Wash Option */}
          <FormControlLabel
            value="boat"
            control={<Radio disabled={loading} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <BoatIcon sx={{ color: '#7c3aed', fontSize: 24 }} />
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {WASH_LABELS.boat}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${WASH_PRICES.boat} pesos
                  </Typography>
                </Box>
              </Box>
            }
            sx={{
              m: 0,
              p: 1.5,
              border: '2px solid',
              borderColor: washType === 'boat' ? '#7c3aed' : '#e5e7eb',
              borderRadius: 2,
              bgcolor: washType === 'boat' ? '#faf5ff' : 'transparent',
              '&:hover': {
                bgcolor: '#faf5ff',
                borderColor: '#7c3aed'
              }
            }}
          />
        </RadioGroup>

        {/* Cost Summary */}
        {selectedUnit && washType && (
          <Box sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: '#f0f9ff', 
            borderRadius: 2,
            border: '1px solid #0ea5e920'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Resumen:
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              Depto {UNIT_CONFIG[selectedUnit]?.label} - {WASH_LABELS[washType]} - ${WASH_PRICES[washType]}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fecha: {new Date(selectedDate).toLocaleDateString('es-MX')}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button 
          onClick={handleCancel} 
          disabled={loading}
          sx={{ 
            textTransform: 'none',
            fontWeight: 600,
            minWidth: '100px',
            minHeight: '48px'
          }}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={loading || !selectedUnit || !washType}
          sx={{ 
            textTransform: 'none',
            fontWeight: 600,
            minWidth: '100px',
            minHeight: '48px',
            bgcolor: '#0ea5e9',
            '&:hover': {
              bgcolor: '#0284c7'
            }
          }}
        >
          {loading ? 'Guardando...' : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WashEntryModal;