import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Stack
} from '@mui/material';
import {
  Refresh,
  FilterList,
  Clear
} from '@mui/icons-material';
import { clientAPI } from '../../services/api';
import DocumentViewer from './DocumentViewer';

const DocumentList = ({
  clientId,
  filterBy = {},
  sortBy = 'uploadedAt',
  showThumbnails = false,
  compact = false,
  showFilters = true,
  onDocumentDelete = () => {}
}) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    documentType: filterBy.documentType || '',
    category: filterBy.category || '',
    searchTerm: '',
    ...filterBy
  });

  useEffect(() => {
    if (clientId) {
      loadDocuments();
    }
  }, [clientId, filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      
      const apiFilters = {
        ...filters,
        limit: 50
      };
      
      // Remove empty filters
      Object.keys(apiFilters).forEach(key => {
        if (!apiFilters[key]) {
          delete apiFilters[key];
        }
      });

      const result = await clientAPI.getDocuments(clientId, apiFilters);
      let docs = result.documents || [];

      // Client-side filtering for search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        docs = docs.filter(doc => 
          (doc.originalName || doc.filename || '').toLowerCase().includes(searchLower) ||
          (doc.notes || '').toLowerCase().includes(searchLower) ||
          (doc.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Client-side sorting
      docs.sort((a, b) => {
        switch (sortBy) {
          case 'uploadedAt':
            return new Date(b.uploadedAt) - new Date(a.uploadedAt);
          case 'filename':
            const aName = a.originalName || a.filename || '';
            const bName = b.originalName || b.filename || '';
            return aName.localeCompare(bName);
          case 'fileSize':
            return (b.fileSize || 0) - (a.fileSize || 0);
          default:
            return 0;
        }
      });

      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      documentType: filterBy.documentType || '',
      category: filterBy.category || '',
      searchTerm: '',
      ...filterBy
    });
  };

  const handleDocumentDelete = (documentId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    onDocumentDelete(documentId);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.documentType && !filterBy.documentType) count++;
    if (filters.category && !filterBy.category) count++;
    if (filters.searchTerm) count++;
    return count;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button size="small" onClick={loadDocuments} startIcon={<Refresh />}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      {showFilters && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterList sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Filters
            </Typography>
            {getActiveFilterCount() > 0 && (
              <Chip 
                label={`${getActiveFilterCount()} active`} 
                size="small" 
                color="primary" 
                sx={{ mr: 1 }} 
              />
            )}
            <Button
              size="small"
              onClick={handleClearFilters}
              startIcon={<Clear />}
              disabled={getActiveFilterCount() === 0}
            >
              Clear
            </Button>
            <Button
              size="small"
              onClick={loadDocuments}
              startIcon={<Refresh />}
              sx={{ ml: 1 }}
            >
              Refresh
            </Button>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                placeholder="Search by filename, notes, or tags..."
              />
            </Grid>

            {!filterBy.documentType && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Document Type</InputLabel>
                  <Select
                    value={filters.documentType}
                    label="Document Type"
                    onChange={(e) => handleFilterChange('documentType', e.target.value)}
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="receipt">Receipt</MenuItem>
                    <MenuItem value="invoice">Invoice</MenuItem>
                    <MenuItem value="contract">Contract</MenuItem>
                    <MenuItem value="quote">Quote</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {!filterBy.category && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    label="Category"
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    <MenuItem value="expense_receipt">Expense Receipt</MenuItem>
                    <MenuItem value="income_receipt">Income Receipt</MenuItem>
                    <MenuItem value="project_quote">Project Quote</MenuItem>
                    <MenuItem value="contract">Contract</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Results Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Documents ({documents.length})
        </Typography>
        
        {documents.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Sorted by {sortBy === 'uploadedAt' ? 'upload date' : sortBy}
          </Typography>
        )}
      </Box>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <Alert severity="info">
          No documents found. {getActiveFilterCount() > 0 ? 'Try adjusting your filters.' : 'Upload your first document to get started.'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {documents.map((document) => (
            <Grid 
              item 
              xs={12} 
              sm={compact ? 12 : 6} 
              md={compact ? 12 : 4} 
              lg={compact ? 12 : 3} 
              key={document.id}
            >
              <DocumentViewer
                clientId={clientId}
                documentId={document.id}
                document={document}
                showDownload={true}
                showDelete={true}
                showPreview={true}
                compact={compact}
                onDelete={handleDocumentDelete}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Load More (Future Enhancement) */}
      {documents.length >= 50 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={loadDocuments}>
            Load More Documents
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default DocumentList;
