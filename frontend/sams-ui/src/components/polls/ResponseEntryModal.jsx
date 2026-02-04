import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { recordResponse } from '../../api/polls';
import '../../styles/SandylandModalTheme.css';
import './PollForms.css';
import './ResponseEntryModal.css';

const ResponseEntryModal = ({ open, onClose, poll, clientId, units = [], responses = [], onSaved }) => {
  const [unitId, setUnitId] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [abstained, setAbstained] = useState(false);
  const [source, setSource] = useState('email');
  const [comment, setComment] = useState('');
  const [isProxy, setIsProxy] = useState(false);
  const [proxyFor, setProxyFor] = useState('');
  const [proxyAuthorizedBy, setProxyAuthorizedBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const respondedUnitIds = useMemo(() => new Set(responses.map((response) => response.unitId)), [responses]);
  const availableUnits = units.filter((unit) => !respondedUnitIds.has(unit.unitId || unit.id));

  if (!open || !poll) {
    return null;
  }

  const handleOptionToggle = (optionId) => {
    if (poll.responseType === 'single_choice' || poll.responseType === 'approve_deny' || poll.responseType === 'yes_no') {
      setSelectedOptions([optionId]);
      setAbstained(false);
      return;
    }
    setSelectedOptions((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((value) => value !== optionId);
      }
      return [...prev, optionId];
    });
    setAbstained(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!clientId || !poll?.pollId || !unitId) {
      setError('Please select a unit before submitting.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      await recordResponse(clientId, poll.pollId, {
        unitId,
        selectedOptions: abstained ? [] : selectedOptions,
        abstained,
        source,
        comment,
        isProxy,
        proxyFor: isProxy ? proxyFor : null,
        proxyAuthorizedBy: isProxy ? proxyAuthorizedBy : null,
      });
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      setError(err.message || 'Failed to record response');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sandy-modal-overlay" onClick={onClose}>
      <div className="sandy-modal" onClick={(event) => event.stopPropagation()}>
        <div className="sandy-modal-header">
          <h2>Enter Vote</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form className="sandy-modal-body" onSubmit={handleSubmit}>
          {error && <div className="poll-error">{error}</div>}

          <div className="poll-section">
            <h4 className="poll-section-title">Unit & Response</h4>
            <label className="poll-field">
              <span>Unit</span>
              <select className="poll-select-medium" value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                <option value="">Select unit</option>
                {availableUnits.map((unit) => {
                  const id = unit.unitId || unit.id;
                  const label = unit.unitName ? `${id} - ${unit.unitName}` : id;
                  return (
                    <option key={id} value={id}>
                      {label}
                  </option>
                );
              })}
              </select>
            </label>

            <div className="poll-field">
              <span>Response</span>
              <div className="poll-options">
              {(poll.options || []).map((option) => (
                <label key={option.id} className="poll-option">
                  <input
                    type={poll.responseType === 'multiple_choice' ? 'checkbox' : 'radio'}
                    checked={selectedOptions.includes(option.id)}
                    onChange={() => handleOptionToggle(option.id)}
                    disabled={abstained}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="poll-option">
                <input
                  type="checkbox"
                  checked={abstained}
                  onChange={(e) => {
                    setAbstained(e.target.checked);
                    if (e.target.checked) {
                      setSelectedOptions([]);
                    }
                  }}
                />
                <span>Abstain</span>
              </label>
            </div>
          </div>
          </div>

          <div className="poll-section">
            <h4 className="poll-section-title">Source & Notes</h4>
          <label className="poll-field">
            <span>Vote Source</span>
            <select className="poll-select-narrow" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="verbal">Verbal</option>
              <option value="proxy">Proxy</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="poll-field checkbox">
            <input
              type="checkbox"
              checked={isProxy}
              onChange={(e) => setIsProxy(e.target.checked)}
            />
            <span>Proxy vote</span>
          </label>

          {isProxy && (
            <div className="poll-proxy">
              <label className="poll-field">
                <span>Proxy for Unit</span>
                <input className="poll-input-narrow" value={proxyFor} onChange={(e) => setProxyFor(e.target.value)} placeholder="Unit ID" />
              </label>
              <label className="poll-field">
                <span>Authorized By</span>
                <input className="poll-input-medium" value={proxyAuthorizedBy} onChange={(e) => setProxyAuthorizedBy(e.target.value)} placeholder="Name or email" />
              </label>
            </div>
          )}

          <label className="poll-field">
            <span>Comment</span>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional notes..."
            />
          </label>
          </div>

          <div className="sandy-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Submit Vote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResponseEntryModal;
