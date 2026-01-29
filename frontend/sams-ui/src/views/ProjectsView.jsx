import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Chip,
  Menu,
  MenuItem,
  Popper,
  List,
  ListItemButton,
  ListItemText,
  Divider
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faEdit, 
  faTrash,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../context/ClientContext';
import { getProjects, getProject, createProject, updateProject, deleteProject } from '../api/projects';
import { useStatusBar } from '../context/StatusBarContext';
import ActivityActionBar from '../components/common/ActivityActionBar';
import GlobalSearch from '../components/GlobalSearch';
import { UnitAssessmentsTable, VendorPaymentsTable, ProjectFormModal } from '../components/projects';
import ConfirmationDialog from '../components/ConfirmationDialog';
import '../layout/ActionBar.css';
import './HOADuesView.css'; // Reuse HOADuesView styling

/**
 * Format centavos to currency display (US style, no currency code)
 * @param {number} centavos - Amount in centavos
 * @returns {string} Formatted currency string
 */
function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  const amount = centavos / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Get status badge color
 * @param {string} status - Project status
 * @returns {string} MUI color name
 */
function getStatusColor(status) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'primary';
    case 'approved':
      return 'info';
    case 'bidding':
      return 'warning';
    case 'proposed':
      return 'default';
    case 'archived':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Format status for display
 * @param {string} status - Project status
 * @returns {string} Formatted status string
 */
