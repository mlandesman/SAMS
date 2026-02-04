import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useClient } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { getProjects } from '../../api/projects';
import { translateToSpanish } from '../../api/translate';
import DocumentUploader from '../documents/DocumentUploader';
import '../../styles/SandylandModalTheme.css';
import './PollForms.css';
import './PollCreationWizard.css';

const RESPONSE_TYPES = [
  { value: 'approve_deny', label: 'Approve / Deny' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'free_text', label: 'Free Text' },
];

const POLL_CATEGORIES = [
  'budget_approval',
  'project_proposal',
  'project_approval',
  'bylaw_amendment',
  'board_only',
  'survey',
  'other',
];

const QUORUM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'simple_majority', label: 'Simple Majority (51%)' },
  { value: 'supermajority', label: 'Two-Thirds (67%)' },
  { value: 'three_quarters', label: 'Three-Quarters (75%)' },
  { value: 'custom', label: 'Custom' },
];

const buildDefaultOptions = (responseType) => {
  if (responseType === 'approve_deny') {
    return [
      { id: 'approve', label: 'Approve', label_es: 'Aprobar' },
      { id: 'deny', label: 'Deny', label_es: 'Denegar' },
    ];
  }
  if (responseType === 'yes_no') {
    return [
      { id: 'yes', label: 'Yes', label_es: 'Sí' },
      { id: 'no', label: 'No', label_es: 'No' },
    ];
  }
  return [];
};

