/**
 * Email Prepend Modal
 * Allows admin to enter custom EN text, translate to ES, and prepend to emails
 * 
 * DESIGN: Translation occurs at authoring time ONLY, never at send time.
 * This ensures deterministic, auditable translations that can be reviewed
 * and edited before sending.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { translateToSpanish } from '../../api/translate';
import './EmailPrependModal.css';

function EmailPrependModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isBulkEmail = false,
  reportType = 'Statement of Account'
}) {
  const [englishText, setEnglishText] = useState('');
  const [spanishText, setSpanishText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasTranslated, setHasTranslated] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const [billedCharacters, setBilledCharacters] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEnglishText('');
      setSpanishText('');
      setIsTranslating(false);
      setHasTranslated(false);
      setTranslationError(null);
      setBilledCharacters(0);
    }
  }, [isOpen]);

  const handleTranslate = useCallback(async () => {
    if (!englishText.trim()) {
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const result = await translateToSpanish(englishText);

      if (result.success) {
        setSpanishText(result.translatedText);
        setBilledCharacters(result.billedCharacters || 0);
        setHasTranslated(true);
      } else {
        setTranslationError(result.error || 'Translation failed');
      }
    } catch (error) {
      setTranslationError(error.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }, [englishText]);

  const handleConfirm = useCallback(() => {
    // Allow sending with just English (Spanish optional but recommended)
    // Also allow sending with no prepend at all (skip)
    onConfirm({
      prependEn: englishText.trim() || null,
      prependEs: spanishText.trim() || null
    });
    onClose();
  }, [englishText, spanishText, onConfirm, onClose]);

  const handleSkip = useCallback(() => {
    // Send without prepend text
    onConfirm({
      prependEn: null,
      prependEs: null
    });
    onClose();
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  const charCount = englishText.length;
  const isLongText = charCount > 1000;

  return (
    <div className="email-prepend-modal-overlay" onClick={handleCancel}>
      <div className="email-prepend-modal" onClick={e => e.stopPropagation()}>
        <div className="email-prepend-modal-header">
          <h2>Add Message to {isBulkEmail ? 'All Emails' : 'Email'}</h2>
          <button className="modal-close-btn" onClick={handleCancel} type="button">×</button>
        </div>

        <div className="email-prepend-modal-body">
          <p className="modal-description">
            Add a custom message that will appear at the beginning of your {reportType} email
            {isBulkEmail ? 's' : ''}. Enter text in English, then click Translate for Spanish.
          </p>

          {/* English Text Area */}
          <div className="text-area-group">
            <label htmlFor="english-text">
              English Message
              <span className="char-count" style={{ color: isLongText ? '#e67e22' : '#666' }}>
                {charCount} characters
              </span>
            </label>
            <textarea
              id="english-text"
              value={englishText}
              onChange={e => setEnglishText(e.target.value)}
              placeholder="Enter your message in English..."
              rows={5}
              disabled={isTranslating}
            />
            {isLongText && (
              <span className="char-warning">Long text may use more translation quota</span>
            )}
          </div>

          {/* Translate Button */}
          <div className="translate-button-row">
            <button
              type="button"
              className="translate-btn"
              onClick={handleTranslate}
              disabled={!englishText.trim() || isTranslating}
            >
              {isTranslating ? (
                <>
                  <span className="spinner"></span>
                  Translating...
                </>
              ) : (
                'Translate to Spanish'
              )}
            </button>
            {billedCharacters > 0 && (
              <span className="billed-chars">
                {billedCharacters} characters translated
              </span>
            )}
          </div>

          {translationError && (
            <div className="translation-error">
              {translationError}
            </div>
          )}

          {/* Spanish Text Area */}
          <div className="text-area-group">
            <label htmlFor="spanish-text">
              Spanish Message
              {!hasTranslated && <span className="hint">(Click Translate or enter manually)</span>}
            </label>
            <textarea
              id="spanish-text"
              value={spanishText}
              onChange={e => setSpanishText(e.target.value)}
              placeholder="La traducción al español aparecerá aquí..."
              rows={5}
              disabled={isTranslating}
            />
          </div>

        </div>

        <div className="email-prepend-modal-footer">
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="btn-secondary" onClick={handleSkip}>
            Skip (No Message)
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={isTranslating}
          >
            {isBulkEmail ? 'Send All Emails' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailPrependModal;
