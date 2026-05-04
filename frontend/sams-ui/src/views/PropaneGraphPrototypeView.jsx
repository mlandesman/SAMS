import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useClient } from '../context/ClientContext';
import propaneAPI from '../api/propaneAPI';

const MONTH_OPTIONS = [
  { value: 0, label: 'Jan (0)' },
  { value: 1, label: 'Feb (1)' },
  { value: 2, label: 'Mar (2)' },
  { value: 3, label: 'Apr (3)' },
  { value: 4, label: 'May (4)' },
  { value: 5, label: 'Jun (5)' },
  { value: 6, label: 'Jul (6)' },
  { value: 7, label: 'Aug (7)' },
  { value: 8, label: 'Sep (8)' },
  { value: 9, label: 'Oct (9)' },
  { value: 10, label: 'Nov (10)' },
  { value: 11, label: 'Dec (11)' },
];

const DEFAULT_AS_OF_MONTH = new Date().getMonth();
const DEFAULT_AS_OF_YEAR = new Date().getFullYear();

function PropaneGraphPrototypeView() {
  const { selectedClient } = useClient();
  const [config, setConfig] = useState(null);
  const [unitId, setUnitId] = useState('');
  const [svg, setSvg] = useState('');
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(6);
  const [useAsOf, setUseAsOf] = useState(false);
  const [asOfYear, setAsOfYear] = useState(DEFAULT_AS_OF_YEAR);
  const [asOfMonth, setAsOfMonth] = useState(DEFAULT_AS_OF_MONTH);

  const clientId = selectedClient?.id;

  const orderedUnitIds = useMemo(() => {
    if (!config) return [];
    const units = Array.isArray(config.units) ? config.units : [];
    const unitIds = units.map((unit) => unit.id).filter(Boolean);
    const routeOrder = Array.isArray(config.workerRouteOrder) ? config.workerRouteOrder : [];
    const routeIds = routeOrder.filter((id) => unitIds.includes(id));
    const remainder = unitIds.filter((id) => !routeIds.includes(id));
    return [...routeIds, ...remainder];
  }, [config]);

  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      if (!clientId) return;
      setError('');
      try {
        const response = await propaneAPI.getConfig(clientId);
        if (!isMounted) return;
        const propaneConfig = response?.data || null;
        setConfig(propaneConfig);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || 'Failed to load propane config');
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!unitId && orderedUnitIds.length > 0) {
      setUnitId(orderedUnitIds[0]);
    }
  }, [orderedUnitIds, unitId]);

  const fetchPrototype = async () => {
    if (!clientId || !unitId) return;
    setLoading(true);
    setError('');

    try {
      const options = { months };
      if (useAsOf) {
        options.asOfYear = Number(asOfYear);
        options.asOfMonth = Number(asOfMonth);
      }

      const [svgMarkup, pointsResponse] = await Promise.all([
        propaneAPI.getSixMonthGraphSvg(clientId, unitId, options),
        propaneAPI.getSixMonthGraphData(clientId, unitId, options),
      ]);

      setSvg(svgMarkup);
      setLevels(pointsResponse?.data?.levels || []);
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load prototype graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId && unitId) {
      fetchPrototype();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, unitId]);

  if (!clientId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Select a client to preview the propane SVG prototype.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
        Propane Graph Prototype (Stage 1)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Standalone prototype endpoint with real data, isolated from Statement of Account.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="prototype-unit-label">Unit</InputLabel>
            <Select
              labelId="prototype-unit-label"
              value={unitId}
              label="Unit"
              onChange={(event) => setUnitId(event.target.value)}
            >
              {orderedUnitIds.map((id) => (
                <MenuItem key={id} value={id}>
                  {id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="number"
            label="Months"
            value={months}
            onChange={(event) => setMonths(Math.max(1, Number(event.target.value) || 1))}
            inputProps={{ min: 1, max: 12 }}
            sx={{ width: 120 }}
          />

          <Button
            variant={useAsOf ? 'contained' : 'outlined'}
            onClick={() => setUseAsOf((prev) => !prev)}
          >
            {useAsOf ? 'As-Of ON' : 'As-Of OFF'}
          </Button>

          {useAsOf && (
            <>
              <TextField
                size="small"
                type="number"
                label="As-Of Year"
                value={asOfYear}
                onChange={(event) => setAsOfYear(Number(event.target.value) || DEFAULT_AS_OF_YEAR)}
                sx={{ width: 130 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="asof-month-label">As-Of Month</InputLabel>
                <Select
                  labelId="asof-month-label"
                  value={asOfMonth}
                  label="As-Of Month"
                  onChange={(event) => setAsOfMonth(Number(event.target.value))}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <Button variant="contained" onClick={fetchPrototype} disabled={loading || !unitId}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          SVG Output
        </Typography>
        <Box
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: 1,
            p: 1,
            minHeight: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#ffffff',
          }}
        >
          {svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <Typography color="text.secondary">No SVG generated yet.</Typography>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Data Points Used
        </Typography>
        {levels.length === 0 ? (
          <Typography color="text.secondary">No readings returned.</Typography>
        ) : (
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            {levels.map((row) => (
              <li key={`${row.year}-${row.month}-${row.level}`}>
                <Typography variant="body2">
                  {row.year}-{String(row.month).padStart(2, '0')}: {row.level}%
                </Typography>
              </li>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default PropaneGraphPrototypeView;

