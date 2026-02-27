import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';

const API_BASE_URL = config.api.baseUrl;

const StatementPdfViewer = () => {
  const { currentClient, firebaseUser } = useAuth();
  const { selectedUnitId, availableUnits, setSelectedUnitId } = useSelectedUnit();

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const currentYear = new Date().getFullYear();

  const [language, setLanguage] = useState('english');
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    yearOptions.push(y);
  }

  const fetchPdf = useCallback(async () => {
    if (!clientId || !selectedUnitId) return;

    try {
      setLoading(true);
      setError(null);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }

      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('No authenticated user');

      const token = await user.getIdToken();
      const url = `${API_BASE_URL}/reports/${clientId}/statement/pdf?unitId=${selectedUnitId}&fiscalYear=${fiscalYear}&language=${language}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg;
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || `HTTP ${response.status}`;
        } catch {
          errorMsg = `HTTP ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (err) {
      console.error('Error fetching statement PDF:', err);
      setError(err.message || 'Failed to load statement');
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedUnitId, fiscalYear, language, firebaseUser]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `statement_${clientId}_${selectedUnitId}_${fiscalYear}_${language}.pdf`;
    link.click();
  };

  if (!selectedUnitId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No unit selected. Please select a unit from the Dashboard.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {/* Controls */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        {/* Unit switcher (if multiple units) */}
        {availableUnits.length > 1 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Unit</InputLabel>
            <Select
              value={selectedUnitId || ''}
              label="Unit"
              onChange={(e) => setSelectedUnitId(e.target.value)}
            >
              {availableUnits.map((u) => (
                <MenuItem key={u.unitId} value={u.unitId}>Unit {u.unitId}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Fiscal year */}
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select value={fiscalYear} label="Year" onChange={(e) => setFiscalYear(e.target.value)}>
              {yearOptions.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Language toggle */}
          <ToggleButtonGroup
            value={language}
            exclusive
            onChange={(_, val) => { if (val) setLanguage(val); }}
            size="small"
          >
            <ToggleButton value="english" sx={{ textTransform: 'none', px: 2 }}>English</ToggleButton>
            <ToggleButton value="spanish" sx={{ textTransform: 'none', px: 2 }}>Español</ToggleButton>
          </ToggleButtonGroup>

          {/* Generate / Refresh button */}
          <Button
            variant="contained"
            size="small"
            onClick={fetchPdf}
            disabled={loading}
            startIcon={pdfUrl ? <RefreshIcon /> : undefined}
            sx={{ ml: 'auto', textTransform: 'none' }}
          >
            {pdfUrl ? 'Refresh' : 'Generate'}
          </Button>
        </Box>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Generating statement...
          </Typography>
        </Box>
      )}

      {/* PDF viewer */}
      {!loading && pdfUrl && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ textTransform: 'none' }}
            >
              Download PDF
            </Button>
          </Box>
          <Box sx={{ flex: 1, border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
            <iframe
              src={pdfUrl}
              title="Statement of Account"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </Box>
        </Box>
      )}

      {/* Initial state — no PDF yet */}
      {!loading && !pdfUrl && !error && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#999' }}>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Select year and language, then tap Generate.
          </Typography>
          <Typography variant="caption">
            Unit {selectedUnitId}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default StatementPdfViewer;
