import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import propaneAPI from '../../api/propaneAPI';

// Color coding functions
const getLevelColor = (level) => {
  if (level === null || level === undefined) return '#ffffff';
  if (level <= 10) return '#fecaca';  // Red background (critical)
  if (level <= 30) return '#fef3c7';  // Amber background (low)
  return '#d1fae5';                    // Green background (ok)
};

const getLevelTextColor = (level) => {
  if (level === null || level === undefined) return '#6b7280';
  if (level <= 10) return '#dc2626';  // Red text
  if (level <= 30) return '#d97706';  // Amber text
  return '#059669';                    // Green text
};

// Month names in Spanish (fiscal year starts January, so month 0 = January)
const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Month names in English
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Get month names based on language preference
const getMonthNames = (language) => {
  const lang = (language || '').toLowerCase();
  return lang === 'spanish' || lang === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN;
};

// Get localized text based on language preference
const getLocalizedText = (language) => {
  const lang = (language || '').toLowerCase();
  const isSpanish = lang === 'spanish' || lang === 'es';
  
  return {
    monthLabel: isSpanish ? 'Mes' : 'Month',
    noData: isSpanish 
      ? `No hay datos disponibles para el año` 
      : `No data available for year`,
    critical: isSpanish ? 'Crítico (0-10%)' : 'Critical (0-10%)',
    low: isSpanish ? 'Bajo (10-30%)' : 'Low (10-30%)',
    ok: isSpanish ? 'OK (30-100%)' : 'OK (30-100%)'
  };
};

const PropaneHistoryTable = ({ clientId, year, onYearChange, hideYearNavigation = false }) => {
  const { samsUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [yearData, setYearData] = useState(null);
  const [config, setConfig] = useState(null);
  const [selectedYear, setSelectedYear] = useState(year);
  
  // Get user's language preference (default to English if not set)
  const userLanguage = samsUser?.language || samsUser?.preferredLanguage || 'english';
  const monthNames = getMonthNames(userLanguage);
  const t = getLocalizedText(userLanguage);

  useEffect(() => {
    loadData();
  }, [clientId, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load config and year data in parallel
      const [configData, dataResponse] = await Promise.all([
        propaneAPI.getConfig(clientId),
        propaneAPI.getAggregatedData(clientId, selectedYear)
      ]);

      setConfig(configData.data);
      setYearData(dataResponse);
    } catch (error) {
      console.error('Error loading propane data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (delta) => {
    const newYear = selectedYear + delta;
    setSelectedYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!yearData || !yearData.data || !yearData.data.months) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {t.noData} {selectedYear}
        </Typography>
      </Box>
    );
  }

  const units = config?.units || [];
  const months = yearData.data.months || [];

  // Build unit order (use workerRouteOrder if available, otherwise use units array order)
  const unitOrder = config?.workerRouteOrder || units.map(u => u.id);

  // Get owner names from config
  const getOwnerName = (unitId) => {
    const unit = units.find(u => u.id === unitId);
    // Owner name might be in different places depending on config structure
    return unit?.owner || unit?.ownerName || '';
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Year Navigation - only show if not hidden (now in ActionBar) */}
      {!hideYearNavigation && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, gap: 2 }}>
          <IconButton onClick={() => handleYearChange(-1)}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700, minWidth: '100px', textAlign: 'center' }}>
            {selectedYear}
          </Typography>
          <IconButton onClick={() => handleYearChange(1)}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}

      {/* History Table */}
      <TableContainer component={Paper} sx={{ maxHeight: '80vh', overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ 
                  bgcolor: '#f9fafb', 
                  fontWeight: 700, 
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  minWidth: '120px'
                }}
              >
                {t.monthLabel}
              </TableCell>
              {unitOrder.map((unitId) => (
                <TableCell
                  key={unitId}
                  align="center"
                  sx={{ 
                    bgcolor: '#f9fafb', 
                    fontWeight: 700,
                    minWidth: '100px'
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {unitId}
                    </Typography>
                    {getOwnerName(unitId) && (
                      <Typography variant="caption" color="text.secondary">
                        {getOwnerName(unitId)}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {months.map((monthData) => {
              const monthName = monthNames[monthData.month] || `${t.monthLabel} ${monthData.month + 1}`;
              
              return (
                <TableRow key={`${monthData.year}-${monthData.month}`} hover>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      bgcolor: 'white',
                      zIndex: 2,
                      fontWeight: 600
                    }}
                  >
                    {monthName}
                  </TableCell>
                  {unitOrder.map((unitId) => {
                    const reading = monthData.readings[unitId];
                    const level = reading?.level || null;
                    const bgColor = getLevelColor(level);
                    const textColor = getLevelTextColor(level);
                    
                    return (
                      <TableCell
                        key={unitId}
                        align="center"
                        sx={{
                          bgcolor: bgColor,
                          color: textColor,
                          fontWeight: 600
                        }}
                      >
                        {level !== null && level !== undefined ? `${level}%` : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Legend */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 24, height: 24, bgcolor: '#fecaca', borderRadius: 1 }} />
          <Typography variant="body2">{t.critical}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 24, height: 24, bgcolor: '#fef3c7', borderRadius: 1 }} />
          <Typography variant="body2">{t.low}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 24, height: 24, bgcolor: '#d1fae5', borderRadius: 1 }} />
          <Typography variant="body2">{t.ok}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PropaneHistoryTable;
