import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Avatar,
  Grid,
  Chip,
  TextField,
} from '@mui/material';
import {
  Water as WaterIcon,
  Construction as ConstructionIcon,
  ArrowBack as BackIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const WaterMeterEntry = () => {
  const navigate = useNavigate();
  const [readings, setReadings] = useState({});

  // Sample AVII water meter data - in production this would come from Firebase
  const aviiWaterMeters = [
    {
      unitId: "101",
      meterId: "WM-101",
      location: "Unit 101 Patio",
      lastReading: 1767,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "103", 
      meterId: "WM-103",
      location: "Unit 103 Patio", 
      lastReading: 1543,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "105",
      meterId: "WM-105", 
      location: "Unit 105 Patio",
      lastReading: 1892,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "107",
      meterId: "WM-107",
      location: "Unit 107 Patio",
      lastReading: 1654,
      lastReadingDate: "2025-01-01", 
      currentReading: null
    },
    {
      unitId: "201",
      meterId: "WM-201",
      location: "Unit 201 Patio",
      lastReading: 2134,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "203",
      meterId: "WM-203",
      location: "Unit 203 Patio",
      lastReading: 1987,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "205",
      meterId: "WM-205",
      location: "Unit 205 Patio",
      lastReading: 1765,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "207",
      meterId: "WM-207",
      location: "Unit 207 Patio",
      lastReading: 1823,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "301",
      meterId: "WM-301",
      location: "Unit 301 Patio",
      lastReading: 1456,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "303",
      meterId: "WM-303",
      location: "Unit 303 Patio",
      lastReading: 1678,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "305",
      meterId: "WM-305",
      location: "Unit 305 Patio",
      lastReading: 1534,
      lastReadingDate: "2025-01-01",
      currentReading: null
    },
    {
      unitId: "307",
      meterId: "WM-307",
      location: "Unit 307 Patio",
      lastReading: 1789,
      lastReadingDate: "2025-01-01",
      currentReading: null
    }
  ];

  const handleReadingChange = (meterId, value) => {
    setReadings(prev => ({
      ...prev,
      [meterId]: value
    }));
  };

  const calculateConsumption = (currentReading, lastReading) => {
    if (!currentReading || currentReading <= lastReading) return 0;
    return currentReading - lastReading;
  };

  const getReadingStatus = (meterId, meter) => {
    const current = readings[meterId];
    if (!current) return 'pending';
    if (current <= meter.lastReading) return 'error';
    const consumption = calculateConsumption(current, meter.lastReading);
    if (consumption > 100) return 'warning'; // High consumption warning
    return 'valid';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return '#059669';
      case 'warning': return '#d97706';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const completedReadings = Object.keys(readings).filter(meterId => 
    readings[meterId] && getReadingStatus(meterId, aviiWaterMeters.find(m => m.meterId === meterId)) === 'valid'
  ).length;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Box sx={{ p: 2, pb: 10 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/tareas')}
            sx={{ mr: 2, textTransform: 'none' }}
          >
            Volver
          </Button>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1f2937' }}>
              Lectura de Medidores
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Apartamentos Villa Isabel II (AVII)
            </Typography>
          </Box>
        </Box>

        {/* Progress Alert */}
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          icon={<WaterIcon />}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Progreso: {completedReadings} de {aviiWaterMeters.length} medidores completados
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Registra la lectura actual de cada medidor de agua
          </Typography>
        </Alert>

        {/* Under Construction Alert */}
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<ConstructionIcon />}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            🚧 Componente en Desarrollo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Esta pantalla será implementada en la siguiente fase del proyecto
          </Typography>
        </Alert>

        {/* Water Meters Grid */}
        <Grid container spacing={2} sx={{ maxWidth: '400px', margin: '0 auto' }}>
          {aviiWaterMeters.map((meter) => {
            const status = getReadingStatus(meter.meterId, meter);
            const currentReading = readings[meter.meterId] || '';
            const consumption = calculateConsumption(currentReading, meter.lastReading);
            
            return (
              <Grid item xs={12} key={meter.meterId}>
                <Card
                  sx={{
                    border: `2px solid ${status !== 'pending' ? getStatusColor(status) + '40' : 'transparent'}`,
                    bgcolor: status !== 'pending' ? getStatusColor(status) + '05' : 'white'
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: '#0ea5e920',
                          mr: 2,
                          width: 40,
                          height: 40,
                        }}
                      >
                        <HomeIcon sx={{ color: '#0ea5e9', fontSize: 24 }} />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', fontSize: '1rem' }}>
                          Unidad {meter.unitId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meter.meterId} • {meter.location}
                        </Typography>
                      </Box>
                      {status !== 'pending' && (
                        <Chip
                          label={status === 'valid' ? 'Válida' : status === 'warning' ? 'Advertencia' : 'Error'}
                          size="small"
                          sx={{
                            bgcolor: `${getStatusColor(status)}20`,
                            color: getStatusColor(status),
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        />
                      )}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Última lectura:</strong> {meter.lastReading.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        <strong>Fecha:</strong> {meter.lastReadingDate}
                      </Typography>

                      <TextField
                        fullWidth
                        size="small"
                        label="Lectura Actual"
                        value={currentReading}
                        onChange={(e) => handleReadingChange(meter.meterId, e.target.value)}
                        type="number"
                        placeholder={`Mayor a ${meter.lastReading}`}
                        sx={{
                          '& .MuiInputBase-root': {
                            fontSize: '16px' // Prevent zoom on iOS
                          }
                        }}
                        disabled // Disabled for demo
                        helperText={consumption > 0 ? `Consumo: ${consumption} unidades` : ''}
                        error={status === 'error'}
                      />
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        opacity: 0.7
                      }}
                      disabled
                    >
                      📷 Tomar Foto del Medidor
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Submit Button */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            disabled
            sx={{
              bgcolor: '#0ea5e9',
              '&:hover': {
                bgcolor: '#0ea5e9',
                opacity: 0.9
              },
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              opacity: 0.7
            }}
          >
            Enviar Todas las Lecturas ({completedReadings}/{aviiWaterMeters.length})
          </Button>
        </Box>

        {/* Development Info */}
        <Box sx={{ mt: 4, textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#6b7280' }}>
            Próximas Funcionalidades
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Formularios funcionales de entrada de datos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Validación de lecturas en tiempo real
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Captura de fotos por medidor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Envío por lotes a Firebase MCP
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default WaterMeterEntry;