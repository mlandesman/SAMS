/**
 * AssessmentCollectionDialog
 *
 * Pops after a bid is selected and project becomes approved. Allows admin to configure
 * how unit owners will be assessed (billed) for the project.
 *
 * Options: No Assessment Required (reserve-funded), 100% Upfront, or Split into Phases.
 */

import React, { useState, useEffect } from 'react';
import { updateProject } from '../../api/projects';
import { formatCurrency as formatCurrencyShared } from '@shared/utils/currencyUtils';
import '../../styles/SandylandModalTheme.css';

function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  return formatCurrencyShared(centavos, 'USD');
}

const ASSESSMENT_TYPE = {
  NONE: 'none',
  UPFRONT: 'upfront',
  SPLIT: 'split'
};

function AssessmentCollectionDialog({ isOpen, onClose, project, clientId, onSave }) {
  const [assessmentType, setAssessmentType] = useState(ASSESSMENT_TYPE.UPFRONT);
  const [phases, setPhases] = useState([{ label: 'Full Assessment', percentOfTotal: 100, targetDate: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [percentError, setPercentError] = useState('');

  const totalCost = project?.totalCost ?? 0;

  useEffect(() => {
    if (isOpen && project) {
      if (project.noAssessmentRequired) {
        setAssessmentType(ASSESSMENT_TYPE.NONE);
        setPhases([]);
      } else if (project.assessmentSchedule && project.assessmentSchedule.length > 0) {
        setAssessmentType(
          project.assessmentSchedule.length === 1 ? ASSESSMENT_TYPE.UPFRONT : ASSESSMENT_TYPE.SPLIT
        );
        setPhases(
          project.assessmentSchedule.map((a) => ({
            label: a.label || a.milestone || '',
            percentOfTotal: a.percentOfTotal ?? 0,
            targetDate: a.targetDate || ''
          }))
        );
      } else {
        setAssessmentType(ASSESSMENT_TYPE.UPFRONT);
        setPhases([{ label: 'Full Assessment', percentOfTotal: 100, targetDate: '' }]);
      }
      setError('');
      setPercentError('');
    }
  }, [isOpen, project]);

  const validate = () => {
    if (assessmentType === ASSESSMENT_TYPE.NONE) return true;
    const sum = phases.reduce((s, p) => s + (Number(p.percentOfTotal) || 0), 0);
    if (sum !== 100) {
      setPercentError(`Percentages must sum to 100% (currently ${sum}%)`);
      return false;
    }
    const hasEmptyLabel = phases.some((p) => !String(p.label || '').trim());
    if (hasEmptyLabel) {
      setError('All phase labels are required');
      return false;
    }
    setPercentError('');
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!clientId || !project?.projectId) return;
    if (!validate()) return;

    setSaving(true);
    setError('');
    try {
      if (assessmentType === ASSESSMENT_TYPE.NONE) {
        const res = await updateProject(clientId, project.projectId, {
          noAssessmentRequired: true,
          assessmentSchedule: []
        });
        onSave?.(res?.data);
      } else {
        const schedule = phases.map((p) => {
          const pct = Number(p.percentOfTotal) || 0;
          const amountCentavos = Math.round(totalCost * pct / 100);
          return {
            label: String(p.label || '').trim(),
            percentOfTotal: pct,
            amountCentavos,
            targetDate: p.targetDate || null,
            status: 'pending',
            billedDate: null
          };
        });
        const res = await updateProject(clientId, project.projectId, {
          noAssessmentRequired: false,
          assessmentSchedule: schedule
        });
        onSave?.(res?.data);
      }
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save assessment plan');
    } finally {
      setSaving(false);
    }
  };

  const addPhase = () => {
    setPhases((prev) => [...prev, { label: '', percentOfTotal: 0, targetDate: '' }]);
  };

  const removePhase = (idx) => {
    setPhases((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePhase = (idx, field, value) => {
    setPhases((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="sandyland-modal-overlay" onClick={onClose}>
      <div
        className="sandyland-modal"
        style={{ width: 600, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sandyland-modal-header">
          <h2 className="sandyland-modal-title">Assessment Collection Plan</h2>
          {project?.name && (
            <p className="sandyland-modal-subtitle">{project.name}</p>
          )}
        </div>
        <div className="sandyland-modal-content">
          <div className="sandyland-form-row" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Project: {project?.name} • Total: {formatCurrency(totalCost)} • Vendor:{' '}
              {project?.vendor?.name || '—'}
            </p>
          </div>

          <div className="sandyland-form-field full-width" style={{ marginBottom: 16 }}>
            <label>Assessment type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="assessmentType"
                  checked={assessmentType === ASSESSMENT_TYPE.NONE}
                  onChange={() => setAssessmentType(ASSESSMENT_TYPE.NONE)}
                />
                No Assessment Required (Reserve Funded)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="assessmentType"
                  checked={assessmentType === ASSESSMENT_TYPE.UPFRONT}
                  onChange={() => {
                    setAssessmentType(ASSESSMENT_TYPE.UPFRONT);
                    setPhases([{ label: 'Full Assessment', percentOfTotal: 100, targetDate: '' }]);
                  }}
                />
                100% Upfront
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="assessmentType"
                  checked={assessmentType === ASSESSMENT_TYPE.SPLIT}
                  onChange={() => {
                    setAssessmentType(ASSESSMENT_TYPE.SPLIT);
                    if (phases.length <= 1) {
                      setPhases([
                        { label: 'Phase 1', percentOfTotal: 50, targetDate: '' },
                        { label: 'Phase 2', percentOfTotal: 50, targetDate: '' }
                      ]);
                    }
                  }}
                />
                Split into Phases
              </label>
            </div>
          </div>

          {assessmentType !== ASSESSMENT_TYPE.NONE && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 100px 100px 40px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <span style={{ fontWeight: 600 }}>Label</span>
                <span style={{ fontWeight: 600 }}>%</span>
                <span style={{ fontWeight: 600 }}>Amount</span>
                <span style={{ fontWeight: 600 }}>Target Date</span>
                <span />
              </div>
              {phases.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px 100px 40px',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                >
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePhase(i, 'label', e.target.value)}
                    placeholder="e.g. Full Assessment, Phase 1"
                    disabled={assessmentType === ASSESSMENT_TYPE.UPFRONT}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={p.percentOfTotal}
                    onChange={(e) => updatePhase(i, 'percentOfTotal', e.target.value)}
                    disabled={assessmentType === ASSESSMENT_TYPE.UPFRONT}
                  />
                  <span style={{ fontSize: '0.9rem' }}>
                    {formatCurrency(Math.round(totalCost * (Number(p.percentOfTotal) || 0) / 100))}
                  </span>
                  <input
                    type="date"
                    value={p.targetDate}
                    onChange={(e) => updatePhase(i, 'targetDate', e.target.value)}
                    title="Target Bill Date (advisory)"
                  />
                  {assessmentType === ASSESSMENT_TYPE.SPLIT && phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(i)}
                      style={{ padding: 4, cursor: 'pointer' }}
                      title="Remove phase"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {assessmentType === ASSESSMENT_TYPE.SPLIT && (
                <button
                  type="button"
                  onClick={addPhase}
                  style={{ marginTop: 8, padding: '6px 12px' }}
                >
                  + Add Phase
                </button>
              )}
              {percentError && (
                <p style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: 8 }}>{percentError}</p>
              )}
            </div>
          )}

          {error && (
            <div className="sandyland-error-alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
        </div>
        <div className="sandyland-modal-buttons">
          <button className="sandyland-btn sandyland-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="sandyland-btn sandyland-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssessmentCollectionDialog;
