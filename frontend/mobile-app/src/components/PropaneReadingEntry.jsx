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
  DialogActions,
  TextField,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import propaneReadingService, { 
  findFirstEditableMonth, 
  isMonthEditable, 
  formatFiscalPeriodForDisplay 
} from '../services/propaneReadingService.js';
import { getCurrentFiscalPeriod, getPreviousFiscalPeriod } from '../utils/fiscalYearUtils.js';
import NumericKeypad from './NumericKeypad.jsx';

const PROPANE_TEXT = {
  title: 'Lectura de Tanques de Gas',
  subtitle: 'MTC - Marina Turquesa Condominiums',
  unitLabel: 'Unidad',
  levelLabel: 'Nivel de Gas',
  currentLevel: 'Nivel Actual',
  previousLevel: 'Nivel Anterior',
  submitButton: 'Enviar Datos',
  successMessage: 'Lecturas guardadas correctamente',
  criticalStatus: 'Crítico - Rellenar urgente',
  lowStatus: 'Bajo - Planificar relleno',
  okStatus: 'OK'
};

// Color thresholds
const getLevelColor = (level) => {
  if (level === null || level === undefined || level === '') return '#6b7280';
  if (level <= 10) return '#dc2626';  // Red (critical)
  if (level <= 30) return '#f59e0b';  // Amber (low)
  return '#10b981';                    // Green (ok)
};

const getLevelStatusText = (level) => {
  if (level === null || level === undefined || level === '') return '';
  if (level <= 10) return PROPANE_TEXT.criticalStatus;
  if (level <= 30) return PROPANE_TEXT.lowStatus;
  return PROPANE_TEXT.okStatus;
};

