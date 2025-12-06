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
import waterReadingService, { findFirstEditableMonth, isMonthEditable, formatFiscalPeriodForDisplay } from '../services/waterReadingServiceV2.js';
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
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [availablePeriods, setAvailablePeriods] = useState({ current: null, prior: null });
  const [isEditable, setIsEditable] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedDataKey, setUnsavedDataKey] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPeriodSwitch, setPendingPeriodSwitch] = useState(null);

  // Track if component has been initialized (prevent re-initialization on period switches)
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize data on component mount ONLY (not on period switches)
  useEffect(() => {
    if (!isInitialized) {
      initializeData();
    }
    
    // Warn user before leaving page with unsaved changes
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup: Remove unsaved data on unmount if saved
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!hasUnsavedChanges && unsavedDataKey) {
        localStorage.removeItem(unsavedDataKey);
      }
    };
  }, []); // Empty deps - only run on mount

  // Track if we're currently loading data (to avoid marking as unsaved during load)
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Set unsavedDataKey when selectedPeriod changes
  useEffect(() => {
    if (selectedPeriod) {
      const storageKey = `waterReadings_unsaved_${selectedPeriod.period}`;
      setUnsavedDataKey(storageKey);
      console.log(`💾 Set unsavedDataKey for period ${selectedPeriod.period}: ${storageKey}`);
    } else {
      setUnsavedDataKey(null);
    }
  }, [selectedPeriod]);

  // Save unsaved changes to localStorage whenever readings change (debounced, not during data load)
  useEffect(() => {
    // Skip if loading data or no unsavedDataKey
    if (!unsavedDataKey || isLoadingData || Object.keys(currentReadings).length === 0) {
      return;
    }

    // Debounce: wait 500ms after last change before saving
    const timeoutId = setTimeout(() => {
      try {
        const dataToSave = {
          readings: currentReadings,
          buildingMeter: currentReadings.buildingMeter,
          commonArea: currentReadings.commonArea,
          period: selectedPeriod?.period,
          timestamp: new Date().toISOString()
        };
        console.log(`💾 Saving unsaved changes to localStorage (debounced):`, { key: unsavedDataKey, data: dataToSave });
        localStorage.setItem(unsavedDataKey, JSON.stringify(dataToSave));
        setHasUnsavedChanges(true);
        console.log(`✅ Unsaved changes saved successfully`);
      } catch (err) {
        console.error('❌ Error saving unsaved changes:', err);
      }
    }, 500); // 500ms debounce

    // Cleanup timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [currentReadings, unsavedDataKey, selectedPeriod, isLoadingData]);

  // Helper to switch to a different period
  // Automatically stashes current data to localStorage before switching
  // NO confirmation needed - localStorage handles temporary storage
  const switchToPeriod = async (period) => {
    // Current data is already being saved to localStorage automatically via useEffect
    // Just switch periods - localStorage will persist the unsaved data
    console.log(`🔄 Switching to period ${period.period} (current unsaved data is in localStorage)`);
    
    const priorDisplay = formatFiscalPeriodForDisplay(period.year, period.month);
    setSelectedPeriod(period);
    setFiscalInfo({
      year: period.year,
      month: period.month + 1,
      period: period.period,
      displayText: priorDisplay.displayText
    });
    // Reload data for the period (will restore unsaved data from localStorage if exists)
    await initializeDataForPeriod(period);
  };

  const initializeDataForPeriod = async (period) => {
    try {
      setLoading(true);
      setIsLoadingData(true);
      setError('');

      console.log('Loading data for period:', period);

      // Load data for the selected period - pass period to loadPreviousReadings
      const [previousData, currentData] = await Promise.all([
        waterReadingService.loadPreviousReadings(period),
        waterReadingService.loadCurrentReadingsForPeriod(period.year, period.month)
      ]);

      console.log('Loaded data for period:', { period, previousData, currentData });

      setPreviousReadings(previousData);
      setReadingsData(currentData);

      // Extract current readings for display
      // Handle both aggregated data structure (units) and direct readings structure
      const currentReadingsForDisplay = {};
      
      // Check for aggregated data structure (from getMonthReadingsFromAggregated)
      if (currentData?.units) {
        Object.keys(currentData.units).forEach(unitId => {
          const unitData = currentData.units[unitId];
          if (unitData?.currentReading) {
            // Aggregated data structure: {currentReading: {reading: 1808}}
            const reading = unitData.currentReading.reading || unitData.currentReading;
            if (typeof reading === 'number') {
              currentReadingsForDisplay[unitId] = reading;
            }
          }
        });
      }
      // Check for direct readings structure (from Firestore)
      else if (currentData?.readings) {
        Object.keys(currentData.readings).forEach(unitId => {
          const unitData = currentData.readings[unitId];
          if (unitData && typeof unitData === 'object') {
            currentReadingsForDisplay[unitId] = unitData.reading || '';
          } else if (typeof unitData === 'number') {
            currentReadingsForDisplay[unitId] = unitData;
          }
        });
      }
      
      // Extract building meter and common area readings (only if not already set from unsaved data)
      if (currentReadingsForDisplay.buildingMeter === undefined && currentData?.buildingMeter?.currentReading !== undefined) {
        const buildingReading = currentData.buildingMeter.currentReading;
        currentReadingsForDisplay.buildingMeter = typeof buildingReading === 'number' ? buildingReading : buildingReading.reading || buildingReading;
      } else if (currentData?.buildingMeter !== undefined && typeof currentData.buildingMeter === 'number') {
        // Direct read format: buildingMeter is a number
        if (currentReadingsForDisplay.buildingMeter === undefined) {
          currentReadingsForDisplay.buildingMeter = currentData.buildingMeter;
        }
      }
      
      if (currentReadingsForDisplay.commonArea === undefined && currentData?.commonArea?.currentReading !== undefined) {
        const commonReading = currentData.commonArea.currentReading;
        currentReadingsForDisplay.commonArea = typeof commonReading === 'number' ? commonReading : commonReading.reading || commonReading;
      } else if (currentData?.commonArea !== undefined && typeof currentData.commonArea === 'number') {
        // Direct read format: commonArea is a number
        if (currentReadingsForDisplay.commonArea === undefined) {
          currentReadingsForDisplay.commonArea = currentData.commonArea;
        }
      }
      
      console.log('Extracted current readings for display:', currentReadingsForDisplay);
      
      // Check if there are unsaved changes for this period in localStorage
      const storageKey = `waterReadings_unsaved_${period.period}`;
      console.log(`🔍 Checking localStorage for unsaved changes: ${storageKey}`);
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('✅ Found unsaved changes in localStorage:', parsed);
          console.log(`📊 Unsaved readings count: ${Object.keys(parsed.readings || {}).length}`);
          // Merge: use unsaved if exists, otherwise use loaded data
          Object.keys(parsed.readings || {}).forEach(unitId => {
            if (parsed.readings[unitId] !== undefined && parsed.readings[unitId] !== '') {
              console.log(`  ↳ Restoring unsaved reading for ${unitId}: ${parsed.readings[unitId]}`);
              currentReadingsForDisplay[unitId] = parsed.readings[unitId];
            }
          });
          
          // Also restore buildingMeter and commonArea if present
          if (parsed.buildingMeter !== undefined && parsed.buildingMeter !== null && parsed.buildingMeter !== '') {
            console.log(`  ↳ Restoring unsaved buildingMeter: ${parsed.buildingMeter}`);
            currentReadingsForDisplay.buildingMeter = parsed.buildingMeter;
          }
          if (parsed.commonArea !== undefined && parsed.commonArea !== null && parsed.commonArea !== '') {
            console.log(`  ↳ Restoring unsaved commonArea: ${parsed.commonArea}`);
            currentReadingsForDisplay.commonArea = parsed.commonArea;
          }
          
          console.log(`✅ Restored unsaved changes for period ${period.period}`);
        } else {
          console.log(`ℹ️ No unsaved changes found in localStorage for ${storageKey}`);
        }
      } catch (err) {
        console.error('❌ Error loading unsaved changes:', err);
      }
      
      setCurrentReadings(currentReadingsForDisplay);
      setIsLoadingData(false);

    } catch (err) {
      console.error('Error loading data for period:', err);
      setError(`Error cargando datos: ${err.message}`);
      setIsLoadingData(false);
    } finally {
      setLoading(false);
    }
  };

  const initializeData = async () => {
    // Prevent re-initialization if already initialized
    if (isInitialized) {
      console.log('⚠️ initializeData() called but already initialized - skipping');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('🚀 Initializing water meter data (first time only)...');

      // Get client info first
      const clientData = await waterReadingService.loadClientInfo();
      setClientInfo(clientData);

      // Find first editable month (no readings, no bills) and prior month
      const current = getCurrentFiscalPeriod();
      const editableMonths = await findFirstEditableMonth(current.year);
      
      if (!editableMonths || !editableMonths.current) {
        throw new Error('No editable months found');
      }

      console.log('Editable months:', editableMonths);
      
      // Store available periods
      setAvailablePeriods(editableMonths);
      
      // Default to current month (first empty)
      setSelectedPeriod(editableMonths.current);

      // Check if this month is editable (no bills)
      const editable = await isMonthEditable(editableMonths.current.year, editableMonths.current.month);
      setIsEditable(editable);

      if (!editable) {
        setError('Este mes ya tiene facturas generadas y no puede ser editado.');
      }

      // Set fiscal info for the selected period (format for display)
      if (!formatFiscalPeriodForDisplay) {
        throw new Error('formatFiscalPeriodForDisplay is not available');
      }
      
      const fiscalDisplay = formatFiscalPeriodForDisplay(
        editableMonths.current.year,
        editableMonths.current.month
      );
      
      if (!fiscalDisplay || !fiscalDisplay.displayText) {
        throw new Error('Failed to format fiscal period for display');
      }
      
      setFiscalInfo({
        year: editableMonths.current.year,
        month: editableMonths.current.month + 1, // Convert back to 1-based for internal use
        period: editableMonths.current.period,
        displayText: fiscalDisplay.displayText
      });

      // Load data for the selected period
      await initializeDataForPeriod(editableMonths.current);
      
      // Mark as initialized AFTER data is loaded
      setIsInitialized(true);

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

      // Reload current readings for the selected period
      const updatedData = selectedPeriod 
        ? await waterReadingService.loadCurrentReadingsForPeriod(
            selectedPeriod.year,
            selectedPeriod.month
          )
        : await waterReadingService.loadCurrentReadings();
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

  // Track saved readings count for success message
  const [savedReadingsCount, setSavedReadingsCount] = useState(0);
  const [savedWashesCount, setSavedWashesCount] = useState(0);

  // Handle submit all readings
  const handleSubmitReadings = async () => {
    try {
      setSaving(true);
      setError('');

      // Check if month is editable
      if (!isEditable) {
        setError('Este mes ya tiene facturas generadas y no puede ser editado.');
        return;
      }

      if (!selectedPeriod) {
        setError('No se ha seleccionado un período válido.');
        return;
      }

      // Validate all readings and build payload
      let validReadingsCount = 0;
      let washesCount = 0;
      const readingsPayload = {
        readings: {},
        buildingMeter: null,
        commonArea: null
      };
      
      // Extract readings from currentReadings state
      Object.keys(currentReadings).forEach(unitId => {
        const reading = parseReading(currentReadings[unitId]);
        if (reading !== null) {
          // Handle unit readings (101, 102, etc.)
          if (unitId !== 'buildingMeter' && unitId !== 'commonArea') {
            // Get existing unit data structure if available (for washes)
            const existingUnitData = readingsData?.units?.[unitId] || readingsData?.readings?.[unitId] || {};
            
            readingsPayload.readings[unitId] = {
              reading: reading,
              // Preserve washes if they exist
              ...(existingUnitData.washes ? { washes: existingUnitData.washes } : {})
            };
            validReadingsCount++;
            
            // Count washes for this unit
            if (existingUnitData.washes && Array.isArray(existingUnitData.washes)) {
              washesCount += existingUnitData.washes.length;
            }
          }
        }
      });
      
      // Extract building meter and common area if present
      const buildingMeterReading = parseReading(currentReadings.buildingMeter);
      const commonAreaReading = parseReading(currentReadings.commonArea);
      
      if (buildingMeterReading !== null) {
        readingsPayload.buildingMeter = buildingMeterReading;
        validReadingsCount++;
      }
      
      if (commonAreaReading !== null) {
        readingsPayload.commonArea = commonAreaReading;
        validReadingsCount++;
      }

      if (validReadingsCount === 0) {
        setError('Ingresa al menos una lectura antes de enviar');
        setSaving(false);
        return;
      }

      console.log('💾 Saving readings payload to Firestore:', readingsPayload);
      console.log(`📊 Saving ${validReadingsCount} readings and ${washesCount} washes`);

      // Save using selected period - THIS WRITES TO FIRESTORE
      await waterReadingService.saveAllReadingsForPeriod(
        readingsPayload,
        selectedPeriod.year,
        selectedPeriod.month
      );

      console.log('✅ Successfully saved to Firestore');

      // Store counts for success message (before reload clears state)
      setSavedReadingsCount(validReadingsCount);
      setSavedWashesCount(washesCount);

      // Reload current readings for the selected period
      const updatedData = await waterReadingService.loadCurrentReadingsForPeriod(
        selectedPeriod.year,
        selectedPeriod.month
      );
      setReadingsData(updatedData);

      // Clear unsaved changes after successful save
      if (unsavedDataKey) {
        localStorage.removeItem(unsavedDataKey);
        setHasUnsavedChanges(false);
        console.log('🗑️ Cleared localStorage after successful save');
      }

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
  
  // Check if all readings are complete (for save prompt logic)
  const allReadingsComplete = completedReadings === totalUnits;
  const hasPartialData = completedReadings > 0 && completedReadings < totalUnits;

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
            onClick={() => {
              // Check for unsaved changes before navigating away
              if (hasUnsavedChanges) {
                setPendingPeriodSwitch('navigate');
                setConfirmDialogOpen(true);
              } else {
                navigate('/tareas');
              }
            }}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                📅 {fiscalInfo?.displayText || 'Cargando...'}
              </Typography>
              {/* Show chip to go back to current month if we're editing prior month */}
              {selectedPeriod && availablePeriods?.current && 
               selectedPeriod.period !== availablePeriods.current.period && (
                <Chip
                  label={`Volver a ${formatFiscalPeriodForDisplay(availablePeriods.current.year, availablePeriods.current.month).displayText}`}
                  size="small"
                  color="primary"
                  onClick={async () => {
                    // No confirmation needed - localStorage handles temporary storage automatically
                    await switchToPeriod(availablePeriods.current);
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {/* Show chip to edit prior month if we're on current month */}
              {selectedPeriod && availablePeriods?.prior && 
               selectedPeriod.period === availablePeriods.current?.period && (
                <Chip
                  label={`Editar ${formatFiscalPeriodForDisplay(availablePeriods.prior.year, availablePeriods.prior.month).displayText}`}
                  size="small"
                  color="secondary"
                  onClick={async () => {
                    // No confirmation needed - localStorage handles temporary storage automatically
                    await switchToPeriod(availablePeriods.prior);
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {!availablePeriods?.prior && availablePeriods?.current && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  (Solo mes actual editable)
                </Typography>
              )}
            </Box>
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
            {!isEditable && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Este mes ya tiene facturas generadas y no puede ser editado.
              </Alert>
            )}
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

      {/* Unsaved Changes Confirmation Dialog - Only for navigating away from page */}
      {/* Period switching now happens automatically without confirmation */}
      {/* This dialog should only appear when user tries to navigate away (e.g., click back button) */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {allReadingsComplete ? 'Guardar antes de salir' : 'Lectura parcial sin guardar'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {allReadingsComplete 
              ? `Tienes ${completedReadings} lecturas completas. ¿Deseas guardar antes de salir?`
              : `Tienes ${completedReadings} de ${totalUnits} lecturas ingresadas. ¿Qué deseas hacer?`
            }
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {allReadingsComplete
              ? 'Los datos se guardarán permanentemente en Firestore.'
              : 'Puedes guardar la lectura parcial o continuar editando más tarde.'
            }
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmDialogOpen(false);
              setPendingPeriodSwitch(null);
            }}
            sx={{ textTransform: 'none', flex: '1 1 auto', minWidth: '120px' }}
          >
            Cancelar
          </Button>
          {hasPartialData && (
            <Button
              variant="contained"
              color="warning"
              onClick={async () => {
                setConfirmDialogOpen(false);
                // Save partial data to Firestore
                try {
                  await handleSubmitReadings();
                  if (pendingPeriodSwitch === 'navigate') {
                    navigate('/tareas');
                  }
                } catch (err) {
                  console.error('Error saving partial data:', err);
                  // Still navigate even if save fails
                  if (pendingPeriodSwitch === 'navigate') {
                    navigate('/tareas');
                  }
                }
                setPendingPeriodSwitch(null);
              }}
              sx={{ textTransform: 'none', flex: '1 1 auto', minWidth: '140px' }}
            >
              Guardar lectura parcial
            </Button>
          )}
          {allReadingsComplete && (
            <Button
              variant="contained"
              color="success"
              onClick={async () => {
                setConfirmDialogOpen(false);
                // Save complete data to Firestore
                try {
                  await handleSubmitReadings();
                  if (pendingPeriodSwitch === 'navigate') {
                    navigate('/tareas');
                  }
                } catch (err) {
                  console.error('Error saving complete data:', err);
                  // Still navigate even if save fails
                  if (pendingPeriodSwitch === 'navigate') {
                    navigate('/tareas');
                  }
                }
                setPendingPeriodSwitch(null);
              }}
              sx={{ textTransform: 'none', flex: '1 1 auto', minWidth: '140px' }}
            >
              Guardar y salir
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => {
              setConfirmDialogOpen(false);
              setPendingPeriodSwitch(null);
              // Navigate away - localStorage will preserve data
              if (pendingPeriodSwitch === 'navigate') {
                navigate('/tareas');
              }
            }}
            sx={{ textTransform: 'none', flex: '1 1 auto', minWidth: '140px', bgcolor: '#0ea5e9' }}
          >
            {allReadingsComplete ? 'Salir sin guardar' : 'Continuar editando más tarde'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <SuccessIcon sx={{ fontSize: 48, color: '#059669', mb: 1 }} />
          <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
            ¡Datos Enviados Exitosamente!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" textAlign="center">
            {savedReadingsCount} lecturas y {savedWashesCount} lavados guardados correctamente en Firestore.
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