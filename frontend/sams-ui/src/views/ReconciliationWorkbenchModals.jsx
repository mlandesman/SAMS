import React from 'react';

/**
 * Workbench-only modal dialogs for bank reconciliation (gap adjustment, justify, exclude).
 * Keeps ReconciliationView focused on state and data flow.
 */
export default function ReconciliationWorkbenchModals({
  gapAdjustModalOpen,
  busy,
  canApplyGapAdjustment,
  gapAdjustJustification,
  onGapAdjustJustificationChange,
  onGapAdjustOverlayClose,
  onGapAdjustCancel,
  onGapAdjustConfirm,
  selectionGapCentavos,
  bankTypeUnified,
  sessionEndDate,
  formatWorkbenchCentavos,

  justifyModalOpen,
  justifyReason,
  onJustifyReasonChange,
  onJustifyOverlayClose,
  onJustifyCancel,
  onJustifySubmit,

  excludeModalOpen,
  excludeReason,
  onExcludeReasonChange,
  onExcludeOverlayClose,
  onExcludeCancel,
  onExcludeSubmit
}) {
  return (
    <>
      {gapAdjustModalOpen && (
        <div
          className="recon-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={onGapAdjustOverlayClose}
        >
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Apply bank adjustment</h4>
            <p className="recon-hint">
              Creates one <strong>Bank Adjustments</strong> transaction (same category as Accounts → Submit Adjustments)
              for the signed gap <strong>{formatWorkbenchCentavos(selectionGapCentavos || 0)}</strong>{' '}
              {selectionGapCentavos > 0 && '(bank total higher)'}
              {selectionGapCentavos < 0 && '(SAMS total higher)'}
              {selectionGapCentavos === 0 && ''} on <strong>{bankTypeUnified || '—'}</strong>, dated{' '}
              <strong>{sessionEndDate || '—'}</strong>. Amount and direction are computed from your selection; a written
              justification is required (stored on the transaction). After posting, SAMS runs <strong>Match selected</strong>{' '}
              for the same bank rows, your selected SAMS rows, and the new adjustment line. Checkboxes clear only after
              that match succeeds (same as clicking Match selected).
            </p>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Justification (required)"
              value={gapAdjustJustification}
              onChange={(e) => onGapAdjustJustificationChange(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button type="button" className="recon-secondary-btn" disabled={busy} onClick={onGapAdjustCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={busy || !canApplyGapAdjustment || !gapAdjustJustification.trim()}
                onClick={onGapAdjustConfirm}
              >
                {busy ? 'Working…' : 'Create adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {justifyModalOpen && (
        <div className="recon-modal-overlay" role="dialog" aria-modal="true" onClick={onJustifyOverlayClose}>
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Justify SAMS line (no bank match)</h4>
            <p className="recon-hint">
              Use for register-only activity (e.g. $0.00, cash movement, or not on this statement). A written reason is
              required; the line is marked cleared on Accept like matched lines.
            </p>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Justification (required)"
              value={justifyReason}
              onChange={(e) => onJustifyReasonChange(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button type="button" className="recon-secondary-btn" onClick={onJustifyCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={!justifyReason.trim()}
                onClick={onJustifySubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {excludeModalOpen && (
        <div className="recon-modal-overlay" role="dialog" aria-modal="true" onClick={onExcludeOverlayClose}>
          <div className="recon-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Exclude from session</h4>
            <textarea
              className="recon-field-input"
              rows={3}
              placeholder="Reason (required)"
              value={excludeReason}
              onChange={(e) => onExcludeReasonChange(e.target.value)}
            />
            <div className="recon-modal-actions">
              <button type="button" className="recon-secondary-btn" onClick={onExcludeCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="recon-primary-btn"
                disabled={busy || !excludeReason.trim()}
                onClick={onExcludeSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
