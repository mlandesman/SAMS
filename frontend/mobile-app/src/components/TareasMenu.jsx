import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Avatar,
  Chip,
} from '@mui/material';
import {
  LocalGasStation as PropaneIcon,
  Water as WaterIcon,
  Assignment as TaskIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useClients } from '../hooks/useClients.jsx';
import ClientSwitcher from './ClientSwitcher.jsx';

// Client-specific task configurations - keyed by client ID
const clientTaskConfigs = {
  MTC: {
    tareas: [
      {
        id: 'propane_reading',
        label: 'Lectura de Tanques de Gas',
        icon: PropaneIcon,
        iconColor: '#ff6b35',
        description: 'Registrar niveles de gas propano',
        subtitle: '9 unidades residenciales',
        route: '/propane-reading',
        component: 'PropaneReadingEntry',
        estimatedTime: '15-20 min',
        priority: 'high'
      }
    ]
  },
  AVII: {
    tareas: [
      {
        id: 'water_reading',
        label: 'Lectura de Medidores de Agua',
        icon: WaterIcon,
        iconColor: '#0ea5e9',
        description: 'Registrar lecturas mensuales',
        subtitle: '12 unidades residenciales',
        route: '/tareas/agua',
        component: 'WaterMeterEntry',
        estimatedTime: '30-45 min',
        priority: 'high'
      }
    ]
  }
};

const TareasMenu = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient } = useAuth();
  const { selectedClient: clientObject, selectClient } = useClients();
  const [availableTareas, setAvailableTareas] = useState([]);

  // Get current client data and tasks
  useEffect(() => {
    // Use the current client from auth context
    const clientId = currentClient?.id || currentClient || 'MTC'; // Default to MTC for testing
    
    console.log('TareasMenu Debug:', {
      currentClient,
      clientId,
      clientObject,
      availableConfigs: Object.keys(clientTaskConfigs)
    });
    
    // Set available tasks based on current client
    if (clientTaskConfigs[clientId]) {
      setAvailableTareas(clientTaskConfigs[clientId].tareas);
    } else {
      // Fallback to MTC if client not found
      setAvailableTareas(clientTaskConfigs.MTC.tareas);
    }
  }, [currentClient, clientObject]);

  // Get client display info
  const getClientDisplayInfo = () => {
    const clientId = currentClient?.id || currentClient || 'MTC';
    
    if (clientObject) {
      return {
        id: clientId,
        name: clientObject.basicInfo?.fullName || clientObject.fullName || clientObject.name || clientId,
        displayName: clientObject.basicInfo?.fullName || clientObject.fullName || clientObject.name || clientId,
        color: clientId === 'AVII' ? '#059669' : '#0863bf'
      };
    }
    
    // Fallback data if client object not loaded
    const fallbackNames = {
      MTC: 'Marina Turquesa Condominiums',
      AVII: 'Apartamentos Villa Isabel II'
    };
    
    return {
      id: clientId,
      name: clientId,
      displayName: fallbackNames[clientId] || clientId,
      color: clientId === 'AVII' ? '#059669' : '#0863bf'
    };
  };

  const currentClientInfo = getClientDisplayInfo();

  const handleClientChange = (newClientId) => {
    console.log('Cliente cambiado a:', newClientId);
    selectClient(newClientId);
  };

  const handleTareaSelect = (tarea) => {
    console.log('Tarea seleccionada:', tarea);
    
    // Navigate to the specific data entry screen
    if (tarea.route) {
      navigate(tarea.route);
    } else {
      // For now, show alert since data entry screens aren't implemented yet
      alert(`Navegando a: ${tarea.label}\nComponente: ${tarea.component}`);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#059669';
      default: return '#6b7280';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return 'Normal';
    }
  };

  if (!currentClientInfo) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Cargando tareas...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Box sx={{ p: 2, pb: 10 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1f2937', mb: 1 }}>
            Tareas
          </Typography>
          <Typography variant="h6" sx={{ color: currentClientInfo.color, fontWeight: 600, mb: 1 }}>
            {currentClientInfo.displayName}
          </Typography>
          {samsUser && (
            <Typography variant="body2" color="text.secondary">
              Trabajador: {samsUser.email}
            </Typography>
          )}
        </Box>

        {/* Client Switcher */}
        <ClientSwitcher 
          currentClient={currentClient?.id || currentClient}
          onClientChange={handleClientChange}
        />

        {/* Client Info Alert */}
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            bgcolor: `${currentClientInfo.color}10`,
            borderLeft: `4px solid ${currentClientInfo.color}`,
            '& .MuiAlert-icon': {
              color: currentClientInfo.color
            }
          }}
          icon={<TaskIcon />}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Cliente asignado: {currentClientInfo.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Selecciona una tarea para comenzar el registro de datos
          </Typography>
        </Alert>

        {/* Tasks Grid */}
        <Grid container spacing={2} sx={{ maxWidth: '400px', margin: '0 auto' }}>
          {availableTareas.map((tarea) => {
            const IconComponent = tarea.icon;
            
            return (
              <Grid item xs={12} key={tarea.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '2px solid transparent',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                      borderColor: currentClientInfo.color,
                    },
                    '&:active': {
                      transform: 'translateY(-2px)',
                    }
                  }}
                  onClick={() => handleTareaSelect(tarea)}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header Row */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <Avatar
                          sx={{
                            bgcolor: `${tarea.iconColor}20`,
                            mr: 2,
                            width: 48,
                            height: 48,
                          }}
                        >
                          <IconComponent sx={{ color: tarea.iconColor, fontSize: 28 }} />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 700, 
                              color: '#1f2937', 
                              lineHeight: 1.2,
                              mb: 0.5
                            }}
                          >
                            {tarea.label}
                          </Typography>
                          <Chip
                            label={getPriorityText(tarea.priority)}
                            size="small"
                            sx={{
                              bgcolor: `${getPriorityColor(tarea.priority)}20`,
                              color: getPriorityColor(tarea.priority),
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    {/* Description */}
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        color: '#4b5563', 
                        mb: 1,
                        fontWeight: 500
                      }}
                    >
                      {tarea.description}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6b7280', 
                        mb: 2
                      }}
                    >
                      {tarea.subtitle}
                    </Typography>

                    {/* Footer Info */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Tiempo estimado: {tarea.estimatedTime}
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{
                          bgcolor: currentClientInfo.color,
                          '&:hover': {
                            bgcolor: currentClientInfo.color,
                            opacity: 0.9
                          },
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 2,
                          minWidth: '80px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTareaSelect(tarea);
                        }}
                      >
                        Iniciar
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* No Tasks Available */}
        {availableTareas.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <WarningIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No hay tareas disponibles
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contacta con el administrador para verificar tu asignación de cliente
            </Typography>
          </Box>
        )}

        {/* Footer Info */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            SAMS Mobile - Sistema de Gestión de Mantenimiento
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default TareasMenu;