const PollCreationWizard = ({ isOpen, onClose, onSave, poll = null, isEdit = false, context = {} }) => {
  const { selectedClient } = useClient();
  const { samsUser } = useAuth();
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errors, setErrors] = useState({});
  const [documents, setDocuments] = useState([]);

  const [formData, setFormData] = useState({
    type: 'poll',
    category: 'other',
    title: '',
    title_es: '',
    description: '',
    description_es: '',
    responseType: 'approve_deny',
    options: buildDefaultOptions('approve_deny'),
    allowComment: true,
    showOtherVotes: false,
    allowChangeVote: true,
    projectId: '',
    fiscalYear: '',
    closesAtDate: '',
    closesAtTime: '23:59',
    quorumType: 'simple_majority',
    quorumPercentage: 51,
    useWeightedVoting: true,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (poll) {
      const closesAtDate = poll.closesAt?.ISO_8601 || poll.closesAt?.iso?.split('T')?.[0] || '';
      const closesAtTimeRaw = poll.closesAt?.iso?.split('T')?.[1] || '';
      const closesAtTime = closesAtTimeRaw ? closesAtTimeRaw.substring(0, 5) : '23:59';
      setFormData({
        type: poll.type || 'poll',
        category: poll.category || 'other',
        title: poll.title || '',
        title_es: poll.title_es || '',
        description: poll.description || '',
        description_es: poll.description_es || '',
        responseType: poll.responseType || 'approve_deny',
        options: poll.options || buildDefaultOptions(poll.responseType || 'approve_deny'),
        allowComment: Boolean(poll.allowComment),
        showOtherVotes: Boolean(poll.showOtherVotes),
        allowChangeVote: poll.allowChangeVote !== undefined ? Boolean(poll.allowChangeVote) : true,
        projectId: poll.projectId || '',
        fiscalYear: poll.fiscalYear || '',
        closesAtDate,
        closesAtTime,
        quorumType: poll.quorumType || (poll.type === 'vote' ? 'simple_majority' : 'none'),
        quorumPercentage: poll.quorumPercentage || (poll.type === 'vote' ? 51 : ''),
        useWeightedVoting: poll.useWeightedVoting !== undefined ? Boolean(poll.useWeightedVoting) : poll.type === 'vote',
      });
      setDocuments(poll.documents || []);
    } else {
      setFormData((prev) => ({
        ...prev,
        type: context.type || prev.type,
        category: context.category || prev.category,
        projectId: context.projectId || prev.projectId,
        responseType: context.responseType || prev.responseType,
        options: context.responseType ? buildDefaultOptions(context.responseType) : prev.options,
        fiscalYear: context.fiscalYear !== undefined && context.fiscalYear !== '' ? String(context.fiscalYear) : prev.fiscalYear,
        // Support pre-populated title and description from context (e.g., from Projects view)
        title: context.title || prev.title,
        title_es: context.title_es || prev.title_es,
        description: context.description || prev.description,
        description_es: context.description_es || prev.description_es,
        // Support pre-populated closing date/time from context
        closesAtDate: context.closesAtDate || prev.closesAtDate,
        closesAtTime: context.closesAtTime || prev.closesAtTime,
      }));
      // Use documents from context if provided (e.g., auto-generated budget PDFs)
      setDocuments(Array.isArray(context.documents) && context.documents.length > 0 ? context.documents : []);
    }
    setStep(0);
    setErrors({});
    // Use primitive context fields to avoid infinite loop from new object ref each render
    // context.documents.length is used to detect when documents are provided
  }, [isOpen, poll?.pollId, poll?.type, context?.type, context?.category, context?.projectId, context?.responseType, context?.fiscalYear, context?.documents?.length, context?.title, context?.title_es, context?.description, context?.description_es, context?.closesAtDate, context?.closesAtTime]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!selectedClient?.id) return;
      try {
        const result = await getProjects(selectedClient.id, null);
        setProjects(result.data || []);
      } catch (error) {
        console.error('❌ Error loading projects for poll linking:', error);
        setProjects([]);
      }
    };

    if (isOpen) {
      loadProjects();
    }
  }, [isOpen, selectedClient?.id]);

  const updateField = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleTranslate = useCallback(async () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      return;
    }
    setIsTranslating(true);
    try {
      if (formData.title.trim()) {
        const titleResult = await translateToSpanish(formData.title.trim());
        if (titleResult.success) {
          updateField('title_es', titleResult.translatedText);
        }
      }
      if (formData.description.trim()) {
        const descriptionResult = await translateToSpanish(formData.description.trim());
        if (descriptionResult.success) {
          updateField('description_es', descriptionResult.translatedText);
        }
      }
    } finally {
      setIsTranslating(false);
    }
  }, [formData.title, formData.description]);

  const handleResponseTypeChange = (value) => {
    updateField('responseType', value);
    const defaultOptions = buildDefaultOptions(value);
    if (defaultOptions.length > 0) {
      updateField('options', defaultOptions);
    }
  };

  const addOption = () => {
    updateField('options', [
      ...(formData.options || []),
      { id: `option_${(formData.options || []).length + 1}`, label: '', label_es: '' },
    ]);
  };

  const updateOption = (index, key, value) => {
    const updated = [...(formData.options || [])];
    updated[index] = { ...updated[index], [key]: value };
    if (key === 'label' && !updated[index].id) {
      updated[index].id = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }
    updateField('options', updated);
  };

  const removeOption = (index) => {
    const updated = [...(formData.options || [])];
    updated.splice(index, 1);
    updateField('options', updated);
  };

  const validateStep = () => {
    const stepErrors = {};
    if (step === 0) {
      if (!formData.title.trim()) stepErrors.title = 'Title (EN) is required';
      if (!formData.title_es.trim()) stepErrors.title_es = 'Title (ES) is required';
    }
    if (step === 1) {
      if (['single_choice', 'multiple_choice', 'approve_deny', 'yes_no'].includes(formData.responseType)) {
        if (!formData.options || formData.options.length === 0) {
          stepErrors.options = 'At least one option is required';
        }
      }
    }
    if (step === 3) {
      if (!formData.closesAtDate) stepErrors.closesAtDate = 'Close date is required';
      if (formData.type === 'vote' && formData.quorumType === 'custom' && (!formData.quorumPercentage || Number(formData.quorumPercentage) < 1)) {
        stepErrors.quorumPercentage = 'Enter a quorum percentage';
      }
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const canAdvance = validateStep;

  const handleNext = () => {
    if (!canAdvance()) return;
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;

    const closesAt = formData.closesAtDate
      ? `${formData.closesAtDate}T${formData.closesAtTime || '23:59'}:00`
      : '';

    const payload = {
      pollId: poll?.pollId,
      type: formData.type,
      category: formData.category,
      title: formData.title.trim(),
      title_es: formData.title_es.trim(),
      description: formData.description.trim(),
      description_es: formData.description_es.trim(),
      responseType: formData.responseType,
      options: formData.options,
      allowComment: formData.allowComment,
      showOtherVotes: formData.showOtherVotes,
      allowChangeVote: formData.allowChangeVote,
      projectId: formData.projectId || null,
      fiscalYear: formData.fiscalYear || null,
      closesAt,
      quorumType: formData.type === 'vote' ? formData.quorumType : 'none',
      quorumPercentage: formData.type === 'vote' ? Number(formData.quorumPercentage) || 51 : null,
      useWeightedVoting: formData.type === 'vote' ? formData.useWeightedVoting : false,
      documents: documents.map((doc) => ({
        id: doc.id,
        name: doc.filename || doc.name,
        url: doc.downloadURL || doc.url,
        type: doc.type || 'other',
        uploadedAt: doc.uploadedAt || null,
        uploadedBy: samsUser?.email || null,
      })),
      metadata: {
        notes: '',
      },
    };

    await onSave(payload);
  };

  const stepTitle = useMemo(() => {
    return ['Basic Info', 'Question Setup', 'Linking', 'Timing & Quorum'][step];
  }, [step]);

  if (!isOpen) return null;

  return (
    <div className="sandy-modal-overlay" onClick={onClose}>
      <div className="sandy-modal large" onClick={(event) => event.stopPropagation()}>
        <div className="sandy-modal-header">
          <h2>{isEdit ? 'Edit Poll' : 'Create New Poll'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="sandy-modal-body">
          <div className="poll-wizard-steps">
            <span>{stepTitle}</span>
            <span className="poll-wizard-step-count">Step {step + 1} of 4</span>
          </div>

          {step === 0 && (
            <div className="poll-wizard-step">
              <div className="poll-section">
                <h4 className="poll-section-title">Type & Category</h4>
                <div className="poll-field-row">
                  <label className="poll-field">
                    <span>Type</span>
                    <select className="poll-select-narrow" value={formData.type} onChange={(e) => updateField('type', e.target.value)}>
                      <option value="poll">Poll (survey/opinion)</option>
                      <option value="vote">Vote (binding decision)</option>
                    </select>
                  </label>
                  <label className="poll-field">
                    <span>Category</span>
                    <select className="poll-select-medium" value={formData.category} onChange={(e) => updateField('category', e.target.value)}>
                      {POLL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="poll-section">
                <h4 className="poll-section-title">Titles</h4>

                <label className="poll-field">
                  <span>Title (English)</span>
                  <input value={formData.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Poll or vote question" />
                  {errors.title && <span className="poll-error">{errors.title}</span>}
                </label>

                <label className="poll-field">
                  <span>Title (Spanish)</span>
                  <input value={formData.title_es} onChange={(e) => updateField('title_es', e.target.value)} placeholder="Pregunta en español" />
                  {errors.title_es && <span className="poll-error">{errors.title_es}</span>}
                </label>

                <label className="poll-field">
                  <span>Description (English)</span>
                  <textarea rows={3} value={formData.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Optional context or instructions" />
                </label>

                <label className="poll-field">
                  <span>Description (Spanish)</span>
                  <textarea rows={3} value={formData.description_es} onChange={(e) => updateField('description_es', e.target.value)} placeholder="Contexto o instrucciones opcionales" />
                </label>

                <button type="button" className="btn-secondary" onClick={handleTranslate} disabled={isTranslating}>
                  {isTranslating ? 'Translating...' : 'Translate to Spanish'}
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="poll-wizard-step">
              <div className="poll-section">
                <h4 className="poll-section-title">Response Type</h4>
                <label className="poll-field">
                  <span>Response Type</span>
                  <select className="poll-select-medium" value={formData.responseType} onChange={(e) => handleResponseTypeChange(e.target.value)}>
                    {RESPONSE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {['single_choice', 'multiple_choice'].includes(formData.responseType) && (
                <div className="poll-section poll-options-editor">
                  <h4 className="poll-section-title">Options</h4>
                  {errors.options && <span className="poll-error">{errors.options}</span>}
                  {(formData.options || []).map((option, index) => (
                    <div key={option.id || index} className="poll-option-row">
                      <input
                        placeholder="Label (EN)"
                        value={option.label || ''}
                        onChange={(e) => updateOption(index, 'label', e.target.value)}
                      />
                      <input
                        placeholder="Label (ES)"
                        value={option.label_es || ''}
                        onChange={(e) => updateOption(index, 'label_es', e.target.value)}
                      />
                      <button type="button" className="btn-secondary small" onClick={() => removeOption(index)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" onClick={addOption}>
                    Add Option
                  </button>
                </div>
              )}

              <div className="poll-section poll-checkboxes">
                <h4 className="poll-section-title">Settings</h4>
              <label className="poll-field checkbox">
                <input
                  type="checkbox"
                  checked={formData.allowComment}
                  onChange={(e) => updateField('allowComment', e.target.checked)}
                />
                <span>Allow comments</span>
              </label>

              <label className="poll-field checkbox">
                <input
                  type="checkbox"
                  checked={formData.showOtherVotes}
                  onChange={(e) => updateField('showOtherVotes', e.target.checked)}
                />
                <span>Show other votes after closing</span>
              </label>

              <label className="poll-field checkbox">
                <input
                  type="checkbox"
                  checked={formData.allowChangeVote}
                  onChange={(e) => updateField('allowChangeVote', e.target.checked)}
                />
                <span>Allow vote changes</span>
              </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="poll-wizard-step">
              <div className="poll-section">
                <h4 className="poll-section-title">Linking</h4>
                <div className="poll-field-row">
                  <label className="poll-field">
                    <span>Link to Project</span>
                    <select className="poll-select-medium" value={formData.projectId} onChange={(e) => updateField('projectId', e.target.value)}>
                      <option value="">None</option>
                      {projects.map((project) => (
                        <option key={project.projectId} value={project.projectId}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="poll-field">
                    <span>Fiscal Year (Budget)</span>
                    <input
                      className="poll-input-fiscal"
                      type="number"
                      value={formData.fiscalYear}
                      onChange={(e) => updateField('fiscalYear', e.target.value)}
                      placeholder="e.g. 2027"
                    />
                  </label>
                </div>
              </div>

              <div className="poll-section">
                <h4 className="poll-section-title">Attachments</h4>
                
                {/* Display existing/auto-generated documents */}
                {documents.length > 0 && (
                  <div className="poll-existing-documents">
                    <span className="poll-field-label">Attached Documents</span>
                    <div className="poll-document-list">
                      {documents.map((doc, index) => (
                        <div key={doc.id || index} className="poll-document-item">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="poll-document-link">
                            <span className="poll-document-icon">📄</span>
                            <span className="poll-document-name">{doc.name || doc.filename || 'Document'}</span>
                            <span className="poll-document-action">Open ↗</span>
                          </a>
                          <button
                            type="button"
                            className="poll-document-remove"
                            onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                            title="Remove document"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              <div className="poll-field">
                <span>Upload Additional Documents</span>
                <DocumentUploader
                  clientId={selectedClient?.id}
                  onUploadComplete={(newDocs) => setDocuments([...documents, ...newDocs])}
                  onUploadError={(error) => console.error('Document upload error', error)}
                />
              </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="poll-wizard-step">
              <div className="poll-section">
                <h4 className="poll-section-title">Closing</h4>
                <div className="poll-field-row">
                  <label className="poll-field">
                    <span>Close Date</span>
                    <input
                      className="poll-input-date"
                      type="date"
                      value={formData.closesAtDate}
                      onChange={(e) => updateField('closesAtDate', e.target.value)}
                    />
                    {errors.closesAtDate && <span className="poll-error">{errors.closesAtDate}</span>}
                  </label>
                  <label className="poll-field">
                    <span>Close Time</span>
                    <input
                      className="poll-input-time"
                      type="time"
                      value={formData.closesAtTime}
                      onChange={(e) => updateField('closesAtTime', e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {formData.type === 'vote' && (
                <div className="poll-section">
                  <h4 className="poll-section-title">Quorum</h4>
                <div className="poll-field-row">
                  <label className="poll-field">
                    <span>Quorum Requirement</span>
                    <select className="poll-select-narrow" value={formData.quorumType} onChange={(e) => updateField('quorumType', e.target.value)}>
                      {QUORUM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {formData.quorumType === 'custom' && (
                    <label className="poll-field">
                      <span>Custom %</span>
                      <input
                        className="poll-input-quorum"
                        type="number"
                        value={formData.quorumPercentage}
                        onChange={(e) => updateField('quorumPercentage', e.target.value)}
                        min="1"
                        max="100"
                      />
                      {errors.quorumPercentage && <span className="poll-error">{errors.quorumPercentage}</span>}
                    </label>
                  )}
                </div>

                  <label className="poll-field checkbox" style={{ marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={formData.useWeightedVoting}
                      onChange={(e) => updateField('useWeightedVoting', e.target.checked)}
                    />
                    <span>Use weighted voting</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sandy-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {step > 0 && (
            <button type="button" className="btn-secondary" onClick={handleBack}>
              <FontAwesomeIcon icon={faArrowLeft} />
              Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn-primary" onClick={handleNext}>
              Next
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleSubmit}>
              {isEdit ? 'Save Changes' : 'Create Poll'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PollCreationWizard;
