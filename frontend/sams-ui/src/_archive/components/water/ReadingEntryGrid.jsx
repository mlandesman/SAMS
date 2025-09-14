import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Alert,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint, faExclamationTriangle, faSave, faUndo } from '@fortawesome/free-solid-svg-icons';
import './ReadingEntryGrid.css';

function ReadingEntryGrid({ 
  units, 
  previousReadings, 
  onSave, 
  readingDate,
  loading = false 
}) {
  const [readings, setReadings] = useState({});
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize readings from previous data
  useEffect(() => {
    console.log('🚗🛥️ ReadingEntryGrid: NEW CODE RUNNING - initializing with wash counts');
    if (units && units.length > 0) {
      const initialReadings = {};
      units.forEach(unit => {
        const prevReading = previousReadings?.[unit.unitId];
        initialReadings[unit.unitId] = {
          unitId: unit.unitId,
          meterNumber: unit.meterNumber || '',
          currentReading: '',
          previousReading: prevReading?.reading || 0,
          previousDate: prevReading?.readingDate || null,
          consumption: 0,
          carWashCount: 0,
          boatWashCount: 0,
          notes: ''
        };
      });
      console.log('🚗🛥️ Sample reading structure:', initialReadings[Object.keys(initialReadings)[0]]);
      setReadings(initialReadings);
    }
  }, [units, previousReadings]);

  // Calculate consumption and check for warnings
  const handleReadingChange = (unitId, value) => {
    const numValue = parseFloat(value) || 0;
    const prev = readings[unitId]?.previousReading || 0;
    
    // Update reading
    const updatedReading = {
      ...readings[unitId],
      currentReading: value,
      consumption: numValue > prev ? numValue - prev : 0
    };
    
    setReadings(prev => ({
      ...prev,
      [unitId]: updatedReading
    }));
    
    // Clear error
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[unitId];
      return newErrors;
    });
    
    // Check for warnings
    if (numValue > 0) {
      const consumption = numValue - prev;
      
      // Warning if reading is less than previous (meter rollback)
      if (numValue < prev && numValue > 0) {
        setWarnings(prev => ({
          ...prev,
          [unitId]: 'Current reading is less than previous reading. Please verify.'
        }));
      }
      // Warning if consumption is unusually high (>10000 gallons)
      else if (consumption > 10000) {
        setWarnings(prev => ({
          ...prev,
          [unitId]: `High consumption detected: ${consumption.toLocaleString()} gallons`
        }));
      }
      // Clear warning if normal
      else {
        setWarnings(prev => {
          const newWarnings = { ...prev };
          delete newWarnings[unitId];
          return newWarnings;
        });
      }
    }
    
    setIsDirty(true);
  };

  // Handle car wash count change
  const handleCarWashChange = (unitId, value) => {
    console.log('🚗 Car wash change for unit:', unitId, 'value:', value);
    const count = parseInt(value) || 0;
    
    setReadings(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        carWashCount: count
      }
    }));
    
    setIsDirty(true);
  };

  // Handle boat wash count change
  const handleBoatWashChange = (unitId, value) => {
    const count = parseInt(value) || 0;
    
    setReadings(prev => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        boatWashCount: count
      }
    }));
    
    setIsDirty(true);
  };

  // Validate all readings before save
  const validateReadings = () => {
    const newErrors = {};
    let hasValidReadings = false;
    
    Object.entries(readings).forEach(([unitId, reading]) => {
      if (reading.currentReading) {
        const value = parseFloat(reading.currentReading);
        if (isNaN(value) || value < 0) {
          newErrors[unitId] = 'Invalid reading value';
        } else {
          hasValidReadings = true;
        }
      }
      
      // Validate wash counts if provided
      if (reading.carWashCount && (isNaN(parseInt(reading.carWashCount)) || parseInt(reading.carWashCount) < 0)) {
        newErrors[unitId] = 'Invalid car wash count';
      }
      if (reading.boatWashCount && (isNaN(parseInt(reading.boatWashCount)) || parseInt(reading.boatWashCount) < 0)) {
        newErrors[unitId] = 'Invalid boat wash count';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && hasValidReadings;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateReadings()) {
      return;
    }
    
    setSaving(true);
    
    try {
      // Filter out empty readings and format for API
      const validReadings = Object.values(readings)
        .filter(r => r.currentReading && parseFloat(r.currentReading) > 0)
        .map(r => ({
          unitId: r.unitId,
          meterNumber: r.meterNumber,
          reading: parseFloat(r.currentReading),
          consumption: r.consumption,
          carWashCount: r.carWashCount || 0,
          boatWashCount: r.boatWashCount || 0,
          notes: r.notes || ''
        }));
      
      await onSave(validReadings);
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving readings:', error);
    } finally {
      setSaving(false);
    }
  };

  // Reset all changes
  const handleReset = () => {
    const resetReadings = {};
    units.forEach(unit => {
      const prevReading = previousReadings?.[unit.unitId];
      resetReadings[unit.unitId] = {
        unitId: unit.unitId,
        meterNumber: unit.meterNumber || '',
        currentReading: '',
        previousReading: prevReading?.reading || 0,
        previousDate: prevReading?.readingDate || null,
        consumption: 0,
        carWashCount: 0,
        boatWashCount: 0,
        notes: ''
      };
    });
    setReadings(resetReadings);
    setErrors({});
    setWarnings({});
    setIsDirty(false);
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    const filledCount = Object.values(readings).filter(r => r.currentReading).length;
    const totalConsumption = Object.values(readings).reduce((sum, r) => sum + (r.consumption || 0), 0);
    const avgConsumption = filledCount > 0 ? totalConsumption / filledCount : 0;
    
    return {
      total: units.length,
      filled: filledCount,
      remaining: units.length - filledCount,
      totalConsumption,
      avgConsumption
    };
  }, [readings, units.length]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  console.log('🚗🛥️ ReadingEntryGrid RENDER: About to render table with NEW COLUMNS');

  return (
    <Box className="reading-entry-grid">
      {/* Summary Bar */}
      <Box className="summary-bar" mb={2}>
        <Typography variant="h6">
          Reading Date: {new Date(readingDate).toLocaleDateString()}
        </Typography>
        <Box display="flex" gap={2} mt={1}>
          <Chip 
            label={`${summary.filled} / ${summary.total} units entered`}
            color={summary.filled === summary.total ? 'success' : 'default'}
          />
          <Chip 
            label={`Total: ${summary.totalConsumption.toLocaleString()} gal`}
            icon={<FontAwesomeIcon icon={faTint} />}
          />
          <Chip 
            label={`Avg: ${Math.round(summary.avgConsumption).toLocaleString()} gal`}
          />
        </Box>
      </Box>

      {/* Action Buttons */}
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Box>
          {Object.keys(warnings).length > 0 && (
            <Alert severity="warning" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px' }} />
              {Object.keys(warnings).length} units with warnings
            </Alert>
          )}
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={!isDirty || saving}
            startIcon={<FontAwesomeIcon icon={faUndo} />}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isDirty || saving || Object.keys(errors).length > 0}
            startIcon={saving ? <CircularProgress size={16} /> : <FontAwesomeIcon icon={faSave} />}
          >
            Save Readings ({summary.filled})
          </Button>
        </Box>
      </Box>

      {/* Data Entry Table */}
      <TableContainer component={Paper} className="entry-table-container">
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Unit</TableCell>
              <TableCell>Meter #</TableCell>
              <TableCell align="right">Previous Reading</TableCell>
              <TableCell align="right">Previous Date</TableCell>
              <TableCell align="right">Current Reading</TableCell>
              <TableCell align="right">Consumption</TableCell>
              <TableCell align="center">Car Washes</TableCell>
              <TableCell align="center">Boat Washes</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {units.map(unit => {
              const reading = readings[unit.unitId] || {};
              const hasError = errors[unit.unitId];
              const hasWarning = warnings[unit.unitId];
              
              return (
                <TableRow 
                  key={unit.unitId}
                  className={hasError ? 'error-row' : hasWarning ? 'warning-row' : ''}
                >
                  <TableCell>
                    <strong>{unit.unitId}</strong>
                  </TableCell>
                  <TableCell>{reading.meterNumber || '-'}</TableCell>
                  <TableCell align="right">
                    {reading.previousReading ? reading.previousReading.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {reading.previousDate 
                      ? new Date(reading.previousDate).toLocaleDateString() 
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={reading.currentReading || ''}
                      onChange={(e) => handleReadingChange(unit.unitId, e.target.value)}
                      error={hasError}
                      helperText={hasError || hasWarning}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">gal</InputAdornment>,
                      }}
                      sx={{ width: '150px' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {reading.consumption > 0 && (
                      <Typography 
                        variant="body2" 
                        color={reading.consumption > 10000 ? 'error' : 'textPrimary'}
                      >
                        {reading.consumption.toLocaleString()} gal
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      type="number"
                      value={reading.carWashCount || ''}
                      onChange={(e) => handleCarWashChange(unit.unitId, e.target.value)}
                      inputProps={{ min: 0, step: 1, max: 99 }}
                      sx={{ width: '80px' }}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      type="number"
                      value={reading.boatWashCount || ''}
                      onChange={(e) => handleBoatWashChange(unit.unitId, e.target.value)}
                      inputProps={{ min: 0, step: 1, max: 99 }}
                      sx={{ width: '80px' }}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={reading.notes || ''}
                      onChange={(e) => {
                        setReadings(prev => ({
                          ...prev,
                          [unit.unitId]: {
                            ...prev[unit.unitId],
                            notes: e.target.value
                          }
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="Optional notes"
                      sx={{ width: '200px' }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ReadingEntryGrid;