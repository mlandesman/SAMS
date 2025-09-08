/**
 * Client Form Modal Component
 * Modal for creating and editing clients with logo upload functionality
 * 
 * Phase 12: Client Management CRUD Prerequisites
 * Implementation Date: June 26, 2025
 */

import React, { useState, useEffect, useRef } from 'react';
import { uploadClientLogoApi, removeClientLogoApi, validateLogoFile } from '../../api/clientManagement';
import '../../styles/SandylandModalTheme.css';

// Helper function to ensure valid language code
const ensureValidLanguage = (language) => {
  const validLanguages = ['es-MX', 'en-US', 'en-CA', 'fr-CA'];
  return validLanguages.includes(language) ? language : 'es-MX';
};

const ClientFormModal = ({ 
  open, 
  onClose, 
  onSubmit, 
  mode = 'create', 
  title, 
  initialData = null 
}) => {
  // Form state
  const [formData, setFormData] = useState({
    basicInfo: {
      fullName: '',
      clientId: '',
      displayName: '',
      clientType: 'HOA_Management',
      status: 'active',
      description: ''
    },
    branding: {
      logoUrl: null,
      iconUrl: null,
      brandColors: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#10b981'
      }
    },
    configuration: {
      timezone: 'America/Cancun',
      currency: 'MXN',
      language: 'es-MX',
      dateFormat: 'DD/MM/YYYY'
    },
    contactInfo: {
      primaryEmail: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'MX'
      },
      website: ''
    }
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [iconUploading, setIconUploading] = useState(false);
  
  const logoFileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);

  // Initialize form with existing data for edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      console.log('🔍 [CLIENT-FORM] Initializing edit mode with data:', initialData);
      
      setFormData({
        basicInfo: {
          fullName: initialData.basicInfo?.fullName || '',
          clientId: initialData.basicInfo?.clientId || '',
          displayName: initialData.basicInfo?.displayName || '',
          clientType: initialData.basicInfo?.clientType || 'HOA_Management',
          status: initialData.basicInfo?.status || 'active',
          description: initialData.basicInfo?.description || ''
        },
        branding: {
          logoUrl: initialData.branding?.logoUrl || null,
          iconUrl: initialData.branding?.iconUrl || null,
          brandColors: {
            primary: initialData.branding?.brandColors?.primary || '#2563eb',
            secondary: initialData.branding?.brandColors?.secondary || '#64748b',
            accent: initialData.branding?.brandColors?.accent || '#10b981'
          }
        },
        configuration: {
          timezone: initialData.configuration?.timezone || 'America/Cancun',
          currency: initialData.configuration?.currency || 'MXN',
          language: ensureValidLanguage(initialData.configuration?.language || 'es-MX'),
          dateFormat: initialData.configuration?.dateFormat || 'DD/MM/YYYY'
        },
        contactInfo: {
          primaryEmail: initialData.contactInfo?.primaryEmail || '',
          phone: initialData.contactInfo?.phone || '',
          address: {
            street: initialData.contactInfo?.address?.street || '',
            city: initialData.contactInfo?.address?.city || '',
            state: initialData.contactInfo?.address?.state || '',
            postalCode: initialData.contactInfo?.address?.postalCode || '',
            country: initialData.contactInfo?.address?.country || 'MX'
          },
          website: initialData.contactInfo?.website || ''
        }
      });
      
      // Set logo preview
      const logoUrl = initialData.branding?.logoUrl;
      if (logoUrl) {
        setLogoPreview(logoUrl);
      }
      
      // Set icon preview
      const iconUrl = initialData.branding?.iconUrl;
      if (iconUrl) {
        setIconPreview(iconUrl);
      }
    }
  }, [mode, initialData]);

  // Handle form field changes
  const handleFieldChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  // Client ID validation function
  const validateClientId = (clientId) => {
    if (!clientId || clientId.length < 2 || clientId.length > 10) {
      return 'Client ID must be 2-10 characters';
    }
    if (!/^[A-Z0-9_\-]+$/.test(clientId)) {
      return 'Client ID can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  };

  // Handle nested field changes (like address)
  const handleNestedFieldChange = (section, parentField, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentField]: {
          ...prev[section][parentField],
          [field]: value
        }
      }
    }));
  };

  // Handle logo file selection
  const handleLogoSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validation = validateLogoFile(file);
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setLogoFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle logo upload for existing client
  const handleLogoUpload = async (clientId) => {
    if (!logoFile || !clientId) return null;

    try {
      setLogoUploading(true);
      const response = await uploadClientLogoApi(clientId, logoFile);
      
      if (response.success) {
        return response.data.logoUrl;
      } else {
        throw new Error(response.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Logo upload failed:', error);
      throw error;
    } finally {
      setLogoUploading(false);
    }
  };

  // Handle logo removal
  const handleLogoRemove = async () => {
    if (mode === 'edit' && initialData?.id && formData.branding.logoUrl) {
      try {
        setLogoUploading(true);
        const response = await removeClientLogoApi(initialData.id);
        
        if (response.success) {
          setFormData(prev => ({
            ...prev,
            branding: {
              ...prev.branding,
              logoUrl: null
            }
          }));
        }
      } catch (error) {
        console.error('Logo removal failed:', error);
        setError('Failed to remove logo');
      } finally {
        setLogoUploading(false);
      }
    }
    
    // Clear local selections
    setLogoFile(null);
    setLogoPreview(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
  };

  // Handle icon file selection
  const handleIconSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validation = validateLogoFile(file); // Use same validation as logo
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setIconFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setIconPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle icon upload for existing client
  const handleIconUpload = async (clientId) => {
    if (!iconFile || !clientId) return null;

    try {
      setIconUploading(true);
      // Note: This will need a separate API endpoint for icon upload
      // For now, we'll use the same logo upload API but with a different field name
      const response = await uploadClientLogoApi(clientId, iconFile, 'icon');
      
      if (response.success) {
        return response.data.logoUrl; // Should be iconUrl in the actual API
      } else {
        throw new Error(response.error || 'Failed to upload icon');
      }
    } catch (error) {
      console.error('Icon upload failed:', error);
      throw error;
    } finally {
      setIconUploading(false);
    }
  };

  // Handle icon removal
  const handleIconRemove = async () => {
    if (mode === 'edit' && initialData?.id && formData.branding.iconUrl) {
      try {
        setIconUploading(true);
        // Note: This will need a separate API endpoint for icon removal
        const response = await removeClientLogoApi(initialData.id, 'icon');
        
        if (response.success) {
          setFormData(prev => ({
            ...prev,
            branding: {
              ...prev.branding,
              iconUrl: null
            }
          }));
        }
      } catch (error) {
        console.error('Icon removal failed:', error);
        setError('Failed to remove icon');
      } finally {
        setIconUploading(false);
      }
    }
    
    // Clear local selections
    setIconFile(null);
    setIconPreview(null);
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = [];
    
    if (!formData.basicInfo.fullName.trim()) {
      errors.push('Full name is required');
    }
    
    if (formData.basicInfo.fullName.length < 2) {
      errors.push('Full name must be at least 2 characters');
    }
    
    if (formData.contactInfo.primaryEmail && 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactInfo.primaryEmail)) {
      errors.push('Invalid email format');
    }
    
    return errors;
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '));
        return;
      }

      let finalFormData = { ...formData };

      // For edit mode, ensure we don't include clientId in the update
      // The clientId should not be updated, only used for identification
      if (mode === 'edit' && finalFormData.basicInfo?.clientId) {
        delete finalFormData.basicInfo.clientId;
      }

      // Ensure required fields are present and valid
      if (!finalFormData.basicInfo?.fullName?.trim()) {
        setError('Full name is required and cannot be empty');
        return;
      }

      // Validate brand colors format
      if (finalFormData.branding?.brandColors) {
        const colorPattern = /^#[0-9a-fA-F]{6}$/;
        const colors = finalFormData.branding.brandColors;
        
        if (colors.primary && !colorPattern.test(colors.primary)) {
          setError('Primary color must be in hex format (#RRGGBB)');
          return;
        }
        if (colors.secondary && !colorPattern.test(colors.secondary)) {
          setError('Secondary color must be in hex format (#RRGGBB)');
          return;
        }
        if (colors.accent && !colorPattern.test(colors.accent)) {
          setError('Accent color must be in hex format (#RRGGBB)');
          return;
        }
      }

      // Add comprehensive logging for debugging
      console.log(`🔍 [CLIENT-FORM] ${mode} submission data:`, {
        clientId: mode === 'edit' ? initialData?.id : 'new',
        fullName: finalFormData.basicInfo?.fullName,
        clientType: finalFormData.basicInfo?.clientType,
        status: finalFormData.basicInfo?.status,
        timezone: finalFormData.configuration?.timezone,
        currency: finalFormData.configuration?.currency,
        language: finalFormData.configuration?.language,
        brandColors: finalFormData.branding?.brandColors,
        dataSize: JSON.stringify(finalFormData).length
      });

      // Handle logo upload for new clients
      if (mode === 'create' && logoFile) {
        // For create mode, we'll include the logo file in the submission
        // The parent component will handle the upload after client creation
        finalFormData.logoFile = logoFile;
      } else if (mode === 'edit' && logoFile) {
        // For edit mode, upload logo immediately
        const logoUrl = await handleLogoUpload(initialData.id);
        if (logoUrl) {
          finalFormData.branding.logoUrl = logoUrl;
        }
      }

      // Handle icon upload for new clients
      if (mode === 'create' && iconFile) {
        // For create mode, we'll include the icon file in the submission
        // The parent component will handle the upload after client creation
        finalFormData.iconFile = iconFile;
      } else if (mode === 'edit' && iconFile) {
        // For edit mode, upload icon immediately
        const iconUrl = await handleIconUpload(initialData.id);
        if (iconUrl) {
          finalFormData.branding.iconUrl = iconUrl;
        }
      }

      await onSubmit(finalFormData);
      
      // Reset form on successful creation
      if (mode === 'create') {
        resetForm();
      }
      
    } catch (error) {
      console.error('Form submission failed:', error);
      setError(error.message || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      basicInfo: {
        fullName: '',
        displayName: '',
        clientType: 'HOA_Management',
        status: 'active',
        description: ''
      },
      branding: {
        logoUrl: null,
        iconUrl: null,
        brandColors: {
          primary: '#2563eb',
          secondary: '#64748b',
          accent: '#10b981'
        }
      },
      configuration: {
        timezone: 'America/Cancun',
        currency: 'MXN',
        language: 'es-MX',
        dateFormat: 'DD/MM/YYYY'
      },
      contactInfo: {
        primaryEmail: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'MX'
        },
        website: ''
      }
    });
    setLogoFile(null);
    setLogoPreview(null);
    setIconFile(null);
    setIconPreview(null);
    setError(null);
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = '';
    }
    if (iconFileInputRef.current) {
      iconFileInputRef.current.value = '';
    }
  };

  // Handle dialog close
  const handleClose = () => {
    if (!loading) {
      if (mode === 'create') {
        resetForm();
      }
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={handleClose}>
      <div className="sandyland-modal" onClick={e => e.stopPropagation()}>
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">
            {title || (mode === 'create' ? 'Add New Client' : 'Edit Client')}
          </h2>
        </div>
        
        <div className="sandyland-modal-content">
          {error && (
            <div className="sandyland-error-alert">
              {error}
            </div>
          )}

          {(logoUploading || iconUploading) && (
            <div className="sandyland-upload-progress">
              <div className="sandyland-progress-bar">
                <div className="sandyland-progress-fill"></div>
              </div>
              <span className="sandyland-helper-text">
                {logoUploading ? 'Uploading logo...' : 'Uploading icon...'}
              </span>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {/* Basic Information */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Basic Information</h3>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="fullName" className="required">Full Name</label>
                  <input
                    id="fullName"
                    name="fullName"
                    value={formData.basicInfo.fullName}
                    onChange={(e) => handleFieldChange('basicInfo', 'fullName', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., Mountain Top Condominiums"
                    required
                  />
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="clientId" className="required">Client ID</label>
                  <input
                    id="clientId"
                    name="clientId"
                    value={formData.basicInfo.clientId || ''}
                    onChange={(e) => handleFieldChange('basicInfo', 'clientId', e.target.value.toUpperCase())}
                    disabled={loading}
                    placeholder="e.g., MTC, DEMO, CV"
                    pattern="[A-Z0-9_\-]{2,10}"
                    required
                  />
                  <span className="sandyland-helper-text">
                    Short unique code (2-10 characters, letters/numbers only). Used as Firestore document ID.
                  </span>
                </div>
              </div>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="clientType">Client Type</label>
                  <select
                    id="clientType"
                    name="clientType"
                    value={formData.basicInfo.clientType}
                    onChange={(e) => handleFieldChange('basicInfo', 'clientType', e.target.value)}
                    disabled={loading}
                  >
                    <option value="HOA_Management">HOA Management</option>
                    <option value="Property_Management">Property Management</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Residential">Residential</option>
                  </select>
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.basicInfo.status}
                    onChange={(e) => handleFieldChange('basicInfo', 'status', e.target.value)}
                    disabled={loading}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="description">Description / Address</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.basicInfo.description}
                    onChange={(e) => handleFieldChange('basicInfo', 'description', e.target.value)}
                    disabled={loading}
                    rows={4}
                    placeholder="Description shown in client selector (e.g., address, location details, notes)..."
                  />
                  <span className="sandyland-helper-text">This appears when selecting this client</span>
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Branding</h3>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label>Client Logo</label>
                  <div className="sandyland-logo-upload-section">
                    <div className="sandyland-logo-preview">
                      {logoPreview || formData.branding.logoUrl ? (
                        <img 
                          src={logoPreview || formData.branding.logoUrl} 
                          alt="Client logo" 
                          className="sandyland-logo-image"
                        />
                      ) : (
                        <div className="sandyland-logo-placeholder">
                          <span>📋</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="sandyland-logo-controls">
                      <input
                        type="file"
                        accept="image/*"
                        ref={logoFileInputRef}
                        onChange={handleLogoSelect}
                        style={{ display: 'none' }}
                      />
                      
                      <div className="sandyland-logo-buttons">
                        <button
                          type="button"
                          className="sandyland-btn sandyland-btn-secondary"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={loading || logoUploading}
                        >
                          {logoPreview || formData.branding.logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        
                        {(logoPreview || formData.branding.logoUrl) && (
                          <button
                            type="button"
                            className="sandyland-btn sandyland-btn-danger"
                            onClick={handleLogoRemove}
                            disabled={loading || logoUploading}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <span className="sandyland-helper-text">
                        JPEG, PNG, GIF, or WebP. Max 5MB. Used for reports and emails.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label>Client Icon</label>
                  <div className="sandyland-logo-upload-section">
                    <div className="sandyland-logo-preview sandyland-icon-preview">
                      {iconPreview || formData.branding.iconUrl ? (
                        <img 
                          src={iconPreview || formData.branding.iconUrl} 
                          alt="Client icon" 
                          className="sandyland-logo-image sandyland-icon-image"
                        />
                      ) : (
                        <div className="sandyland-logo-placeholder">
                          <span>🏢</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="sandyland-logo-controls">
                      <input
                        type="file"
                        accept="image/*"
                        ref={iconFileInputRef}
                        onChange={handleIconSelect}
                        style={{ display: 'none' }}
                      />
                      
                      <div className="sandyland-logo-buttons">
                        <button
                          type="button"
                          className="sandyland-btn sandyland-btn-secondary"
                          onClick={() => iconFileInputRef.current?.click()}
                          disabled={loading || iconUploading}
                        >
                          {iconPreview || formData.branding.iconUrl ? 'Change Icon' : 'Upload Icon'}
                        </button>
                        
                        {(iconPreview || formData.branding.iconUrl) && (
                          <button
                            type="button"
                            className="sandyland-btn sandyland-btn-danger"
                            onClick={handleIconRemove}
                            disabled={loading || iconUploading}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      
                      <span className="sandyland-helper-text">
                        JPEG, PNG, GIF, or WebP. Max 5MB. Round icon for tables and navigation.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Configuration</h3>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="timezone">Timezone</label>
                  <input
                    id="timezone"
                    name="timezone"
                    value="America/Cancun (EST/GMT-5)"
                    disabled={true}
                    readOnly={true}
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                  <span className="sandyland-helper-text">All properties are in Cancun timezone</span>
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.configuration.currency}
                    onChange={(e) => handleFieldChange('configuration', 'currency', e.target.value)}
                    disabled={loading}
                  >
                    <option value="MXN">Mexican Peso (MXN)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="CAD">Canadian Dollar (CAD)</option>
                  </select>
                </div>
              </div>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="language">Language</label>
                  <select
                    id="language"
                    name="language"
                    value={formData.configuration.language}
                    onChange={(e) => handleFieldChange('configuration', 'language', e.target.value)}
                    disabled={loading}
                  >
                    <option value="es-MX">Spanish (Mexico)</option>
                    <option value="en-US">English (US)</option>
                    <option value="en-CA">English (Canada)</option>
                    <option value="fr-CA">French (Canada)</option>
                  </select>
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="dateFormat">Date Format</label>
                  <select
                    id="dateFormat"
                    name="dateFormat"
                    value={formData.configuration.dateFormat}
                    onChange={(e) => handleFieldChange('configuration', 'dateFormat', e.target.value)}
                    disabled={loading}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="sandyland-form-section">
              <h3 className="sandyland-section-title">Contact Information</h3>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="primaryEmail">Primary Email</label>
                  <input
                    id="primaryEmail"
                    name="primaryEmail"
                    type="email"
                    value={formData.contactInfo.primaryEmail}
                    onChange={(e) => handleFieldChange('contactInfo', 'primaryEmail', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., info@mtccondos.com"
                  />
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    value={formData.contactInfo.phone}
                    onChange={(e) => handleFieldChange('contactInfo', 'phone', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., +52 55 1234 5678"
                  />
                </div>
              </div>
              
              <div className="sandyland-form-row full-width">
                <div className="sandyland-form-field">
                  <label htmlFor="street">Street Address</label>
                  <input
                    id="street"
                    name="street"
                    value={formData.contactInfo.address.street}
                    onChange={(e) => handleNestedFieldChange('contactInfo', 'address', 'street', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., 123 Mountain View Drive"
                  />
                </div>
              </div>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="city">City</label>
                  <input
                    id="city"
                    name="city"
                    value={formData.contactInfo.address.city}
                    onChange={(e) => handleNestedFieldChange('contactInfo', 'address', 'city', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., Puerto Vallarta"
                  />
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="state">State</label>
                  <input
                    id="state"
                    name="state"
                    value={formData.contactInfo.address.state}
                    onChange={(e) => handleNestedFieldChange('contactInfo', 'address', 'state', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., Jalisco"
                  />
                </div>
              </div>
              
              <div className="sandyland-form-row">
                <div className="sandyland-form-field">
                  <label htmlFor="postalCode">Postal Code</label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    value={formData.contactInfo.address.postalCode}
                    onChange={(e) => handleNestedFieldChange('contactInfo', 'address', 'postalCode', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., 48300"
                  />
                </div>
                
                <div className="sandyland-form-field">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    value={formData.contactInfo.website}
                    onChange={(e) => handleFieldChange('contactInfo', 'website', e.target.value)}
                    disabled={loading}
                    placeholder="e.g., https://mtccondos.com"
                  />
                  <span className="sandyland-helper-text">Optional website URL</span>
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div className="sandyland-modal-buttons">
          <button 
            type="button" 
            className="sandyland-btn sandyland-btn-secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          
          <button 
            type="submit" 
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleSubmit}
            disabled={loading || logoUploading || iconUploading}
          >
            {loading ? 'Saving...' : (mode === 'create' ? 'Create Client' : 'Update Client')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientFormModal;