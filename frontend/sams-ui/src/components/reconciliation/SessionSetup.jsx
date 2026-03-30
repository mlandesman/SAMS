import React, { useEffect, useMemo, useState } from 'react';
import { createSession, importBankFile, runMatching } from '../../api/reconciliation';
import { getMexicoDateString } from '../../utils/timezone';

function inferBankFormat(accountName, explicit) {
  if (explicit === 'scotiabank' || explicit === 'bbva') return explicit;
  const n = String(accountName || '').toLowerCase();
  if (n.includes('scotia') || n.includes('scotiabank')) return 'scotiabank';
  if (n.includes('bbva')) return 'bbva';
  return '';
}

export default function SessionSetup({ clientId, accounts, onComplete, onCancel }) {
  const bankAccounts = useMemo(
    () => (accounts || []).filter((a) => a.type === 'bank' && a.active !== false),
    [accounts]
  );

  const [accountId, setAccountId] = useState(bankAccounts[0]?.id || '');
  const selected = bankAccounts.find((a) => a.id === accountId);
  const inferred = inferBankFormat(selected?.name, null);
  const [bankFormat, setBankFormat] = useState(inferred || 'scotiabank');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getMexicoDateString());
  const [openingBalance, setOpeningBalance] = useState('');
  const [endingBalance, setEndingBalance] = useState('');
  const [bankFile, setBankFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bankAccounts.length && !accountId) {
      setAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, accountId]);

  useEffect(() => {
    const acc = bankAccounts.find((a) => a.id === accountId);
    const inf = inferBankFormat(acc?.name, null);
    if (inf) setBankFormat(inf);
  }, [accountId, bankAccounts]);

  const handleAccountChange = (id) => {
    setAccountId(id);
    const acc = bankAccounts.find((a) => a.id === id);
    const inf = inferBankFormat(acc?.name, null);
    if (inf) setBankFormat(inf);
  };

  const run = async () => {
    setError('');
    if (!accountId || !startDate || !endDate || openingBalance === '' || endingBalance === '') {
      setError('Please fill period dates and balances.');
      return;
    }
    if (!bankFile) {
      setError('Bank file is required.');
      return;
    }
    if (!bankFormat) {
      setError('Select bank format (Scotia CSV or BBVA XLSX).');
      return;
    }

    setBusy(true);
    try {
      const session = await createSession(clientId, {
        accountId,
        startDate,
        endDate,
        openingBalance: Number(openingBalance),
        endingBalance: Number(endingBalance),
        bankFormat,
        differenceAmount: 0
      });
      await importBankFile(clientId, session.id, bankFile, pdfFile || null);
      await runMatching(clientId, session.id);
      onComplete(session.id);
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="recon-muted">
        Select the bank account, statement period, opening/closing balances from the statement, then upload
        the bank file ({bankFormat === 'bbva' ? 'XLSX' : 'CSV'}).
      </p>
      <div className="recon-form-grid">
        <label>
          Account
          <select value={accountId} onChange={(e) => handleAccountChange(e.target.value)}>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bank format
          <select value={bankFormat} onChange={(e) => setBankFormat(e.target.value)}>
            <option value="scotiabank">ScotiaBank (CSV)</option>
            <option value="bbva">BBVA (XLSX)</option>
          </select>
        </label>
        <label>
          Period start
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          Period end
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label>
          Opening balance (statement)
          <input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </label>
        <label>
          Ending balance (statement)
          <input
            type="number"
            step="0.01"
            value={endingBalance}
            onChange={(e) => setEndingBalance(e.target.value)}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Bank movements file
          <input
            type="file"
            accept={bankFormat === 'bbva' ? '.xlsx,.xls' : '.csv'}
            onChange={(e) => setBankFile(e.target.files?.[0] || null)}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Statement PDF (optional)
          <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      {error && <div className="recon-error">{error}</div>}
      <div className="recon-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={run} disabled={busy}>
          {busy ? 'Working…' : 'Import & match'}
        </button>
      </div>
    </div>
  );
}
