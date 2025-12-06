import React from 'react';
import {
  Box,
  Button,
  Slide,
  Backdrop,
  Paper,
  Typography
} from '@mui/material';
import {
  Backspace as BackspaceIcon,
  Check as CheckIcon
} from '@mui/icons-material';

const NumericKeypad = ({ open, onClose, onInput, value = '' }) => {
  const handleNumberPress = (num) => {
    const currentValue = value.toString();
    const newValue = currentValue + num;
    
    // Validate max value (0-100)
    const numValue = parseInt(newValue);
    if (numValue > 100) {
      return; // Don't allow values over 100
    }
    
    onInput(newValue);
  };

  const handleBackspace = () => {
    const currentValue = value.toString();
    if (currentValue.length > 0) {
      const newValue = currentValue.slice(0, -1);
      onInput(newValue === '' ? '' : newValue);
    }
  };

  const handleDone = () => {
    onClose();
  };

  const handleClear = () => {
    onInput('');
  };

  return (
    <>
      <Backdrop
        open={open}
        onClick={handleDone}
        sx={{
          zIndex: 1300,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
      />
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1301,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            p: 2,
            pb: 4,
            maxHeight: '50vh'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Display current value */}
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1f2937' }}>
              {value || '0'}%
            </Typography>
          </Box>

          {/* Keypad Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            {/* Row 1: 1, 2, 3 */}
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('1')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              1
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('2')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              2
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('3')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              3
            </Button>

            {/* Row 2: 4, 5, 6 */}
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('4')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              4
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('5')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              5
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('6')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              6
            </Button>

            {/* Row 3: 7, 8, 9 */}
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('7')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              7
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('8')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              8
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('9')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              9
            </Button>

            {/* Row 4: Clear, 0, Backspace */}
            <Button
              variant="outlined"
              onClick={handleClear}
              sx={{
                minHeight: '60px',
                fontSize: '1rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                color: '#dc2626',
                '&:hover': {
                  borderColor: '#dc2626',
                  bgcolor: '#fee2e2'
                }
              }}
            >
              Clear
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleNumberPress('0')}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              0
            </Button>
            <Button
              variant="outlined"
              onClick={handleBackspace}
              sx={{
                minHeight: '60px',
                fontSize: '1.5rem',
                borderColor: '#e5e7eb',
                '&:hover': {
                  borderColor: '#d1d5db',
                  bgcolor: '#f9fafb'
                }
              }}
            >
              <BackspaceIcon />
            </Button>
          </Box>

          {/* Done Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<CheckIcon />}
            onClick={handleDone}
            sx={{
              mt: 2,
              minHeight: '56px',
              fontSize: '1.1rem',
              fontWeight: 600,
              bgcolor: '#10b981',
              '&:hover': {
                bgcolor: '#059669'
              }
            }}
          >
            Listo
          </Button>
        </Paper>
      </Slide>
    </>
  );
};

export default NumericKeypad;