const PropaneReadingEntry = () => {
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiscalInfo, setFiscalInfo] = useState(null);
  const [currentReadings, setCurrentReadings] = useState({});
  const [previousReadings, setPreviousReadings] = useState({});
  const [readingsData, setReadingsData] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [availablePeriods, setAvailablePeriods] = useState({ current: null, prior: null });
  const [isEditable, setIsEditable] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedDataKey, setUnsavedDataKey] = useState(null);
  const [config, setConfig] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [focusedUnitId, setFocusedUnitId] = useState(null);

  // Initialize data on component mount
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
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!hasUnsavedChanges && unsavedDataKey) {
        localStorage.removeItem(unsavedDataKey);
      }
    };
  }, []);

  // Set unsavedDataKey when selectedPeriod changes
  useEffect(() => {
    if (selectedPeriod) {
      const storageKey = `propaneReadings_unsaved_${selectedPeriod.period}`;
      setUnsavedDataKey(storageKey);
    } else {
      setUnsavedDataKey(null);
    }
  }, [selectedPeriod]);

  // Save unsaved changes to localStorage whenever readings change
  useEffect(() => {
    if (!unsavedDataKey || !selectedPeriod) {
      return;
    }
    
    // Debounce: wait 500ms after last change before saving
    const timeoutId = setTimeout(() => {
      try {
        // Only save non-empty values - preserve null/undefined for empty fields
        const readingsToSave = {};
        Object.keys(currentReadings).forEach(unitId => {
          const value = currentReadings[unitId];
          // Only include non-empty values in saved data
          if (value !== null && value !== undefined && value !== '') {
            readingsToSave[unitId] = value;
          }
        });
        
        const hasData = Object.keys(readingsToSave).length > 0;
        if (hasData) {
          const dataToSave = {
            readings: readingsToSave, // Only save non-empty values
            period: selectedPeriod.period,
            timestamp: new Date().toISOString()
          };
          console.log(`💾 Saving unsaved changes to localStorage (debounced):`, { 
            key: unsavedDataKey, 
            period: selectedPeriod.period,
            unitsCount: Object.keys(readingsToSave).length,
            readings: readingsToSave
          });
          localStorage.setItem(unsavedDataKey, JSON.stringify(dataToSave));
          setHasUnsavedChanges(true);
          console.log(`✅ Unsaved changes saved successfully`);
        } else {
          // If no data, remove the localStorage entry to keep it clean
          console.log(`🗑️ Removing empty localStorage entry:`, unsavedDataKey);
          localStorage.removeItem(unsavedDataKey);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error('❌ Error saving unsaved changes:', err);
      }
    }, 500); // 500ms debounce
    
    // Cleanup timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [currentReadings, unsavedDataKey, selectedPeriod]);

  // Note: Unsaved changes are now loaded in loadDataForPeriod to ensure proper period matching
  // This useEffect is removed to prevent race conditions with period switching

  const initializeData = async () => {
    if (isInitialized) return;

    try {
      setLoading(true);
      setError('');

      // Load config
      const configData = await propaneReadingService.loadConfig();
      setConfig(configData);

      // Find first editable month
      const current = getCurrentFiscalPeriod(undefined, 1); // MTC fiscal year starts January
      const editableMonth = await findFirstEditableMonth(current.year);
      
      const currentPeriod = {
        year: current.year,
        month: editableMonth,
        period: `${current.year}-${String(editableMonth).padStart(2, '0')}`
      };

      // Get prior period
      const priorPeriodStr = getPreviousFiscalPeriod(currentPeriod.period);
      const [priorYear, priorMonth] = priorPeriodStr.split('-');
      const priorPeriod = {
        year: parseInt(priorYear),
        month: parseInt(priorMonth),
        period: priorPeriodStr
      };

      setAvailablePeriods({
        current: currentPeriod,
        prior: priorPeriod
      });
      setSelectedPeriod(currentPeriod);

      // Check if editable
      const editable = await isMonthEditable(currentPeriod.year, currentPeriod.month);
      setIsEditable(editable);

      // Set fiscal info
      const fiscalDisplay = formatFiscalPeriodForDisplay(currentPeriod.year, currentPeriod.month);
      setFiscalInfo({
        year: currentPeriod.year,
        month: currentPeriod.month,
        period: currentPeriod.period,
        displayText: fiscalDisplay
      });

      // Load data for selected period
      await loadDataForPeriod(currentPeriod);
      
      setIsInitialized(true);
    } catch (err) {
      console.error('Error initializing data:', err);
      setError(`Error cargando datos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDataForPeriod = async (period) => {
    try {
      // Get the storage key for this period BEFORE loading data
      const storageKey = `propaneReadings_unsaved_${period.period}`;
      
      // Load current and previous readings
      const [currentData, previousData] = await Promise.all([
        propaneReadingService.loadCurrentReadingsForPeriod(period.year, period.month),
        propaneReadingService.loadPreviousReadings(period)
      ]);

      setReadingsData(currentData);
      setPreviousReadings(previousData);

      // Start with empty object - only populate from actual data for this period
      const currentReadingsForDisplay = {};
      
      // Only populate from currentData.readings if they exist (saved data)
      if (currentData && currentData.readings) {
        Object.keys(currentData.readings).forEach(unitId => {
          const unitData = currentData.readings[unitId];
          const level = typeof unitData === 'object' ? unitData.level : unitData;
          // Only set if level is not null/undefined
          if (level !== null && level !== undefined) {
            currentReadingsForDisplay[unitId] = level;
          }
        });
      }

      // Restore unsaved changes from localStorage ONLY for this specific period
      // This ensures we don't mix data from different periods
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log(`🔍 Checking localStorage for period ${period.period}:`, { 
            savedPeriod: parsed.period, 
            currentPeriod: period.period,
            match: parsed.period === period.period 
          });
          // Verify the saved data is for the correct period
          if (parsed.period === period.period && parsed.readings) {
            console.log(`✅ Restoring unsaved changes for period ${period.period}:`, parsed.readings);
            Object.keys(parsed.readings).forEach(unitId => {
              const value = parsed.readings[unitId];
              // Only restore non-empty values (preserve null/empty for unentered fields)
              if (value !== null && value !== undefined && value !== '') {
                currentReadingsForDisplay[unitId] = value;
              }
            });
          } else {
            console.log(`⏭️ Skipping localStorage restore - period mismatch or no readings`);
          }
        } else {
          console.log(`ℹ️ No unsaved changes in localStorage for period ${period.period}`);
        }
      } catch (err) {
        console.error('❌ Error loading unsaved changes:', err);
      }

      // Set current readings - this will be empty for new months, preserving null values
      setCurrentReadings(currentReadingsForDisplay);
    } catch (err) {
      console.error('Error loading data for period:', err);
      setError(`Error cargando datos: ${err.message}`);
    }
  };

  const switchToPeriod = async (period) => {
    if (!period) return;

    // Save current unsaved changes to localStorage before switching
    // Only save non-empty values to preserve null state
    if (unsavedDataKey && selectedPeriod) {
      const readingsToSave = {};
      Object.keys(currentReadings).forEach(unitId => {
        const value = currentReadings[unitId];
        if (value !== null && value !== undefined && value !== '') {
          readingsToSave[unitId] = value;
        }
      });
      
      if (Object.keys(readingsToSave).length > 0) {
        localStorage.setItem(unsavedDataKey, JSON.stringify({
          readings: readingsToSave,
          period: selectedPeriod.period
        }));
      } else {
        // Remove empty localStorage entry
        localStorage.removeItem(unsavedDataKey);
      }
    }

    // Clear current readings state before loading new period to prevent mixing
    setCurrentReadings({});
    setHasUnsavedChanges(false);

    setSelectedPeriod(period);
    const fiscalDisplay = formatFiscalPeriodForDisplay(period.year, period.month);
    setFiscalInfo({
      year: period.year,
      month: period.month,
      period: period.period,
      displayText: fiscalDisplay
    });

    await loadDataForPeriod(period);
  };

  const handleLevelChange = (unitId, value) => {
    const numValue = value === '' ? '' : parseInt(value);
    if (numValue !== '' && (numValue < 0 || numValue > 100)) return;
    
    setCurrentReadings(prev => ({
      ...prev,
      [unitId]: numValue
    }));
  };

  const handleTextFieldFocus = (unitId) => {
    setFocusedUnitId(unitId);
    setKeypadOpen(true);
  };

  const handleKeypadInput = (value) => {
    if (focusedUnitId) {
      const numValue = value === '' ? '' : parseInt(value);
      // Validate range
      if (numValue !== '' && (numValue < 0 || numValue > 100)) {
        return; // Don't update if out of range
      }
      handleLevelChange(focusedUnitId, value);
    }
  };

  const handleKeypadClose = () => {
    setKeypadOpen(false);
    setFocusedUnitId(null);
  };

  const handleSubmitReadings = async () => {
    try {
      setSaving(true);
      setError('');

      // Validate at least one reading
      const validReadings = Object.values(currentReadings).filter(
        val => val !== null && val !== undefined && val !== ''
      );
      
      if (validReadings.length === 0) {
        setError('Ingresa al menos una lectura antes de enviar');
        setSaving(false);
        return;
      }

      // Save readings
      await propaneReadingService.saveAllReadingsForPeriod(
        currentReadings,
        selectedPeriod.year,
        selectedPeriod.month
      );

      // Clear unsaved changes
      if (unsavedDataKey) {
        localStorage.removeItem(unsavedDataKey);
        setHasUnsavedChanges(false);
      }

      // Reload data
      await loadDataForPeriod(selectedPeriod);

      // Show success
      setSuccessModalOpen(true);
    } catch (err) {
      console.error('Error saving readings:', err);
      setError(`Error guardando lecturas: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  const units = config?.units || [];
  const workerRouteOrder = config?.workerRouteOrder || units.map(u => u.id);
  const completedReadings = Object.values(currentReadings).filter(
    val => val !== null && val !== undefined && val !== ''
  ).length;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', pb: 10 }}>
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => {
              if (hasUnsavedChanges) {
                if (window.confirm('Tienes cambios sin guardar. ¿Deseas salir?')) {
                  navigate('/tareas');
                }
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
              {PROPANE_TEXT.title}
            </Typography>
            <Typography variant="h6" sx={{ color: '#ff6b35', fontWeight: 600 }}>
              {PROPANE_TEXT.subtitle}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                📅 {fiscalInfo?.displayText || 'Cargando...'}
              </Typography>
              {selectedPeriod && availablePeriods?.prior && 
               selectedPeriod.period !== availablePeriods.current?.period && (
                <Chip
                  label={`Volver a ${formatFiscalPeriodForDisplay(availablePeriods.current.year, availablePeriods.current.month)}`}
                  size="small"
                  color="primary"
                  onClick={() => switchToPeriod(availablePeriods.current)}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {selectedPeriod && availablePeriods?.prior && 
               selectedPeriod.period === availablePeriods.current?.period && (
                <Chip
                  label={`Editar ${formatFiscalPeriodForDisplay(availablePeriods.prior.year, availablePeriods.prior.month)}`}
                  size="small"
                  color="secondary"
                  onClick={() => switchToPeriod(availablePeriods.prior)}
                  sx={{ cursor: 'pointer' }}
                />
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
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Progreso: {completedReadings} de {units.length} unidades
          </Typography>
        </Alert>

        {/* Units Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {workerRouteOrder.map((unitId) => {
            const unit = units.find(u => u.id === unitId);
            const currentLevel = currentReadings[unitId];
            const previousLevel = previousReadings[unitId];
            const levelColor = getLevelColor(currentLevel);
            const statusText = getLevelStatusText(currentLevel);

            return (
              <Grid item xs={12} sm={6} key={unitId}>
                <Card sx={{ border: `2px solid ${levelColor}40` }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                      {unitId}
                    </Typography>
                    
                    {previousLevel !== undefined && previousLevel !== null && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {PROPANE_TEXT.previousLevel}: {previousLevel}%
                      </Typography>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                        {PROPANE_TEXT.currentLevel}
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        value={currentLevel || ''}
                        onChange={(e) => handleLevelChange(unitId, e.target.value)}
                        onFocus={() => handleTextFieldFocus(unitId)}
                        placeholder="0-100"
                        inputProps={{ 
                          min: 0, 
                          max: 100,
                          readOnly: true // Prevent native keyboard, use our keypad
                        }}
                        disabled={saving || !isEditable}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: levelColor
                            },
                            '&:hover fieldset': {
                              borderColor: levelColor
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: levelColor
                            }
                          }
                        }}
                      />
                    </Box>

                    {statusText && (
                      <Chip
                        label={statusText}
                        size="small"
                        sx={{
                          bgcolor: `${levelColor}20`,
                          color: levelColor,
                          fontWeight: 600
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Submit Button */}
        <Button
          variant="contained"
          fullWidth
          startIcon={<SaveIcon />}
          onClick={handleSubmitReadings}
          disabled={saving || completedReadings === 0 || !isEditable}
          sx={{
            minHeight: '56px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            bgcolor: '#ff6b35',
            '&:hover': {
              bgcolor: '#e55a2b'
            }
          }}
        >
          {saving ? 'Enviando...' : `${PROPANE_TEXT.submitButton} (${completedReadings}/${units.length})`}
        </Button>
      </Box>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onClose={() => {
        setSuccessModalOpen(false);
        navigate('/tareas');
      }}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <SuccessIcon sx={{ fontSize: 48, color: '#10b981', mb: 1 }} />
          <Typography component="div" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
            {PROPANE_TEXT.successMessage}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" align="center">
            {completedReadings} lecturas guardadas correctamente
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              setSuccessModalOpen(false);
              navigate('/tareas');
            }}
            sx={{ textTransform: 'none' }}
          >
            Volver a Tareas
          </Button>
        </DialogActions>
      </Dialog>

      {/* Numeric Keypad */}
      <NumericKeypad
        open={keypadOpen}
        onClose={handleKeypadClose}
        onInput={handleKeypadInput}
        value={focusedUnitId ? (currentReadings[focusedUnitId] || '') : ''}
      />
    </Box>
  );
};

export default PropaneReadingEntry;
