import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { validateVoteToken, submitVoteViaToken } from '../api/polls';
import './PublicVotingPage.css';

function PublicVotingPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientData, setClientData] = useState(null);
  const [pollData, setPollData] = useState(null);
  const [unitData, setUnitData] = useState(null);
  const [existingResponse, setExistingResponse] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [abstained, setAbstained] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [canVote, setCanVote] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await validateVoteToken(token);
        setClientData(result.data?.client || null);
        setPollData(result.data?.poll || null);
        setUnitData(result.data?.unit || null);
        setExistingResponse(result.data?.response || null);
        setCanVote(result.data?.canVote !== false);
        setSummary(result.data?.summary || null);
        if (result.data?.response?.selectedOptions) {
          setSelectedOptions(result.data.response.selectedOptions);
        }
        if (result.data?.response?.abstained) {
          setAbstained(true);
        }
        if (result.data?.response?.comment) {
          setComment(result.data.response.comment);
        }
      } catch (err) {
        setError(err.message || 'Unable to validate vote token');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      load();
    }
  }, [token]);

  const optionType = pollData?.responseType || 'single_choice';
  const canChangeVote = pollData?.allowChangeVote !== false;
  const alreadyVoted = Boolean(existingResponse && !canChangeVote);
  const pollIsClosed = pollData?.status === 'closed' || pollData?.status === 'archived';
  // Show results if enabled AND user has voted (serves as confirmation)
  const showResults = pollData?.showOtherVotes && summary;

  const handleOptionSelect = (optionId) => {
    if (optionType === 'multiple_choice') {
      setSelectedOptions((prev) => (
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      ));
    } else {
      setSelectedOptions([optionId]);
    }
    setAbstained(false);
  };

  const handleSubmit = async () => {
    if (alreadyVoted) {
      return;
    }
    if (!abstained && selectedOptions.length === 0 && optionType !== 'free_text') {
      setError('Please select a response or choose abstain.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitVoteViaToken(token, {
        selectedOptions: abstained ? [] : selectedOptions,
        abstained,
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  const choiceOptions = useMemo(() => pollData?.options || [], [pollData]);

  const sandylandLogoUrl = 'https://firebasestorage.googleapis.com/v0/b/sandyland-management-system.firebasestorage.app/o/logos%2Fsandyland-properties-high-resolution-logo-transparent.png?alt=media&token=a39645c7-aa81-41a0-9b20-35086de026d0';

  return (
    <div className="public-voting-page">
      <div className="public-voting-branding">
        <img src={sandylandLogoUrl} alt="Sandyland Properties" className="public-voting-sandyland-logo" />
        {clientData && (
          <div className="public-voting-client-branding">
            {clientData.logoUrl ? (
              <img
                src={clientData.logoUrl}
                alt={clientData.name}
                className="public-voting-client-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : null}
            <span className="public-voting-client-name">{clientData.name}</span>
          </div>
        )}
      </div>
      <div className="public-voting-card">
        {loading ? (
          <div className="public-voting-loading">Loading poll...</div>
        ) : error ? (
          <div className="public-voting-error">{error}</div>
        ) : submitted || (existingResponse && (pollIsClosed || !canChangeVote)) ? (
          <div className="public-voting-confirmation">
            <div className="confirmation-icon">✓</div>
            <h2>{submitted ? 'Vote Submitted' : 'Your Vote'}</h2>
            <p className="public-voting-unit">{unitData?.unitName || unitData?.unitId || 'Unit'}</p>
            
            {/* Show the user's vote */}
            <div className="your-vote-section">
              <h3>Your Response</h3>
              {existingResponse?.abstained ? (
                <p className="your-vote-choice">Abstained</p>
              ) : (
                <p className="your-vote-choice">
                  {(existingResponse?.selectedOptions || selectedOptions || [])
                    .map(optId => {
                      const opt = pollData?.options?.find(o => o.id === optId);
                      return opt?.label || optId;
                    })
                    .join(', ') || 'No selection'}
                </p>
              )}
              {(existingResponse?.comment || comment) && (
                <p className="your-vote-comment">
                  <em>"{existingResponse?.comment || comment}"</em>
                </p>
              )}
            </div>
            
            {/* Show poll results if enabled */}
            {showResults && (
              <div className="poll-results-section">
                <h3>Poll Results</h3>
                <p className="results-summary">{summary.totalResponses} total responses</p>
                <div className="results-bars">
                  {summary.results
                    .filter(r => r.optionId !== 'abstain' || r.count > 0)
                    .map(result => (
                      <div key={result.optionId} className="result-bar-row">
                        <div className="result-label">{result.label}</div>
                        <div className="result-bar-container">
                          <div 
                            className="result-bar-fill" 
                            style={{ width: `${result.percentage}%` }}
                          />
                        </div>
                        <div className="result-count">
                          {result.count} ({result.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
            
          </div>
        ) : (
          <>
            <div className="public-voting-header">
              <h2>{pollData?.title}</h2>
              <p className="public-voting-unit">
                {unitData?.unitName || unitData?.unitId || 'Unit'}
              </p>
            </div>

            <p className="public-voting-description">
              {pollData?.description}
            </p>

            {pollData?.documents && pollData.documents.length > 0 && (
              <div className="public-voting-documents">
                <h3>Review Documents</h3>
                <p className="public-voting-documents-hint">
                  Please review the following documents before voting:
                </p>
                <div className="public-voting-documents-list">
                  {pollData.documents.map((doc, index) => (
                    <a
                      key={doc.id || index}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="public-voting-document-link"
                    >
                      <span className="document-icon">📄</span>
                      <span className="document-name">{doc.name || doc.filename || 'Document'}</span>
                      <span className="document-action">Open ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {alreadyVoted && (
              <div className="public-voting-warning">
                This poll does not allow vote changes. Your vote has already been recorded.
              </div>
            )}

            {optionType !== 'free_text' && (
              <div className="public-voting-options">
                {choiceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`vote-option ${selectedOptions.includes(option.id) ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(option.id)}
                    disabled={alreadyVoted || submitting}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`vote-option ${abstained ? 'selected' : ''}`}
                  onClick={() => {
                    setAbstained(true);
                    setSelectedOptions([]);
                  }}
                  disabled={alreadyVoted || submitting}
                >
                  Abstain
                </button>
              </div>
            )}

            {pollData?.allowComment && (
              <div className="public-voting-comment">
                <label>Comment (optional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  disabled={alreadyVoted || submitting}
                />
              </div>
            )}

            <button
              className="vote-submit"
              type="button"
              onClick={handleSubmit}
              disabled={alreadyVoted || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Vote'}
            </button>

            <div className="public-voting-footer">
              Voting closes: {pollData?.closesAt?.display || pollData?.closesAt?.ISO_8601 || '—'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PublicVotingPage;
