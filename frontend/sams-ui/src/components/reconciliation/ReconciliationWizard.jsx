import React, { useEffect, useState, useCallback } from 'react';
import { getAccounts } from '../../api/client';
import { fetchTransactions } from '../../utils/fetchTransactions';
import { getSession } from '../../api/reconciliation';
import SessionSetup from './SessionSetup';
import MatchingReview from './MatchingReview';
import ExceptionResolver from './ExceptionResolver';
import AcceptStatement from './AcceptStatement';
import './ReconciliationWizard.css';

export default function ReconciliationWizard({ isOpen, onClose, clientId }) {
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [reportUrl, setReportUrl] = useState(null);

  const loadSession = useCallback(async () => {
    if (!clientId || !sessionId) return;
    const s = await getSession(clientId, sessionId, true);
    setSession(s);
  }, [clientId, sessionId]);

  useEffect(() => {
    if (!isOpen || !clientId) return;
    setStep(1);
    setSessionId(null);
    setSession(null);
    setReportUrl(null);
    getAccounts(clientId).then(setAccounts).catch(() => setAccounts([]));
  }, [isOpen, clientId]);

  useEffect(() => {
    if (!sessionId || !clientId) return;
    loadSession();
  }, [sessionId, clientId, loadSession]);

  useEffect(() => {
    if (!sessionId || !clientId || !session?.startDate || !session?.endDate) return;
    const start = new Date(`${session.startDate}T12:00:00`);
    const end = new Date(`${session.endDate}T12:00:00`);
    fetchTransactions({ clientId, startDate: start, endDate: end }).then(setTransactions);
  }, [sessionId, clientId, session?.startDate, session?.endDate]);

  if (!isOpen) return null;

  const hasUnmatched =
    (session?.unmatchedBankRows?.length || 0) > 0 ||
    (session?.unmatchedTransactions?.length || 0) > 0;

  return (
    <div className="recon-wizard-overlay" role="dialog" aria-modal="true">
      <div className="recon-wizard">
        <div className="recon-wizard-header">
          <h2>Bank statement reconciliation</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="recon-wizard-steps">
          <span className={step === 1 ? 'active' : ''}>1 Setup</span>
          <span>→</span>
          <span className={step === 2 ? 'active' : ''}>2 Review</span>
          <span>→</span>
          <span className={step === 3 ? 'active' : ''}>3 Exceptions</span>
          <span>→</span>
          <span className={step === 4 ? 'active' : ''}>4 Accept</span>
        </div>
        <div className="recon-wizard-body">
          {reportUrl && (
            <p>
              <strong>Done.</strong>{' '}
              <a href={reportUrl} target="_blank" rel="noreferrer">
                Download reconciliation report (PDF)
              </a>
            </p>
          )}

          {step === 1 && !reportUrl && (
            <SessionSetup
              clientId={clientId}
              accounts={accounts}
              onCancel={onClose}
              onComplete={(sid) => {
                setSessionId(sid);
                setStep(2);
              }}
            />
          )}

          {step === 2 && sessionId && !reportUrl && (
            <>
              {!session && <p className="recon-muted">Loading…</p>}
              {session && <MatchingReview session={session} />}
              <div className="recon-actions">
                <button type="button" className="secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!session}
                  onClick={() => setStep(3)}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && sessionId && session && !reportUrl && (
            <>
              <ExceptionResolver
                clientId={clientId}
                session={session}
                transactions={transactions}
                onResolved={loadSession}
              />
              <div className="recon-actions">
                <button type="button" className="secondary" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={hasUnmatched}
                  onClick={() => setStep(4)}
                >
                  Continue to acceptance
                </button>
              </div>
              {hasUnmatched && (
                <p className="recon-error">Resolve all unmatched items before continuing.</p>
              )}
            </>
          )}

          {step === 4 && sessionId && session && !reportUrl && (
            <AcceptStatement
              clientId={clientId}
              session={session}
              onCancel={() => setStep(3)}
              onDone={(url) => setReportUrl(url)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