function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function ProjectsView() {
  const { selectedClient } = useClient();
  const { setCenterContent, clearCenterContent } = useStatusBar();
  
  // Year selector state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Projects state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchAnchorEl, setSearchAnchorEl] = useState(null);
  
  // Flag to skip auto-select when selecting from search
  const [skipAutoSelect, setSkipAutoSelect] = useState(false);
  
  // Ref to store the intended project ID from search (avoids race conditions)
  const pendingProjectIdRef = useRef(null);
  
  // Menu anchor for project dropdown
  const [projectMenuAnchor, setProjectMenuAnchor] = useState(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  /**
   * Extract fiscal year from a project's startDate
   */
  const getFiscalYearFromDate = (dateStr) => {
    if (!dateStr) return currentYear;
    const year = parseInt(dateStr.substring(0, 4), 10);
    return year;
  };
  
  /**
   * Search all projects across all years
   */
  const searchAllProjects = useCallback(async (term) => {
    if (!selectedClient || !term.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      // Fetch ALL projects (no year filter)
      const result = await getProjects(selectedClient.id, null);
      const allProjects = result.data || [];
      
      // Filter by search term
      const termLower = term.toLowerCase();
      const matches = allProjects.filter(project => {
        const name = (project.name || '').toLowerCase();
        const description = (project.description || '').toLowerCase();
        const vendor = (project.vendor?.name || '').toLowerCase();
        const vendors = (project.vendors || []).join(' ').toLowerCase();
        
        return name.includes(termLower) || 
               description.includes(termLower) || 
               vendor.includes(termLower) ||
               vendors.includes(termLower);
      });
      
      setSearchResults(matches);
      
      // Set anchor for popper (use status bar as reference)
      const statusBar = document.querySelector('.status-bar');
      if (statusBar && matches.length > 0) {
        setSearchAnchorEl(statusBar);
      }
    } catch (err) {
      console.error('Error searching projects:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [selectedClient, currentYear]);
  
  /**
   * Handle search term change with debounce
   */
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    if (term.trim()) {
      searchAllProjects(term);
    } else {
      setSearchResults([]);
      setSearchAnchorEl(null);
    }
  }, [searchAllProjects]);
  
  /**
   * Handle clearing search
   */
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchAnchorEl(null);
  }, []);
  
  /**
   * Handle selecting a search result
   */
  const handleSearchResultSelect = useCallback((project) => {
    console.log('🔍 Search result selected:', project.name, project.projectId);
    
    // Store the intended project ID in ref (survives state batching race conditions)
    pendingProjectIdRef.current = project.projectId;
    
    // Set flag to skip auto-select
    setSkipAutoSelect(true);
    
    // Extract year from startDate and switch to that year
    const projectYear = getFiscalYearFromDate(project.startDate);
    setSelectedYear(projectYear);
    setSelectedProjectId(project.projectId);
    
    // Clear search
    handleClearSearch();
  }, [handleClearSearch]);
  
  /**
   * Handle Enter key in search - select first result
   */
  const handleSearchEnter = useCallback(() => {
    if (searchResults.length > 0) {
      console.log('⏎ Enter pressed, selecting first result:', searchResults[0].name);
      handleSearchResultSelect(searchResults[0]);
    }
  }, [searchResults, handleSearchResultSelect]);
  
  // Set up status bar center content with GlobalSearch
  useEffect(() => {
    setCenterContent(
      <GlobalSearch 
        onSearch={handleSearch}
        onClear={handleClearSearch}
        onEnter={handleSearchEnter}
        isActive={!!searchTerm}
        placeholder="Search all projects..."
      />
    );
    
    // Clean up when component unmounts
    return () => {
      clearCenterContent();
    };
  }, [setCenterContent, clearCenterContent, handleSearch, handleClearSearch, handleSearchEnter, searchTerm]);
  
  // Load projects when client or year changes
  useEffect(() => {
    if (selectedClient) {
      loadProjects();
    }
  }, [selectedClient, selectedYear]);
  
  // Auto-select newest project when projects change
  useEffect(() => {
    console.log('🔄 Auto-select effect - projects:', projects.length, 'skipAutoSelect:', skipAutoSelect, 'selectedProjectId:', selectedProjectId, 'pendingRef:', pendingProjectIdRef.current);
    
    if (projects.length > 0) {
      // If we just selected from search, use the ref value (avoids state timing issues)
      if (skipAutoSelect && pendingProjectIdRef.current) {
        const intendedProjectId = pendingProjectIdRef.current;
        console.log('🔍 Using pending ref projectId:', intendedProjectId);
        
        // Clear the ref
        pendingProjectIdRef.current = null;
        setSkipAutoSelect(false);
        
        // Verify the project exists in the list
        const projectExists = projects.some(p => p.projectId === intendedProjectId);
        console.log('🔍 Project exists in list:', projectExists);
        
        if (projectExists) {
          // Force set the project ID (in case state update was batched incorrectly)
          setSelectedProjectId(intendedProjectId);
        } else {
          console.log('⚠️ Selected project not in list, selecting first');
          setSelectedProjectId(projects[0].projectId);
        }
        return;
      }
      
      // Projects are already sorted by startDate descending from API
      // Auto-select the first one (newest) if none selected or current not in list
      if (!selectedProjectId || !projects.some(p => p.projectId === selectedProjectId)) {
        console.log('🔄 Auto-selecting first project:', projects[0].name);
        setSelectedProjectId(projects[0].projectId);
      } else {
        console.log('✅ Keeping current selection:', selectedProjectId);
      }
    } else {
      // No projects for this year - clear selection
      console.log('📭 No projects, clearing selection');
      setSelectedProjectId('');
      setSelectedProject(null);
    }
  }, [projects, skipAutoSelect, selectedProjectId]);
  
  // Load full project data when selection changes
  useEffect(() => {
    console.log('📊 Selection effect - projectId:', selectedProjectId);
    if (selectedClient && selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, selectedClient]);
  
  /**
   * Load projects from API
   */
  const loadProjects = async () => {
    if (!selectedClient) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Load projects for selected year
      const result = await getProjects(selectedClient.id, selectedYear);
      console.log('📦 Setting projects:', result.data?.length, 'items');
      setProjects(result.data || []);
      // Note: Don't clear selectedProjectId here - let the auto-select effect handle it
      // to avoid stale closure issues
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err.message || 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Load full project details
   */
  const loadProjectDetails = async (projectId) => {
    if (!selectedClient || !projectId) return;
    
    try {
      const result = await getProject(selectedClient.id, projectId);
      setSelectedProject(result.data);
    } catch (err) {
      console.error('Error loading project details:', err);
      setSelectedProject(null);
    }
  };
  
  /**
   * Filter projects by search term
   */
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) {
      return projects;
    }
    
    const term = searchTerm.toLowerCase();
    return projects.filter(project => {
      const name = (project.name || '').toLowerCase();
      const description = (project.description || '').toLowerCase();
      const vendor = (project.vendor?.name || '').toLowerCase();
      const vendors = (project.vendors || []).join(' ').toLowerCase();
      
      return name.includes(term) || 
             description.includes(term) || 
             vendor.includes(term) ||
             vendors.includes(term);
    });
  }, [projects, searchTerm]);
  
  /**
   * Year navigation component (following WaterBillsViewV3 pattern)
   */
  const YearNavigation = () => (
    <div className="year-navigation">
      <button 
        className="year-nav-button"
        onClick={() => setSelectedYear(selectedYear - 1)}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <div className="year-display">
        <span className="year-text">FY {selectedYear}</span>
      </div>
      <button 
        className="year-nav-button"
        onClick={() => setSelectedYear(selectedYear + 1)}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
  
  /**
   * Handle opening the project menu dropdown
   */
  const handleProjectMenuOpen = (event) => {
    if (filteredProjects.length > 1) {
      setProjectMenuAnchor(event.currentTarget);
    }
  };
  
  /**
   * Handle closing the project menu dropdown
   */
  const handleProjectMenuClose = () => {
    setProjectMenuAnchor(null);
  };
  
  /**
   * Handle selecting a project from the menu
   */
  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
    handleProjectMenuClose();
  };
  
  /**
   * Handle opening the New Project modal
   */
  const handleNewProject = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };
  
  /**
   * Handle opening the Edit Project modal
   */
  const handleEditProject = () => {
    if (selectedProject) {
      setEditingProject(selectedProject);
      setIsModalOpen(true);
    }
  };
  
  /**
   * Handle closing the modal
   */
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };
  
  /**
   * Handle saving a project (create or update)
   */
  const handleSaveProject = async (projectData) => {
    if (!selectedClient) return;
    
    setIsSaving(true);
    try {
      if (editingProject) {
        // Update existing project
        await updateProject(selectedClient.id, editingProject.projectId, projectData);
      } else {
        // Create new project
        await createProject(selectedClient.id, projectData);
        // Switch to the year of the new project
        const projectYear = projectData.startDate 
          ? parseInt(projectData.startDate.substring(0, 4), 10) 
          : currentYear;
        setSelectedYear(projectYear);
      }
      
      // Reload projects
      await loadProjects();
      
      // Select the new/updated project
      if (projectData.projectId) {
        setSelectedProjectId(projectData.projectId);
      }
      
      handleModalClose();
    } catch (err) {
      console.error('Error saving project:', err);
      setError(`Failed to save project: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Check if project can be deleted (no financial records)
   */
  const canDeleteProject = (project) => {
    if (!project) return false;
    const hasCollections = project.collections && project.collections.length > 0;
    const hasPayments = project.payments && project.payments.length > 0;
    return !hasCollections && !hasPayments;
  };
  
  /**
   * Handle opening delete confirmation
   */
  const handleDeleteClick = () => {
    if (!selectedProject) return;
    
    // Check for financial records before showing confirmation
    if (!canDeleteProject(selectedProject)) {
      const collectionCount = selectedProject.collections?.length || 0;
      const paymentCount = selectedProject.payments?.length || 0;
      setError(
        `Cannot delete project with financial records. ` +
        `This project has ${collectionCount} collection(s) and ${paymentCount} payment(s). ` +
        `Change the status to "Archived" instead.`
      );
      return;
    }
    
    setIsDeleteDialogOpen(true);
  };
  
  /**
   * Handle confirming project deletion
   */
  const handleDeleteConfirm = async () => {
    if (!selectedClient || !selectedProject) return;
    
    setIsSaving(true);
    try {
      await deleteProject(selectedClient.id, selectedProject.projectId);
      
      // Clear selection and reload
      setSelectedProjectId('');
      setSelectedProject(null);
      await loadProjects();
      
      setIsDeleteDialogOpen(false);
    } catch (err) {
      // Close dialog first
      setIsDeleteDialogOpen(false);
      
      // Check if this is the "has financial records" validation
      if (err.message && err.message.includes('Cannot delete project with financial records')) {
        // Show as a warning, not an error
        setError(err.message);
      } else {
        console.error('Error deleting project:', err);
        setError(`Failed to delete project: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Handle clicking a transaction link (navigate to Transactions view)
   */
  const handleTransactionClick = (transactionId) => {
    // TODO: Implement navigation to transaction detail
    console.log('Navigate to transaction:', transactionId);
  };
  
  if (!selectedClient) {
    return <Alert severity="info">Please select a client</Alert>;
  }
  
  return (
    <div className="hoa-dues-view">
      {/* SEARCH RESULTS POPPER */}
      <Popper
        open={Boolean(searchAnchorEl) && searchResults.length > 0}
        anchorEl={searchAnchorEl}
        placement="top"
        style={{ zIndex: 1300 }}
      >
        <Paper 
          elevation={8}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{ 
            width: 400, 
            maxHeight: 300, 
            overflow: 'auto',
            mb: 1,
            border: '1px solid #ddd'
          }}
        >
          <Box sx={{ p: 1, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
            <Typography variant="caption" color="text.secondary">
              {searchResults.length} project{searchResults.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          <List dense disablePadding>
            {searchResults.map((project, index) => (
              <React.Fragment key={project.projectId}>
                {index > 0 && <Divider />}
                <ListItemButton 
                  onClick={() => {
                    console.log('🖱️ ListItemButton clicked:', project.projectId);
                    handleSearchResultSelect(project);
                  }}
                  sx={{ 
                    '&:hover': { backgroundColor: '#e3f2fd' },
                    py: 1.5,
                    cursor: 'pointer'
                  }}
                >
                  <ListItemText 
                    primary={project.name}
                    secondary={`FY ${getFiscalYearFromDate(project.startDate)} • ${formatStatus(project.status)}`}
                  />
                  <Chip 
                    label={formatStatus(project.status)} 
                    color={getStatusColor(project.status)}
                    size="small"
                    sx={{ fontSize: '0.7rem', ml: 2 }}
                  />
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Popper>
      
      {/* ACTION BAR */}
      <ActivityActionBar>
        {/* CRUD Buttons */}
        <button className="action-item" onClick={handleNewProject} title="Create new project">
          <FontAwesomeIcon icon={faPlus} />
          <span>New Project</span>
        </button>
        <button 
          className="action-item" 
          onClick={handleEditProject} 
          disabled={!selectedProject}
          title={selectedProject ? "Edit project" : "Select a project to edit"}
        >
          <FontAwesomeIcon icon={faEdit} />
          <span>Edit</span>
        </button>
        <button 
          className="action-item" 
          onClick={handleDeleteClick} 
          disabled={!selectedProject}
          title={selectedProject ? "Delete project" : "Select a project to delete"}
        >
          <FontAwesomeIcon icon={faTrash} />
          <span>Delete</span>
        </button>
        
        {/* Year Navigation (rightmost) */}
        <YearNavigation />
      </ActivityActionBar>
      
      <div className="hoa-dues-content">
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* PROJECT DETAILS */}
        <Paper sx={{ p: 3, mb: 2 }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                Loading projects...
              </Typography>
            </Box>
          ) : projects.length === 0 ? (
            /* Empty state when no projects for selected year */
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h5" color="text.secondary">
                No projects for FY {selectedYear}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Create a new project or select a different year.
              </Typography>
            </Box>
          ) : selectedProject ? (
            <Box>
              {/* Clickable project name with dropdown */}
              <Box 
                onClick={handleProjectMenuOpen}
                sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  cursor: filteredProjects.length > 1 ? 'pointer' : 'default',
                  '&:hover': filteredProjects.length > 1 ? { 
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  } : {},
                  padding: '4px 8px',
                  marginLeft: '-8px',
                  marginBottom: 1
                }}
              >
                <Typography variant="h5">
                  {selectedProject.name}
                </Typography>
                {filteredProjects.length > 1 && (
                  <ArrowDropDownIcon sx={{ ml: 0.5, color: 'text.secondary' }} />
                )}
              </Box>
              
              {/* Project dropdown menu */}
              <Menu
                anchorEl={projectMenuAnchor}
                open={Boolean(projectMenuAnchor)}
                onClose={handleProjectMenuClose}
                PaperProps={{
                  sx: { minWidth: 250, maxHeight: 300 }
                }}
              >
                {filteredProjects.map(project => (
                  <MenuItem 
                    key={project.projectId} 
                    onClick={() => handleProjectSelect(project.projectId)}
                    selected={project.projectId === selectedProjectId}
                  >
                    {project.name}
                  </MenuItem>
                ))}
              </Menu>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip 
                  label={formatStatus(selectedProject.status)} 
                  color={getStatusColor(selectedProject.status)}
                  size="small"
                />
                
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {selectedProject.startDate || 'No start date'}
                  {selectedProject.completionDate && ` - ${selectedProject.completionDate}`}
                </Typography>
              </Box>
              
              {selectedProject.description && (
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedProject.description}
                </Typography>
              )}
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: 2,
                mt: 2
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                  <Typography variant="h6">{formatCurrency(selectedProject.totalCost)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Collected</Typography>
                  <Typography variant="h6">{formatCurrency(selectedProject.totalCollected)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Paid to Vendors</Typography>
                  <Typography variant="h6">{formatCurrency(selectedProject.totalPaid)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Balance</Typography>
                  <Typography 
                    variant="h6" 
                    color={selectedProject.balance < 0 ? 'error' : 'success.main'}
                  >
                    {formatCurrency(selectedProject.balance)}
                  </Typography>
                </Box>
              </Box>
              
              {selectedProject.vendor?.name && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">Primary Vendor</Typography>
                  <Typography variant="body1">{selectedProject.vendor.name}</Typography>
                </Box>
              )}
              
              {/* Unit Assessments Section */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Unit Assessments & Collections
                </Typography>
                <UnitAssessmentsTable 
                  unitAssessments={selectedProject.unitAssessments}
                  collections={selectedProject.collections}
                />
              </Box>
              
              {/* Vendor Payments Section */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Vendor Payments
                </Typography>
                <VendorPaymentsTable 
                  payments={selectedProject.payments}
                  onTransactionClick={handleTransactionClick}
                />
              </Box>
            </Box>
          ) : (
            /* Fallback - should not typically happen with auto-select */
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                Select a project to view details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''} available
              </Typography>
            </Box>
          )}
        </Paper>
      </div>
      
      {/* Project Form Modal */}
      <ProjectFormModal
        project={editingProject}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSaveProject}
        isEdit={!!editingProject}
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Project"
        message={`Are you sure you want to delete "${selectedProject?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onClose={() => setIsDeleteDialogOpen(false)}
        confirmButtonClass="danger"
      />
    </div>
  );
}

export default ProjectsView;
