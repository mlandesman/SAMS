import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
} from '@mui/material';
import {
  Download as DownloadIcon,
  FolderOpen as ArchiveIcon,
  NoteAdd as GenerateIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSessionPreferences } from '../../context/SessionPreferencesContext.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { config } from '../../config/index.js';
import { auth, db } from '../../services/firebase';
import { LoadingSpinner } from '../common';
import {
  buildDedupedStoredStatementsForUi,
  filterDedupedStatementsByUiLanguage,
} from '../../utils/storedStatementLabels.js';

const API_BASE_URL = config.api.baseUrl;

const StatementPdfViewer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentClient, firebaseUser } = useAuth();
  const { statementLanguageApi, preferredLanguageUi } = useSessionPreferences();
  const { selectedUnitId } = useSelectedUnit();

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  // Stored statements state
  const [storedStatements, setStoredStatements] = useState([]);
  const [storedLoading, setStoredLoading] = useState(false);
  const [selectedStored, setSelectedStored] = useState('');

  // Generate state
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfSource, setPdfSource] = useState(null); // 'stored' | 'generated'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pdfSourceRef = useRef(pdfSource);
  const pdfUrlRef = useRef(pdfUrl);
  pdfSourceRef.current = pdfSource;
  pdfUrlRef.current = pdfUrl;

  // Fetch stored statement metadata from Firestore
  const fetchStoredStatements = useCallback(async () => {
    if (!clientId || !selectedUnitId) return;

    try {
      setStoredLoading(true);
      const statementsRef = collection(db, 'clients', clientId, 'accountStatements');
      const q = query(
        statementsRef,
        where('unitId', '==', selectedUnitId),
        orderBy('calendarYear', 'desc'),
        orderBy('calendarMonth', 'desc'),
      );
      const snapshot = await getDocs(q);
      const statements = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        statements.push({ id: doc.id, ...data });
      });
      setStoredStatements(statements);
    } catch (err) {
      console.error('Error fetching stored statements:', err);
      setStoredStatements([]);
    } finally {
      setStoredLoading(false);
    }
  }, [clientId, selectedUnitId]);

  useEffect(() => {
    fetchStoredStatements();
  }, [fetchStoredStatements]);

  // Reset viewer state when unit changes
  useEffect(() => {
    setPdfUrl((prev) => {
      if (prev && pdfSource === 'generated') URL.revokeObjectURL(prev);
      return null;
    });
    setPdfSource(null);
    setSelectedStored('');
    setError(null);
  }, [selectedUnitId]);

  useEffect(() => {
    return () => {
      if (pdfUrl && pdfSource === 'generated') URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl, pdfSource]);

  const storedOptionsAll = buildDedupedStoredStatementsForUi(storedStatements);
  const storedOptions = filterDedupedStatementsByUiLanguage(storedOptionsAll, preferredLanguageUi);

  useEffect(() => {
    const allowed = new Set(storedOptions.map((s) => s.id));
    if (selectedStored && !allowed.has(selectedStored)) {
      setSelectedStored('');
    }
  }, [storedOptions, selectedStored]);

  // Deep-link from My Unit (and similar): open stored PDF in-app like this screen's iframe viewer
  useEffect(() => {
    const openId = location.state?.openStoredStatementId;
    if (!openId || storedLoading) return;

    if (!storedStatements.length) {
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    const statement = storedStatements.find((s) => s.id === openId);

    navigate(location.pathname, { replace: true, state: {} });

    if (!statement?.storageUrl) return;

    if (pdfUrlRef.current && pdfSourceRef.current === 'generated') {
      URL.revokeObjectURL(pdfUrlRef.current);
    }
    setPdfUrl(statement.storageUrl);
    setPdfSource('stored');
    setSelectedStored(openId);
    setError(null);
  }, [storedStatements, storedLoading, location.state, location.pathname, navigate]);

  const handleOpenStored = () => {
    if (!selectedStored) return;
    const statement = storedStatements.find((s) => s.id === selectedStored);
    if (!statement?.storageUrl) return;

    if (pdfUrl && pdfSource === 'generated') URL.revokeObjectURL(pdfUrl);
    setPdfUrl(statement.storageUrl);
    setPdfSource('stored');
    setError(null);
  };

  const handleGenerateCurrent = async () => {
    if (!clientId || !selectedUnitId) return;

    try {
      setLoading(true);
      setError(null);
      if (pdfUrl && pdfSource === 'generated') {
        URL.revokeObjectURL(pdfUrl);
      }
      setPdfUrl(null);
      setPdfSource(null);

      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('No authenticated user');

      const token = await user.getIdToken();
      const url = `${API_BASE_URL}/reports/${clientId}/statement/pdf?unitId=${selectedUnitId}&language=${statementLanguageApi}`;

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
      setPdfSource('generated');
    } catch (err) {
      console.error('Error generating statement PDF:', err);
      setError(err.message || 'Failed to generate statement');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `statement_${clientId}_${selectedUnitId}.pdf`;
    link.click();
  };

  if (!selectedUnitId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No unit selected. Please select a unit from the menu.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>

      {/* Section 1: Stored Statements */}
      <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ArchiveIcon sx={{ fontSize: 18, color: '#666' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#444' }}>
              Stored Statements
            </Typography>
          </Box>

          {storedLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
              <LoadingSpinner size="small" message="Loading..." />
            </Box>
          ) : storedOptions.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No stored statements found for this unit.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Month / Year</InputLabel>
                <Select
                  value={selectedStored}
                  label="Month / Year"
                  onChange={(e) => setSelectedStored(e.target.value)}
                >
                  {storedOptions.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                disabled={!selectedStored}
                onClick={handleOpenStored}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                Open
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Generate Current */}
      <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GenerateIcon sx={{ fontSize: 18, color: '#666' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#444' }}>
              Generate Current Statement
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Uses your menu language ({preferredLanguageUi === 'ES' ? 'Español' : 'English'}). Change in the sidebar menu under Language / Idioma.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleGenerateCurrent}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Loading spinner for generation */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <LoadingSpinner size="medium" message="Generating statement..." />
        </Box>
      )}

      {/* PDF viewer */}
      {!loading && pdfUrl && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ textTransform: 'none' }}
            >
              Download
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

      {/* Initial state */}
      {!loading && !pdfUrl && !error && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#999' }}>
          <Typography variant="body2">
            Select a stored statement or generate a current one.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default StatementPdfViewer;
