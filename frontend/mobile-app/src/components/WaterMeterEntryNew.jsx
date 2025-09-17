import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Chip,
  Fab,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LocalCarWash as WashIcon,
  Save as SaveIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MeterReadingTable from './MeterReadingTable';
import WashEntryModal from './WashEntryModal';
import WashSummaryList from './WashSummaryList';
import waterReadingService from '../services/waterReadingServiceV2.js';
import { 
  WORKER_ROUTE_ORDER,
  parseReading,
  getAllWashSummary,
  getCurrentFiscalPeriod 
} from '../utils/waterReadingHelpers';

const WaterMeterEntryNew = () => {
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientInfo, setClientInfo] = useState(null);
  const [fiscalInfo, setFiscalInfo] = useState(null);
  const [currentReadings, setCurrentReadings] = useState({});
  const [previousReadings, setPreviousReadings] = useState({});
  const [readingsData, setReadingsData] = useState(null);
  const [washModalOpen, setWashModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Initialize data on component mount
  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Initializing water meter data...');

      // Get fiscal period info
      const fiscal = getCurrentFiscalPeriod();
      setFiscalInfo(fiscal);

      // Load data in parallel
      const [clientData, previousData, currentData] = await Promise.all([
        waterReadingService.loadClientInfo(),
        waterReadingService.loadPreviousReadings(),
        waterReadingService.loadCurrentReadings()
      ]);

      console.log('Loaded data:', { clientData, previousData, currentData });

      setClientInfo(clientData);
      setPreviousReadings(previousData);
      setReadingsData(currentData);

      // Extract current readings for display
      const currentReadingsForDisplay = {};
      if (currentData?.readings) {
        Object.keys(currentData.readings).forEach(unitId => {
          const unitData = currentData.readings[unitId];
          if (unitData && typeof unitData === 'object') {
            currentReadingsForDisplay[unitId] = unitData.reading || '';
          } else if (typeof unitData === 'number') {
            currentReadingsForDisplay[unitId] = unitData;
          }
        });
      }
      setCurrentReadings(currentReadingsForDisplay);

    } catch (err) {
      console.error('Error initializing data:', err);
      setError(`Error cargando datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle reading input changes
  const handleReadingChange = (unitId, value) => {
    setCurrentReadings(prev => ({
      ...prev,
      [unitId]: value
    }));
  };

  // Handle wash entry
  const handleWashSave = async (unitId, washEntry) => {
    try {
      setSaving(true);
      console.log('Saving wash entry:', { unitId, washEntry });

      await waterReadingService.saveWashEntry(unitId, washEntry);

      // Reload current readings to get updated washes
      const updatedData = await waterReadingService.loadCurrentReadings();
      console.log('Wash saved successfully, updated data:', updatedData);
      
      // Force state update
      setReadingsData(updatedData);
      
      // Small delay to ensure state update is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error('Error saving wash:', err);
      throw err; // Let modal handle the error
    } finally {
      setSaving(false);
    }
  };

  // Handle submit all readings
  const handleSubmitReadings = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate all readings
      let validReadingsCount = 0;
      const readingsToSave = {};

      // Update readings in the complete data structure we have in memory
      const updatedReadingsData = { ...readingsData };
      
      Object.keys(currentReadings).forEach(unitId => {
        const reading = parseReading(currentReadings[unitId]);
        if (reading !== null) {
          // Update the reading in the existing data structure
          if (updatedReadingsData.readings[unitId]) {
            updatedReadingsData.readings[unitId].reading = reading;
          }
          validReadingsCount++;
        }
      });

      if (validReadingsCount === 0) {
        setError('Ingresa al menos una lectura antes de enviar');
        setSaving(false);
        return;
      }

      console.log('Overwriting complete document:', updatedReadingsData.readings);

      // Overwrite the entire document with complete data structure
      await waterReadingService.saveAllReadings(updatedReadingsData.readings);

      // Show success
      setSuccessModalOpen(true);

    } catch (err) {
      console.error('Error saving readings:', err);
      setError(`Error guardando lecturas: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Get wash summary for display (recalculated on readingsData change)
  const washSummary = getAllWashSummary(readingsData || {});
  
  // Debug: Log wash summary changes
  useEffect(() => {
    console.log('Wash summary updated:', washSummary);
  }, [washSummary.totalWashes]);

  // Count completed readings
  const completedReadings = Object.values(currentReadings).filter(reading => 
    parseReading(reading) !== null
  ).length;

  const totalUnits = WORKER_ROUTE_ORDER.length;

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh' 
      }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', pb: 10 }}>
      <Box sx={{ p: 2 }}>
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
              🏢 {clientInfo?.fullName || 'Apartamentos Villa Isabel II'}
            </Typography>
            <Typography variant="h6" sx={{ color: '#0ea5e9', fontWeight: 600 }}>
              Lecturas de Medidores de Agua
            </Typography>
            <Typography variant="body2" color="text.secondary">
              📅 {fiscalInfo?.displayText || 'Septiembre 2025'}
            </Typography>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Progress Alert */}
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          icon={<SuccessIcon />}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Progreso: {completedReadings} de {totalUnits} medidores
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {washSummary.totalWashes} lavados registrados • ${washSummary.totalCost.toLocaleString()} total
          </Typography>
        </Alert>

        {/* Main Reading Table */}
        <Box sx={{ mb: 3 }}>
          <MeterReadingTable
            readings={currentReadings}
            previousReadings={previousReadings}
            onReadingChange={handleReadingChange}
            disabled={saving}
          />
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<WashIcon />}
            onClick={() => setWashModalOpen(true)}
            disabled={saving}
            sx={{
              flex: 1,
              minHeight: '56px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              borderColor: '#0ea5e9',
              color: '#0ea5e9',
              '&:hover': {
                borderColor: '#0284c7',
                bgcolor: '#f0f9ff'
              }
            }}
          >
            Lavados
          </Button>
          
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmitReadings}
            disabled={saving || completedReadings === 0}
            sx={{
              flex: 2,
              minHeight: '56px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              bgcolor: '#059669',
              '&:hover': {
                bgcolor: '#047857'
              }
            }}
          >
            {saving ? 'Enviando...' : `Enviar Datos (${completedReadings}/${totalUnits})`}
          </Button>
        </Box>

        {/* Wash Summary */}
        {washSummary.totalWashes > 0 && (
          <WashSummaryList 
            readingsData={readingsData}
          />
        )}
      </Box>

      {/* Wash Entry Modal */}
      <WashEntryModal
        open={washModalOpen}
        onClose={() => setWashModalOpen(false)}
        onSave={handleWashSave}
        loading={saving}
      />

      {/* Success Modal */}
      <Dialog open={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <SuccessIcon sx={{ fontSize: 48, color: '#059669', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            ¡Datos Enviados Exitosamente!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" textAlign="center">
            {completedReadings} lecturas y {washSummary.totalWashes} lavados guardados correctamente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            onClick={() => {
              setSuccessModalOpen(false);
              navigate('/tareas');
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              minWidth: '120px',
              bgcolor: '#059669'
            }}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading Overlay */}
      <Backdrop open={saving} sx={{ color: '#fff', zIndex: 1300 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" size={40} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            {saving ? 'Guardando datos...' : 'Cargando...'}
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export default WaterMeterEntryNew;