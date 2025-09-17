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
} from '@mui/material';
import {
  LocalGasStation as PropaneIcon,
  Construction as ConstructionIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PropaneReadingEntry = () => {
  const navigate = useNavigate();
  const [selectedTank, setSelectedTank] = useState(null);

  // Sample MTC propane tank data - in production this would come from Firebase
  const mtcPropaneTanks = [
    {
      tankId: "MTC-PROP-001",
      location: "Pool Area",
      capacity: "100lb",
      installDate: "2024-01-15",
      lastReading: "2025-01-10",
      lastLevel: 65,
      status: "Active"
    },
    {
      tankId: "MTC-PROP-002", 
      location: "Clubhouse Kitchen",
      capacity: "100lb",
      installDate: "2024-01-15",
      lastReading: "2025-01-10",
      lastLevel: 40,
      status: "Active"
    }
  ];

  const getStatusColor = (level) => {
    if (level >= 60) return '#059669'; // Green
    if (level >= 30) return '#d97706'; // Orange
    return '#dc2626'; // Red
  };

  const getStatusText = (level) => {
    if (level >= 60) return 'Bueno';
    if (level >= 30) return 'Medio';
    return 'Bajo';
  };

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
              Lectura de Tanques de Gas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Marine Terrace Club (MTC)
            </Typography>
          </Box>
        </Box>

        {/* Info Alert */}
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          icon={<PropaneIcon />}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Selecciona un tanque para registrar su nivel actual
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Registra el porcentaje de gas restante en cada tanque
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

        {/* Tank List */}
        <Grid container spacing={2} sx={{ maxWidth: '400px', margin: '0 auto' }}>
          {mtcPropaneTanks.map((tank) => (
            <Grid item xs={12} key={tank.tankId}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '2px solid transparent',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    borderColor: '#ff6b35',
                  }
                }}
                onClick={() => setSelectedTank(tank)}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: '#ff6b3520',
                        mr: 2,
                        width: 48,
                        height: 48,
                      }}
                    >
                      <PropaneIcon sx={{ color: '#ff6b35', fontSize: 28 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937' }}>
                        {tank.tankId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tank.location} • {tank.capacity}
                      </Typography>
                    </Box>
                    <Chip
                      label={getStatusText(tank.lastLevel)}
                      size="small"
                      sx={{
                        bgcolor: `${getStatusColor(tank.lastLevel)}20`,
                        color: getStatusColor(tank.lastLevel),
                        fontWeight: 600
                      }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Último nivel:</strong> {tank.lastLevel}%
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Última lectura:</strong> {tank.lastReading}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Estado:</strong> {tank.status}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      bgcolor: '#ff6b35',
                      '&:hover': {
                        bgcolor: '#ff6b35',
                        opacity: 0.9
                      },
                      textTransform: 'none',
                      fontWeight: 600
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`🚧 Función en desarrollo\nTanque: ${tank.tankId}\nUbicación: ${tank.location}`);
                    }}
                  >
                    Registrar Lectura
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Development Info */}
        <Box sx={{ mt: 4, textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#6b7280' }}>
            Próximas Funcionalidades
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Formulario de entrada de nivel de gas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Captura de fotos del tanque
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            • Cálculo de consumo automático
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Integración con Firebase MCP
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PropaneReadingEntry;