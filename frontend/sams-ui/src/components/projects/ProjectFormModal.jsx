import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faLanguage } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { LoadingSpinner, useLoadingSpinner } from '../common';
import { translateToSpanish } from '../../api/translate';
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
    name_es: '',
    description: '',
    description_es: '',
    status: 'proposed',
    startDate: '',
    completionDate: '',
    totalCost: '',
    notes: ''
  });
  
  const [errors, setErrors] = useState({});
  const [projectId, setProjectId] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // When a project is provided for editing, populate the form
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        name_es: project.name_es || '',
        description: project.description || '',
        description_es: project.description_es || '',
        status: project.status || 'proposed',
        startDate: project.startDate || '',
        completionDate: project.completionDate || '',
        totalCost: project.totalCost ? (project.totalCost / 100).toFixed(2) : '',
        notes: project.metadata?.notes || ''
      });
      setProjectId(project.projectId || '');
    } else {
      // Reset form for new project
      setFormData({
        name: '',
        name_es: '',
        description: '',
        description_es: '',
        status: 'proposed',
        startDate: new Date().toISOString().substring(0, 10),
        completionDate: '',
        totalCost: '',
        notes: ''
      });
      setProjectId('');
    }
    setErrors({});
    setIsTranslating(false);
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

  // Handle translation of name and description to Spanish
  const handleTranslate = useCallback(async () => {
    if (!formData.name.trim() && !formData.description.trim()) {
      return;
    }
    setIsTranslating(true);
    try {
      // Only translate if Spanish field is empty
      if (formData.name.trim() && !formData.name_es.trim()) {
        const nameResult = await translateToSpanish(formData.name.trim());
        if (nameResult.success) {
          setFormData(prev => ({ ...prev, name_es: nameResult.translatedText }));
        }
      }
      if (formData.description.trim() && !formData.description_es.trim()) {
        const descResult = await translateToSpanish(formData.description.trim());
        if (descResult.success) {
          setFormData(prev => ({ ...prev, description_es: descResult.translatedText }));
        }
      }
    } finally {
      setIsTranslating(false);
    }
  }, [formData.name, formData.description, formData.name_es, formData.description_es]);

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
          name_es: formData.name_es.trim(),
          description: formData.description.trim(),
          description_es: formData.description_es.trim(),
          type: 'special-assessment',
          status: formData.status,
          startDate: formData.startDate,
          completionDate: formData.completionDate || null,
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
          // Preserve vendor data if it exists from before
          if (project.vendor) projectData.vendor = project.vendor;
          if (project.vendors) projectData.vendors = project.vendors;
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
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Project Name (English) *
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
              
              <label className="sandyland-form-label">
                Project Name (Spanish)
                <input
                  type="text"
                  name="name_es"
                  value={formData.name_es}
                  onChange={handleChange}
                  className="sandyland-form-input"
                  placeholder="e.g., Renovación del Elevador"
                />
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
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                Description (English)
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Describe the project scope and objectives..."
                  rows="3"
                />
              </label>
              
              <label className="sandyland-form-label">
                Description (Spanish)
                <textarea
                  name="description_es"
                  value={formData.description_es}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Describa el alcance y objetivos del proyecto..."
                  rows="3"
                />
              </label>
            </div>
            
            <div className="sandyland-form-row">
              <button
                type="button"
                className="sandyland-btn sandyland-btn-secondary"
                onClick={handleTranslate}
                disabled={isTranslating || (!formData.name.trim() && !formData.description.trim())}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <FontAwesomeIcon icon={faLanguage} />
                {isTranslating ? 'Translating...' : 'Translate to Spanish'}
              </button>
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
