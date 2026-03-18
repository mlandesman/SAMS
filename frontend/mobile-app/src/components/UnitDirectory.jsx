/**
 * Unit Directory - Mobile PWA
 * Admin-only directory of all units with owner/manager contact info
 * NRM7: Displays unit number, owner/manager names, emails, phones (tappable)
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  Chip,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useClients } from '../hooks/useClients.jsx';
import { config } from '../config/index.js';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import { LoadingSpinner } from './common';

const formatContact = (owners, managers) => {
  const o = normalizeOwners(owners || []);
  const m = normalizeManagers(managers || []);
  const ownerStr = o.map(x => x.name).filter(Boolean).join(', ') || '—';
  const managerStr = m.map(x => x.name).filter(Boolean).join(', ') || '—';
  return { owners: o, managers: m, ownerStr, managerStr };
};

const UnitDirectory = () => {
  const { firebaseUser } = useAuth();
  const { clients, selectedClientId, selectClient, selectedClient } = useClients();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clientId = selectedClientId || selectedClient?.id;

  useEffect(() => {
    if (!firebaseUser || !clientId) {
      setUnits([]);
      setLoading(false);
      return;
    }
    const fetchUnits = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await firebaseUser.getIdToken();
        const response = await fetch(
          `${config.api.baseUrl}/clients/${clientId}/units`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const list = data.data || data || [];
        setUnits(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('UnitDirectory fetch error:', err);
        setError(err.message || 'Failed to load units');
        setUnits([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, [firebaseUser, clientId]);

  const sortedUnits = [...units].sort((a, b) => {
    const idA = (a.unitId || a.unitNumber || a.id || '').toString();
    const idB = (b.unitId || b.unitNumber || b.id || '').toString();
    return idA.localeCompare(idB, undefined, { numeric: true });
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', p: 3 }}>
        <LoadingSpinner size="medium" message="Loading unit directory..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pb: 8 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Unit Directory</Typography>

      {clients.length > 1 && (
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <Select
            value={clientId || ''}
            onChange={(e) => selectClient(e.target.value)}
            displayEmpty
            renderValue={(v) => {
              const c = clients.find(x => x.id === v);
              return c ? (c.name || c.id) : 'Select client';
            }}
          >
            {clients.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name || c.id}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {!clientId ? (
        <Typography color="text.secondary">Select a client to view units.</Typography>
      ) : sortedUnits.length === 0 ? (
        <Typography color="text.secondary">No units found.</Typography>
      ) : (
        <List disablePadding>
          {sortedUnits.map((unit) => {
            const { owners, managers, ownerStr, managerStr } = formatContact(unit.owners, unit.managers);
            const unitId = unit.unitId || unit.unitNumber || unit.id || '—';
            const status = unit.status || 'active';
            return (
              <ListItem
                key={unitId}
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  py: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Unit {unitId}</Typography>
                  <Chip label={status} size="small" color={status === 'active' ? 'success' : 'default'} />
                </Box>
                <Box sx={{ pl: 0 }}>
                  {owners.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">Owners</Typography>
                      {owners.map((o, i) => (
                        <Box key={i} sx={{ fontSize: '0.9rem' }}>
                          {o.name}
                          {o.email && (
                            <> · <a href={`mailto:${o.email}`} style={{ textDecoration: 'none' }}>{o.email}</a></>
                          )}
                          {o.phone && (
                            <> · <a href={`tel:${o.phone.replace(/\D/g, '')}`} style={{ textDecoration: 'none' }}>{o.phone}</a></>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                  {managers.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Managers</Typography>
                      {managers.map((m, i) => (
                        <Box key={i} sx={{ fontSize: '0.9rem' }}>
                          {m.name}
                          {m.email && (
                            <> · <a href={`mailto:${m.email}`} style={{ textDecoration: 'none' }}>{m.email}</a></>
                          )}
                          {m.phone && (
                            <> · <a href={`tel:${m.phone.replace(/\D/g, '')}`} style={{ textDecoration: 'none' }}>{m.phone}</a></>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                  {owners.length === 0 && managers.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No contacts</Typography>
                  )}
                </Box>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
};

export default UnitDirectory;
