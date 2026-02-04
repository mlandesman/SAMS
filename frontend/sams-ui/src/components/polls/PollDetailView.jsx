import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPenToSquare, faVoteYea, faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getPoll, getResponses, publishPoll, closePoll, archivePoll, sendPollNotifications } from '../../api/polls';
import { getUnits } from '../../api/units';
import ResponseEntryModal from './ResponseEntryModal';
import ConfirmationModal from '../modals/ConfirmationModal';
import '../../styles/SandylandModalTheme.css';
import './PollDetailView.css';

const formatDateDisplay = (value) => {
  if (!value) return '—';
  return value.display || value.ISO_8601 || value.iso || '—';
};

const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return '0%';
  }
  const rounded = Number(value).toFixed(1);
  return `${rounded}%`;
};

const PollDetailView = ({ open, onClose, clientId, pollId, onEdit }) => {
  const [poll, setPoll] = useState(null);
  const [summary, setSummary] = useState(null);
  const [responses, setResponses] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const refreshPoll = async () => {
    if (!clientId || !pollId) return;
    const pollResult = await getPoll(clientId, pollId);
    setPoll(pollResult.data);
    setSummary(pollResult.data?.summary || null);
  };

  useEffect(() => {
    if (!open || !clientId || !pollId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const pollResult = await getPoll(clientId, pollId);
        const responseResult = await getResponses(clientId, pollId);
        const unitsResult = await getUnits(clientId);

        setPoll(pollResult.data);
        setSummary(pollResult.data?.summary || null);
        setResponses(responseResult.data || []);
        setUnits(unitsResult.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load poll details');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, clientId, pollId]);

  const optionLookup = useMemo(() => {
    const map = new Map();
    (poll?.options || []).forEach((option) => {
      map.set(option.id, option.label || option.id);
    });
    return map;
  }, [poll]);

  const responseRows = responses.map((response) => {
    const selected = response.abstained
      ? 'Abstain'
      : (response.selectedOptions || [])
        .map((optionId) => optionLookup.get(optionId) || optionId)
        .join(', ');
    return {
      unitId: response.unitId,
      ownershipPercentage: response.ownershipPercentage || 0,
      selected,
    submittedAt: formatDateDisplay(response.submittedAt),
      source: response.source || response.submittedVia || 'admin_entry',
    };
  });

  const totalUnits = summary?.totalUnits || 0;
  const totalResponses = summary?.totalResponses || 0;
  const responseRate = totalUnits > 0 ? (totalResponses / totalUnits) * 100 : 0;

  const handlePublish = async () => {
    if (!clientId || !poll?.pollId) return;
    setActionNotice('');
    try {
      const result = await publishPoll(clientId, poll.pollId);
      await refreshPoll();
      setActionNotice(`Poll published. ${result.tokens?.length || 0} tokens generated.`);
    } catch (err) {
      setActionNotice(err.message || 'Failed to publish poll');
    }
  };

  const handleClose = async () => {
    if (!clientId || !poll?.pollId) return;
    setActionNotice('');
    try {
      await closePoll(clientId, poll.pollId);
      await refreshPoll();
      setActionNotice('Poll closed successfully.');
    } catch (err) {
      setActionNotice(err.message || 'Failed to close poll');
    }
  };

  const handleArchive = async () => {
    if (!clientId || !poll?.pollId) return;
    setActionNotice('');
    try {
      await archivePoll(clientId, poll.pollId);
      await refreshPoll();
      setActionNotice('Poll archived.');
    } catch (err) {
      setActionNotice(err.message || 'Failed to archive poll');
    }
  };

  const handleSendNotifications = async () => {
    if (!clientId || !poll?.pollId) return;
    
    setShowSendConfirm(false);
    setSendingNotifications(true);
    setActionNotice('');
    try {
      const result = await sendPollNotifications(clientId, poll.pollId, 'english');
      if (result.sent > 0 || result.failed > 0) {
        setActionNotice(`Notifications sent: ${result.sent} succeeded, ${result.failed} failed.`);
      } else {
        setActionNotice('No notifications to send (all units have voted or no emails available).');
      }
    } catch (err) {
      setActionNotice(err.message || 'Failed to send notifications');
    } finally {
      setSendingNotifications(false);
    }
  };

  /**
   * Cancel poll (future implementation).
   * When implemented, Cancel should: un-publish the poll, invalidate/kill any tokens
   * already sent to voters, and send an update notification that the poll has been
   * Cancelled so voters are informed.
   */
  const handleCancelPoll = async () => {
    setActionNotice('Cancel poll is not yet implemented.');
    // TODO: Implement Cancel poll: un-publish, kill outstanding tokens, send notification that poll has been Cancelled.
  };

  const handleStatusChange = async (e) => {
    const value = e.target.value;
    if (value === poll?.status) return;
    if (value === 'open') {
      await handlePublish();
      return;
    }
    if (value === 'closed') {
      await handleClose();
      return;
    }
    if (value === 'cancelled') {
      await handleCancelPoll();
      return;
    }
    if (value === 'archive') {
      await handleArchive();
      return;
    }
  };

  const currentStatus = poll?.status || 'draft';

  if (!open) {
    return null;
  }

  return (
    <div className="sandy-modal-overlay" onClick={onClose}>
      <div className="sandy-modal large" onClick={(e) => e.stopPropagation()}>
        <div className="sandy-modal-header">
          <div>
            <h2>{poll?.title || 'Poll Details'}</h2>
            <div className="poll-detail-subtitle">
              <span className="poll-type">{poll?.type === 'vote' ? 'Vote' : 'Poll'}</span>
              <span className="poll-close">Closes: {formatDateDisplay(poll?.closesAt)}</span>
            </div>
          </div>
          <div className="poll-detail-actions">
            <select
              className={`poll-status-select poll-status-${currentStatus}`}
              value={currentStatus === 'archived' ? 'archived' : currentStatus}
              onChange={handleStatusChange}
              aria-label="Poll status"
            >
              {currentStatus === 'draft' && (
                <>
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="closed" disabled>Close</option>
                  <option value="cancelled" disabled>Cancel</option>
                </>
              )}
              {currentStatus === 'open' && (
                <>
                  <option value="open">Open</option>
                  <option value="closed">Close</option>
                  <option value="cancelled">Cancel</option>
                </>
              )}
              {currentStatus === 'closed' && (
                <>
                  <option value="closed">Closed</option>
                  <option value="archive">Archive</option>
                </>
              )}
              {currentStatus === 'archived' && (
                <option value="archived">Archived</option>
              )}
            </select>
            {currentStatus === 'open' && (
              <button
                type="button"
                className="icon-btn send-notifications-btn"
                onClick={() => setShowSendConfirm(true)}
                disabled={sendingNotifications}
                title="Send email notifications to voters"
              >
                <FontAwesomeIcon icon={sendingNotifications ? faSpinner : faPaperPlane} spin={sendingNotifications} />
              </button>
            )}
            {onEdit && (
              <button type="button" className="icon-btn" onClick={() => onEdit(poll)}>
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        <div className="sandy-modal-body">
          {loading ? (
            <div className="poll-loading">Loading poll details...</div>
          ) : error ? (
            <div className="poll-error">{error}</div>
          ) : (
            <>
              {actionNotice && <div className="poll-notice">{actionNotice}</div>}
              <div className="poll-detail-section">
                <h3>Question</h3>
                <p>{poll?.description || 'No description provided.'}</p>
              </div>

              <div className="poll-detail-section">
                <h3>Responses</h3>
                <div className="poll-progress">
                  <div className="poll-progress-bar">
                    <div className="poll-progress-fill" style={{ width: `${responseRate}%` }} />
                  </div>
                  <div className="poll-progress-meta">
                    {totalResponses} of {totalUnits} responses ({formatPercent(responseRate)})
                  </div>
                </div>
              </div>

              {summary?.breakdown?.length > 0 && (
                <div className="poll-detail-section">
                  <h3>Current Results</h3>
                  <div className="poll-results">
                    {summary.breakdown.map((item) => (
                      <div key={item.optionId} className="poll-result-row">
                        <span className="poll-result-label">{item.label || optionLookup.get(item.optionId) || item.optionId}</span>
                        <span className="poll-result-values">
                          {item.count} votes ({formatPercent(item.percentage)})
                          {poll?.useWeightedVoting && (
                            <span className="poll-result-weighted">
                              {formatPercent(item.weightedPercentage)} weighted
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="poll-detail-section">
                <div className="poll-responses-header">
                  <h3>Unit Responses</h3>
                  <button type="button" className="btn-primary" onClick={() => setEntryModalOpen(true)}>
                    <FontAwesomeIcon icon={faVoteYea} />
                    <span>Enter Vote</span>
                  </button>
                </div>
                {responseRows.length === 0 ? (
                  <div className="poll-empty">No responses recorded yet.</div>
                ) : (
                  <div className="poll-responses-table">
                    <div className="poll-responses-row header">
                      <span>Unit</span>
                      <span>Response</span>
                      <span>Ownership %</span>
                      <span>Submitted</span>
                      <span>Source</span>
                    </div>
                    {responseRows.map((row) => (
                      <div key={row.unitId} className="poll-responses-row">
                        <span>{row.unitId}</span>
                        <span>{row.selected}</span>
                        <span>{row.ownershipPercentage || 0}</span>
                        <span>{row.submittedAt}</span>
                        <span>{row.source}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <ResponseEntryModal
          open={entryModalOpen}
          onClose={() => setEntryModalOpen(false)}
          poll={poll}
          clientId={clientId}
          units={units}
          responses={responses}
          onSaved={() => {
            setEntryModalOpen(false);
            if (clientId && pollId) {
              getResponses(clientId, pollId).then((result) => {
                setResponses(result.data || []);
              }).catch(() => {});
            }
          }}
        />

        <ConfirmationModal
          isOpen={showSendConfirm}
          onClose={() => setShowSendConfirm(false)}
          onConfirm={handleSendNotifications}
          title="Send Vote Notifications"
          message={
            <>
              <p>Send email notifications to unit owners who have not yet voted.</p>
              <p style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
                Units that have already voted will be skipped.
              </p>
            </>
          }
          confirmText="Send Notifications"
          cancelText="Cancel"
          variant="primary"
          loading={sendingNotifications}
        />
      </div>
    </div>
  );
};

export default PollDetailView;
