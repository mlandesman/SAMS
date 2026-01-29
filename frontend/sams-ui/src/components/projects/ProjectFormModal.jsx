import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { LoadingSpinner, useLoadingSpinner } from '../common';
import '../../styles/SandylandModalTheme.css';

/**
 * Project status options
 */
const PROJECT_STATUSES = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'bidding', label: 'Bidding' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

/**
 * Generate a project ID from name and year
 * @param {string} name - Project name
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @returns {string} Project ID
 */
function generateProjectId(name, startDate) {
  if (!name) return '';
  
  const year = startDate ? startDate.substring(0, 4) : new Date().getFullYear().toString();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${slug}-${year}`;
}

/**
 * Modal for creating/editing projects
 */
const ProjectFormModal = ({ project = null, isOpen, onClose, onSave, isEdit = false }) => {
  const { selectedClient } = useClient();
  const { isLoading: isSaving, withLoading } = useLoadingSpinner();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'proposed',
    startDate: '',
    completionDate: '',
    vendorName: '',
    vendorContact: '',
    vendorNotes: '',
    totalCost: '',
    notes: ''
  });
  
  const [errors, setErrors] = useState({});
  const [projectId, setProjectId] = useState('');

  // When a project is provided for editing, populate the form
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'proposed',
        startDate: project.startDate || '',
        completionDate: project.completionDate || '',
        vendorName: project.vendor?.name || '',
        vendorContact: project.vendor?.contact || '',
        vendorNotes: project.vendor?.notes || '',
        totalCost: project.totalCost ? (project.totalCost / 100).toFixed(2) : '',
        notes: project.metadata?.notes || ''
      });
      setProjectId(project.projectId || '');
    } else {
      // Reset form for new project
      setFormData({
        name: '',
        description: '',
        status: 'proposed',
        startDate: new Date().toISOString().substring(0, 10),
        completionDate: '',
        vendorName: '',
        vendorContact: '',
        vendorNotes: '',
        totalCost: '',
        notes: ''
      });
      setProjectId('');
    }
    setErrors({});
  }, [project, isOpen]);

  // Update project ID when name or start date changes (only for new projects)
  useEffect(() => {
    if (!isEdit) {
      const newId = generateProjectId(formData.name, formData.startDate);
      setProjectId(newId);
    }
  }, [formData.name, formData.startDate, isEdit]);

  // Handle field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (formData.totalCost && isNaN(parseFloat(formData.totalCost))) {
      newErrors.totalCost = 'Invalid amount';
    }
    
    if (formData.completionDate && formData.startDate && 
        formData.completionDate < formData.startDate) {
      newErrors.completionDate = 'Completion date cannot be before start date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      await withLoading(async () => {
        // Build the project data object
        const projectData = {
          projectId: projectId || generateProjectId(formData.name, formData.startDate),
          name: formData.name.trim(),
          description: formData.description.trim(),
          type: 'special-assessment',
          status: formData.status,
          startDate: formData.startDate,
          completionDate: formData.completionDate || null,
          vendor: formData.vendorName ? {
            name: formData.vendorName.trim(),
            contact: formData.vendorContact.trim(),
            notes: formData.vendorNotes.trim()
          } : null,
          vendors: formData.vendorName ? [formData.vendorName.trim()] : [],
          totalCost: formData.totalCost ? Math.round(parseFloat(formData.totalCost) * 100) : 0,
          metadata: {
            notes: formData.notes.trim(),
            updatedAt: new Date().toISOString()
          }
        };
        
        // If editing, preserve existing data that shouldn't be overwritten
        if (isEdit && project) {
          projectData.totalCollected = project.totalCollected || 0;
          projectData.totalPaid = project.totalPaid || 0;
          projectData.balance = project.balance || 0;
          projectData.unitAssessments = project.unitAssessments || {};
          projectData.collections = project.collections || [];
          projectData.payments = project.payments || [];
          projectData.metadata.createdAt = project.metadata?.createdAt;
          projectData.metadata.createdBy = project.metadata?.createdBy;
        } else {
          // New project defaults
          projectData.totalCollected = 0;
          projectData.totalPaid = 0;
          projectData.balance = 0;
          projectData.unitAssessments = {};
          projectData.collections = [];
          projectData.payments = [];
          projectData.metadata.createdAt = new Date().toISOString();
        }
        
        await onSave(projectData);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '700px' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {isEdit ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="sandyland-modal-content">
          {/* Project Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Project Information</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Project Name *
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="e.g., Elevator Refurbishment"
                  required
                />
                {errors.name && <span className="sandyland-error-text">{errors.name}</span>}
              </label>
            </div>
            
            {!isEdit && projectId && (
              <div className="sandyland-form-row">
                <label className="sandyland-form-label">
                  Project ID (auto-generated)
                  <input
                    type="text"
                    value={projectId}
                    className="sandyland-form-input"
                    disabled
                    style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                  />
                </label>
              </div>
            )}
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Description
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Describe the project scope and objectives..."
                  rows="3"
                />
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="sandyland-form-select"
                  required
                >
                  {PROJECT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
              
              <label className="sandyland-form-label">
                Budget / Total Cost
                <input
                  type="number"
                  name="totalCost"
                  value={formData.totalCost}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.totalCost ? 'error' : ''}`}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                {errors.totalCost && <span className="sandyland-error-text">{errors.totalCost}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Start Date *
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.startDate ? 'error' : ''}`}
                  required
                />
                {errors.startDate && <span className="sandyland-error-text">{errors.startDate}</span>}
              </label>
              
              <label className="sandyland-form-label">
                Completion Date
                <input
                  type="date"
                  name="completionDate"
                  value={formData.completionDate}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.completionDate ? 'error' : ''}`}
                />
                {errors.completionDate && <span className="sandyland-error-text">{errors.completionDate}</span>}
              </label>
            </div>
          </div>

          {/* Vendor Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Primary Vendor</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Vendor Name
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="e.g., Jorge Juan Perez"
                />
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Contact Info
                <input
                  type="text"
                  name="vendorContact"
                  value={formData.vendorContact}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="Phone or email"
                />
              </label>
              
              <label className="sandyland-form-label">
                Vendor Notes
                <input
                  type="text"
                  name="vendorNotes"
                  value={formData.vendorNotes}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="Any notes about this vendor"
                />
              </label>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">Notes</h3>
            
            <div className="sandyland-form-row">
              <label className="sandyland-form-label">
                Internal Notes
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Any additional notes about this project..."
                  rows="3"
                />
              </label>
            </div>
          </div>
        </form>
        
        <div className="sandyland-modal-buttons">
          <button 
            type="button" 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LoadingSpinner variant="logo" size="small" color="white" show={true} />
                <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
              </div>
            ) : (
              isEdit ? 'Update Project' : 'Create Project'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectFormModal;
