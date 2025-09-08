import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  LinearProgress,
  IconButton,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CloudUpload,
  AttachFile,
  Delete,
  Close,
  Description,
  Image,
  PictureAsPdf
} from '@mui/icons-material';
import { clientAPI } from '../../services/api';

const DocumentUploader = ({ 
  clientId, 
  documentType = 'receipt', 
  category = 'expense_receipt',
  linkedTo = null,
  onUploadComplete = () => {},
  onUploadError = () => {},
  onFilesSelected = () => {}, // New prop for file selection without upload
  selectedFiles: externalSelectedFiles = null, // Allow external control of selected files
  onFileRemove = () => {}, // New prop for removing files
  maxFileSize = 10, // MB
  allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  multiple = false,
  showMetadataDialog = false,
  uploadMode = 'immediate', // 'immediate' or 'deferred' - new prop
  disabled = false // New prop for disabling the component
}) => {
  // Use external files if provided, otherwise use internal state
  const [internalSelectedFiles, setInternalSelectedFiles] = useState([]);
  const selectedFiles = externalSelectedFiles !== null ? externalSelectedFiles : internalSelectedFiles;
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [uploadMetadata, setUploadMetadata] = useState({
    notes: '',
    tags: '',
    category: category,
    documentType: documentType
  });
  
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') {
      return <PictureAsPdf color="error" />;
    } else if (mimeType.startsWith('image/')) {
      return <Image color="primary" />;
    } else {
      return <Description color="action" />;
    }
  };

  const validateFile = (file) => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Check file size
    const maxBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${maxFileSize} MB)`;
    }

    return null;
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setError('');

    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    if (multiple) {
      const newFiles = [...selectedFiles, ...validFiles];
      if (externalSelectedFiles !== null) {
        // External control - notify parent
        onFilesSelected(newFiles);
      } else {
        // Internal control
        setInternalSelectedFiles(newFiles);
      }
    } else {
      const newFiles = validFiles.slice(0, 1);
      if (externalSelectedFiles !== null) {
        // External control - notify parent
        onFilesSelected(newFiles);
      } else {
        // Internal control
        setInternalSelectedFiles(newFiles);
      }
    }

    // Show metadata dialog if enabled and in immediate mode
    if (showMetadataDialog && validFiles.length > 0 && uploadMode === 'immediate') {
      setMetadataDialogOpen(true);
    }
  };

  const handleRemoveFile = (index) => {
    if (externalSelectedFiles !== null) {
      // External control - notify parent
      onFileRemove(index);
    } else {
      // Internal control
      setInternalSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const uploadPromises = selectedFiles.map(async (file, index) => {
        const metadata = {
          documentType: uploadMetadata.documentType,
          category: uploadMetadata.category,
          linkedTo: linkedTo,
          notes: uploadMetadata.notes,
          tags: uploadMetadata.tags ? uploadMetadata.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
        };

        try {
          const result = await clientAPI.uploadDocument(clientId, file, metadata);
          setUploadProgress(((index + 1) / selectedFiles.length) * 100);
          return result;
        } catch (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }
      });

      const results = await Promise.all(uploadPromises);
      
      console.log('✅ All files uploaded successfully:', results);
      onUploadComplete(results);
      
      // Reset state - only if using internal control
      if (externalSelectedFiles === null) {
        setInternalSelectedFiles([]);
      }
      setUploadMetadata({
        notes: '',
        tags: '',
        category: category,
        documentType: documentType
      });
      setMetadataDialogOpen(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      setError(uploadError.message);
      onUploadError(uploadError);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    
    // Create a mock event for handleFileSelect
    handleFileSelect({ target: { files } });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <Box>
      {/* File Drop Zone */}
      <Paper
        elevation={1}
        sx={{
          p: 3,
          border: '2px dashed #ccc',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          bgcolor: disabled ? 'grey.200' : 'grey.50',
          '&:hover': disabled ? {} : {
            bgcolor: 'grey.100',
            borderColor: 'primary.main'
          },
          opacity: disabled ? 0.6 : 1
        }}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {selectedFiles.length > 0 ? 'Add More Files' : 'Upload Document'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Drag and drop files here, or click to select
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Max size: {maxFileSize}MB • Allowed: PDF, Images
        </Typography>
        
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple={multiple}
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </Paper>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Files ({selectedFiles.length})
          </Typography>
          {selectedFiles.map((file, index) => (
            <Paper key={index} elevation={1} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ mr: 2 }}>
                {getFileIcon(file.type)}
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" noWrap>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(file.size)} • {file.type}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleRemoveFile(index)}
                disabled={uploading || disabled}
              >
                <Delete />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Uploading... {Math.round(uploadProgress)}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* Upload Button - only show in immediate mode */}
      {uploadMode === 'immediate' && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={showMetadataDialog ? () => setMetadataDialogOpen(true) : handleUpload}
            disabled={selectedFiles.length === 0 || uploading || disabled}
            startIcon={<CloudUpload />}
            fullWidth
          >
            {uploading ? 'Uploading...' : 'Upload Documents'}
          </Button>
        </Box>
      )}

      {/* Metadata Dialog */}
      <Dialog 
        open={metadataDialogOpen} 
        onClose={() => setMetadataDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Document Details
          <IconButton
            onClick={() => setMetadataDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={uploadMetadata.documentType}
                label="Document Type"
                onChange={(e) => setUploadMetadata(prev => ({ ...prev, documentType: e.target.value }))}
              >
                <MenuItem value="receipt">Receipt</MenuItem>
                <MenuItem value="invoice">Invoice</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="quote">Quote</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={uploadMetadata.category}
                label="Category"
                onChange={(e) => setUploadMetadata(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="expense_receipt">Expense Receipt</MenuItem>
                <MenuItem value="income_receipt">Income Receipt</MenuItem>
                <MenuItem value="project_quote">Project Quote</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Notes"
              multiline
              rows={3}
              value={uploadMetadata.notes}
              onChange={(e) => setUploadMetadata(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this document..."
            />

            <TextField
              label="Tags"
              value={uploadMetadata.tags}
              onChange={(e) => setUploadMetadata(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="tag1, tag2, tag3"
              helperText="Separate tags with commas"
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setMetadataDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} variant="contained" disabled={uploading}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentUploader;
