import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  IconButton
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileUpload, 
  faCheckCircle, 
  faTimesCircle,
  faDownload,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import './CSVImporter.css';

function CSVImporter({ open, onClose, onImport, units }) {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const steps = ['Upload File', 'Review Data', 'Import'];

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setFile(null);
      setParsedData([]);
      setErrors([]);
      setProcessing(false);
    }
  }, [open]);

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setErrors(['Please select a CSV file']);
        return;
      }
      setFile(selectedFile);
      setErrors([]);
      parseCSV(selectedFile);
    }
  };

  // Parse CSV file
  const parseCSV = (csvFile) => {
    setProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setErrors(['CSV file must have a header row and at least one data row']);
          setProcessing(false);
          return;
        }
        
        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Validate required columns
        const requiredColumns = ['unit', 'reading'];
        const hasRequiredColumns = requiredColumns.every(col => 
          header.some(h => h.includes(col))
        );
        
        if (!hasRequiredColumns) {
          setErrors(['CSV must have "unit" and "reading" columns']);
          setProcessing(false);
          return;
        }
        
        // Find column indices
        const unitIndex = header.findIndex(h => h.includes('unit'));
        const readingIndex = header.findIndex(h => h.includes('reading'));
        const notesIndex = header.findIndex(h => h.includes('note'));
        
        // Parse data rows
        const data = [];
        const parseErrors = [];
        
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.trim());
          
          if (row.length < 2) continue;
          
          const unitId = row[unitIndex];
          const reading = parseFloat(row[readingIndex]);
          const notes = notesIndex >= 0 ? row[notesIndex] : '';
          
          // Validate unit exists
          const unitExists = units.some(u => u.unitId === unitId);
          
          if (!unitExists) {
            parseErrors.push(`Line ${i + 1}: Unit ${unitId} not found`);
            continue;
          }
          
          if (isNaN(reading) || reading < 0) {
            parseErrors.push(`Line ${i + 1}: Invalid reading for unit ${unitId}`);
            continue;
          }
          
          data.push({
            unitId,
            reading,
            notes,
            line: i + 1
          });
        }
        
        if (data.length === 0) {
          setErrors(['No valid data found in CSV']);
        } else {
          setParsedData(data);
          setErrors(parseErrors);
          setActiveStep(1);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setErrors(['Error parsing CSV file: ' + error.message]);
      } finally {
        setProcessing(false);
      }
    };
    
    reader.onerror = () => {
      setErrors(['Error reading file']);
      setProcessing(false);
    };
    
    reader.readAsText(csvFile);
  };

  // Handle import
  const handleImport = async () => {
    setProcessing(true);
    try {
      await onImport(parsedData);
      setActiveStep(2);
    } catch (error) {
      setErrors(['Import failed: ' + error.message]);
    } finally {
      setProcessing(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const csv = 'Unit,Reading,Notes\n101,12345,Monthly reading\n102,23456,\n103,34567,High usage';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'water_reading_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Import Water Meter Readings from CSV</Typography>
          <IconButton onClick={onClose} size="small">
            <FontAwesomeIcon icon={faTimes} />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Upload File */}
        {activeStep === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Upload a CSV file with columns: Unit, Reading, Notes (optional)
            </Alert>
            
            <Box className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              <FontAwesomeIcon icon={faFileUpload} size="3x" />
              <Typography variant="h6" sx={{ mt: 2 }}>
                {file ? file.name : 'Click to select CSV file'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                or drag and drop file here
              </Typography>
            </Box>
            
            <Box display="flex" justifyContent="center" mt={2}>
              <Button
                variant="outlined"
                startIcon={<FontAwesomeIcon icon={faDownload} />}
                onClick={downloadTemplate}
              >
                Download Template
              </Button>
            </Box>
            
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors.map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </Alert>
            )}
          </Box>
        )}

        {/* Step 1: Review Data */}
        {activeStep === 1 && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Found {parsedData.length} valid readings ready to import
            </Alert>
            
            {errors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Skipped {errors.length} rows:</Typography>
                {errors.slice(0, 5).map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
                {errors.length > 5 && (
                  <div>... and {errors.length - 5} more</div>
                )}
              </Alert>
            )}
            
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">Reading</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.unitId}</TableCell>
                      <TableCell align="right">{row.reading.toLocaleString()}</TableCell>
                      <TableCell>{row.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {parsedData.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        ... and {parsedData.length - 50} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Step 2: Import Complete */}
        {activeStep === 2 && (
          <Box textAlign="center" py={4}>
            <FontAwesomeIcon icon={faCheckCircle} size="4x" color="#4caf50" />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Import Successful!
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
              {parsedData.length} readings have been imported successfully
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {activeStep === 0 && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
            >
              Select File
            </Button>
          </>
        )}
        
        {activeStep === 1 && (
          <>
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handleImport}
              disabled={processing || parsedData.length === 0}
              startIcon={processing && <CircularProgress size={16} />}
            >
              Import {parsedData.length} Readings
            </Button>
          </>
        )}
        
        {activeStep === 2 && (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default CSVImporter;