import React from 'react';
import { Box, Chip, Select, MenuItem, FormControl } from '@mui/material';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';

const UnitSwitcher = () => {
  const { selectedUnitId, setSelectedUnitId, availableUnits } = useSelectedUnit();

  if (!availableUnits || availableUnits.length === 0) return null;

  if (availableUnits.length === 1) {
    return (
      <Box sx={{ mb: 2 }}>
        <Chip
          label={`Unit ${availableUnits[0].unitId}`}
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.9rem' }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <FormControl size="small" fullWidth>
        <Select
          value={selectedUnitId || ''}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          displayEmpty
          sx={{ fontWeight: 600 }}
        >
          {availableUnits.map((u) => (
            <MenuItem key={u.unitId} value={u.unitId}>
              Unit {u.unitId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default UnitSwitcher;
