import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useDesktopLanguage } from '../../context/DesktopLanguageContext';
import '../../styles/SandylandModalTheme.css';

/**
 * Modal for creating/editing categories
 */
const CategoryFormModal = ({ category = null, isOpen, onClose, onSave }) => {
  const { language, localizationEnabled } = useDesktopLanguage();
  const isSpanish = language === 'ES' && localizationEnabled;

  const copy = isSpanish
    ? {
        titleEdit: 'Editar Categoría',
        titleCreate: 'Agregar Nueva Categoría',
        basicInfo: 'Información Básica',
        classification: 'Clasificación',
        nameEn: 'Nombre de categoría (inglés) *',
        nameEs: 'Nombre de categoría (español) *',
        descriptionEn: 'Descripción (inglés)',
        descriptionEs: 'Descripción (español)',
        type: 'Tipo *',
        status: 'Estado',
        notBudgeted: 'Sin presupuesto',
        expense: 'Gasto',
        income: 'Ingreso',
        active: 'Activo',
        inactive: 'Inactivo',
        cancel: 'Cancelar',
        update: 'Actualizar Categoría',
        create: 'Crear Categoría',
        nameRequiredEn: 'El nombre en inglés es obligatorio',
        nameRequiredEs: 'El nombre en español es obligatorio',
        typeRequired: 'El tipo de categoría es obligatorio',
      }
    : {
        titleEdit: 'Edit Category',
        titleCreate: 'Add New Category',
        basicInfo: 'Basic Information',
        classification: 'Classification',
        nameEn: 'Category Name (English) *',
        nameEs: 'Category Name (Spanish) *',
        descriptionEn: 'Description (English)',
        descriptionEs: 'Description (Spanish)',
        type: 'Type *',
        status: 'Status',
        notBudgeted: 'Not Budgeted',
        expense: 'Expense',
        income: 'Income',
        active: 'Active',
        inactive: 'Inactive',
        cancel: 'Cancel',
        update: 'Update Category',
        create: 'Create Category',
        nameRequiredEn: 'English category name is required',
        nameRequiredEs: 'Spanish category name is required',
        typeRequired: 'Category type is required',
      };
  
  const [formData, setFormData] = useState({
    name: '',
    name_es: '',
    description: '',
    description_es: '',
    type: 'expense',
    status: 'active',
    notBudgeted: false
  });
  
  const [errors, setErrors] = useState({});

  // When a category is provided for editing, populate the form
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        name_es: category.name_es || '',
        description: category.description || '',
        description_es: category.description_es || '',
        type: category.type || 'expense',
        status: category.status || 'active',
        notBudgeted: category.notBudgeted || false
      });
    } else {
      // Reset form for new category
      setFormData({
        name: '',
        name_es: '',
        description: '',
        description_es: '',
        type: 'expense',
        status: 'active',
        notBudgeted: false
      });
    }
    setErrors({});
  }, [category, isOpen]);

  // Handle field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      newErrors.name = copy.nameRequiredEn;
    }

    if (!formData.name_es.trim()) {
      newErrors.name_es = copy.nameRequiredEs;
    }
    
    if (!formData.type.trim()) {
      newErrors.type = copy.typeRequired;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {category ? copy.titleEdit : copy.titleCreate}
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
          {/* Basic Information Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">{copy.basicInfo}</h3>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                {copy.nameEn}
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name ? 'error' : ''}`}
                  placeholder="e.g., Utilities, Maintenance, etc."
                  required
                />
                {errors.name && <span className="sandyland-error-text">{errors.name}</span>}
              </label>

              <label className="sandyland-form-label">
                {copy.nameEs}
                <input
                  type="text"
                  name="name_es"
                  value={formData.name_es}
                  onChange={handleChange}
                  className={`sandyland-form-input ${errors.name_es ? 'error' : ''}`}
                  placeholder="p.ej., Servicios, Mantenimiento, etc."
                  required
                />
                {errors.name_es && <span className="sandyland-error-text">{errors.name_es}</span>}
              </label>
            </div>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                {copy.descriptionEn}
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Optional description of this category..."
                  rows="2"
                />
              </label>

              <label className="sandyland-form-label">
                {copy.descriptionEs}
                <textarea
                  name="description_es"
                  value={formData.description_es}
                  onChange={handleChange}
                  className="sandyland-form-textarea"
                  placeholder="Descripción opcional de esta categoría..."
                  rows="2"
                />
              </label>
            </div>
          </div>

          {/* Classification Section */}
          <div className="sandyland-form-section">
            <h3 className="sandyland-section-title">{copy.classification}</h3>
            
            <div className="sandyland-form-row sandyland-form-row-split">
              <label className="sandyland-form-label">
                {copy.type}
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={`sandyland-form-select ${errors.type ? 'error' : ''}`}
                  required
                >
                  <option value="expense">{copy.expense}</option>
                  <option value="income">{copy.income}</option>
                </select>
                {errors.type && <span className="sandyland-error-text">{errors.type}</span>}
              </label>
              
              <label className="sandyland-form-label">
                {copy.status}
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="sandyland-form-select"
                  required
                >
                  <option value="active">{copy.active}</option>
                  <option value="inactive">{copy.inactive}</option>
                </select>
              </label>
              
              <label className="sandyland-form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                <input
                  type="checkbox"
                  name="notBudgeted"
                  checked={formData.notBudgeted}
                  onChange={handleChange}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'normal' }}>{copy.notBudgeted}</span>
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
            {copy.cancel}
          </button>
          
          <button 
            type="submit" 
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleSubmit}
          >
            {category ? copy.update : copy.create}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryFormModal;
