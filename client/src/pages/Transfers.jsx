import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sparkline from '../components/charts/Sparkline';
import { STOCKS_BASE } from '../data/market';
import { api } from '../services/api';
import { fmt, fmtPrice } from '../utils/formatters';

const todayIso = () => new Date().toISOString().slice(0, 10);

function accountValue(account, quotes) {
  const cash = Number(account?.balance || 0);
  const positions = account?.positions || [];
  return cash + positions.reduce((sum, position) => {
    const price = Number(quotes[position.ticker]?.c || position.avg_cost || 0);
    return sum + Number(position.shares || 0) * price;
  }, 0);
}

function activityLine(account, quotes) {
  const value = accountValue(account, quotes);
  const seed = Math.max(1, value);
  return [0.982, 0.991, 0.987, 1.004, 0.998, 1.012, 1].map((factor) => seed * factor);
}

function AccountSummary({ account, quotes }) {
  if (!account) return null;
  return (
    <article className="account-summary">
      <div>
        <span className="section-eyebrow">{account.label}</span>
        <h3>Account {account.accountNumber || account.id}</h3>
      </div>
      <Sparkline data={activityLine(account, quotes)} color="#2f8f25" height={46} />
      <div className="metric-grid">
        <div><span>Total account value</span><strong>{fmtPrice(accountValue(account, quotes))}</strong></div>
        <div><span>Liquid cash available</span><strong>{fmtPrice(account.balance || 0)}</strong></div>
        <div><span>Account timestamp</span><strong>{account.updatedAt ? new Date(account.updatedAt).toLocaleString() : 'Current session'}</strong></div>
      </div>
    </article>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <label className="form-field transfer-field">
      <span>{label}</span>
      <span className="segmented transfer-segmented">
        {options.map((option) => (
          <button
            className={value === option.value ? 'active' : ''}
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </label>
  );
}

export default function Transfers({ marketData }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [mode, setMode] = useState('eft');
  const [step, setStep] = useState('details');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [occurrence, setOccurrence] = useState('one_time');
  const [transferOption, setTransferOption] = useState('cash');
  const [recurringOption, setRecurringOption] = useState('fixed');
  const [frequency, setFrequency] = useState('Monthly');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [shareDrafts, setShareDrafts] = useState({});
  const [saleDrafts, setSaleDrafts] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const quotes = marketData?.quotes || {};
  const accounts = useMemo(() => summary?.accounts || [], [summary]);
  const billyAccounts = useMemo(() => summary?.billyAccounts || accounts.filter((account) => account.type === 'billy'), [summary, accounts]);
  const bankAccounts = useMemo(() => accounts.filter((account) => account.type === 'bank'), [accounts]);
  const transfers = summary?.transfers || [];
  const assetTransfers = summary?.assetTransfers || [];
  const selectedFrom = accounts.find((account) => account.id === fromAccount);
  const selectedTo = accounts.find((account) => account.id === toAccount);
  const cashAmount = Number(amount || 0);
  const needsCashCover = mode === 'billy' && occurrence === 'one_time' && transferOption === 'cash' && selectedFrom && cashAmount > Number(selectedFrom.balance || 0);
  const shareSelections = Object.entries(shareDrafts)
    .map(([ticker, value]) => ({ ticker, shares: Number(value) }))
    .filter((item) => item.shares > 0);

  const loadTransfers = useCallback(async () => {
    try {
      const data = await api.getTransfers();
      setSummary(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load transfer workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    if (!accounts.length) return;
    if (mode === 'eft') {
      const firstBank = bankAccounts[0];
      const firstBilly = billyAccounts[0];
      setFromAccount(firstBank?.id || firstBilly?.id || '');
      setToAccount(firstBilly?.id || firstBank?.id || '');
      setStep('details');
    } else {
      setFromAccount('');
      setToAccount('');
      setStep('origin');
    }
    setAmount('');
    setMemo('');
    setStatus('');
    setError('');
  }, [mode, accounts, bankAccounts, billyAccounts]);

  const submitCashTransfer = async () => {
    const payload = {
      fromAccount,
      toAccount,
      amount: occurrence === 'recurring' && recurringOption === 'earnings' && !amount ? 0 : cashAmount,
      memo,
      occurrence,
      recurringOption,
      frequency,
      startDate,
      endDate,
    };
    const data = await api.createTransfer(payload);
    setSummary(data);
    setStatus(occurrence === 'recurring' ? 'Recurring transfer scheduled.' : 'Transfer completed successfully.');
  };

  const submitShareTransfer = async () => {
    for (const selection of shareSelections) {
      const data = await api.createShareTransfer({
        fromAccount,
        toAccount,
        ticker: selection.ticker,
        shares: selection.shares,
      });
      setSummary(data);
    }
    setStatus('Share transfer completed successfully.');
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (transferOption === 'shares') {
        await submitShareTransfer();
      } else {
        await submitCashTransfer();
      }
      setAmount('');
      setMemo('');
      setShareDrafts({});
      setStep(mode === 'billy' ? 'origin' : 'details');
    } catch (err) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const sellToCover = async () => {
    const source = selectedFrom;
    if (!source || source.source !== 'portfolio') {
      setError('Sell-to-cover is available for the primary Billy portfolio account.');
      return;
    }

    const sales = Object.entries(saleDrafts)
      .map(([ticker, value]) => ({ ticker, shares: Number(value) }))
      .filter((item) => item.shares > 0);
    if (!sales.length) {
      setError('Enter shares to sell before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      for (const sale of sales) {
        const position = source.positions.find((item) => item.ticker === sale.ticker);
        await api.executeTrade({
          mode: 'sell',
          ticker: sale.ticker,
          shares: sale.shares,
          price: Number(quotes[sale.ticker]?.c || position?.avg_cost || 0),
        });
      }
      await loadTransfers();
      setSaleDrafts({});
      setStep('details');
      setStatus('Assets sold to increase liquid cash.');
    } catch (err) {
      setError(err.message || 'Unable to sell selected assets.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueBillyDetails = () => {
    setError('');
    if (!fromAccount || !toAccount) {
      setError('Choose both Billy accounts before continuing.');
      return;
    }
    if (fromAccount === toAccount) {
      setError('Choose two different Billy accounts.');
      return;
    }
    if (occurrence === 'one_time' && transferOption === 'cash' && (!cashAmount || cashAmount <= 0)) {
      setError('Enter a cash amount to transfer.');
      return;
    }
    if (occurrence === 'one_time' && transferOption === 'shares' && !shareSelections.length) {
      setStep('shares');
      return;
    }
    if (needsCashCover) {
      setStep('sell');
      return;
    }
    setStep('confirm');
  };

  if (loading) return <div className="page"><p className="status">Loading transfer workspace...</p></div>;

  return (
    <div className="page transfer-page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Transfers</span>
          <h1>Move Assets Securely</h1>
          <p>Move bank cash, Billy cash, or eligible shares between established Billy accounts.</p>
        </div>
      </header>

      {error && <p className="status warning">{error}</p>}
      {status && <p className="status success">{status}</p>}

      <section className="transfer-tiles">
        <button className={`transfer-tile ${mode === 'eft' ? 'active' : ''}`} type="button" onClick={() => setMode('eft')}>
          <span>Secure EFT to or from a bank</span>
          <strong>Securely move funds between linked bank and established billy accounts to increase buying power.</strong>
        </button>
        <button className={`transfer-tile ${mode === 'billy' ? 'active' : ''}`} type="button" onClick={() => setMode('billy')}>
          <span>Billy to Billy</span>
          <strong>Move liquid cash or eligible stock assets between established Billy accounts.</strong>
        </button>
      </section>

      {mode === 'eft' && (
        <section className="panel transfer-panel transfer-narrow">
            <header className="panel-header">
              <div>
                <h2>Secure EFT</h2>
                <p>Connected bank accounts are assumed to have up to $1,000,000 available for demo funding.</p>
              </div>
            </header>
            <form className="auth-form" onSubmit={(event) => { event.preventDefault(); handleConfirm(); }}>
              <label className="form-field">
                <span>From</span>
                <select value={fromAccount} onChange={(event) => setFromAccount(event.target.value)}>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>To</span>
                <select value={toAccount} onChange={(event) => setToAccount(event.target.value)}>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Amount</span>
                <input type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="form-field">
                <span>Memo</span>
                <input type="text" placeholder="Optional note" value={memo} onChange={(event) => setMemo(event.target.value)} />
              </label>
              <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit transfer'}</button>
            </form>
        </section>
      )}

      {mode === 'billy' && step === 'origin' && (
        <section className="panel transfer-panel transfer-narrow">
          <header className="panel-header">
            <div>
              <h2>Select origin account</h2>
              <p>Choose the Billy account where the cash or shares will move from.</p>
            </div>
          </header>
          <label className="form-field">
            <span>From Billy account</span>
            <select value={fromAccount} onChange={(event) => setFromAccount(event.target.value)}>
              <option value="">Select account</option>
              {billyAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} - {account.accountNumber}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => fromAccount ? setStep('details') : setError('Select an origin account before continuing.')}>Continue</button>
        </section>
      )}

      {mode === 'billy' && step === 'details' && (
        <section className="panel transfer-panel">
          <header className="panel-header">
            <div>
              <h2>Select your transfer details</h2>
              <p>Review activity, select a destination, then choose cash, shares, or a recurring instruction.</p>
            </div>
          </header>
          <div className="two-column">
            <AccountSummary account={selectedFrom} quotes={quotes} />
            <div className="transfer-stack">
              <label className="form-field">
                <span>To Billy account</span>
                <select value={toAccount} onChange={(event) => setToAccount(event.target.value)}>
                  <option value="">Select account</option>
                  {billyAccounts.filter((account) => account.id !== fromAccount).map((account) => (
                    <option key={account.id} value={account.id}>{account.label} - {account.accountNumber}</option>
                  ))}
                </select>
              </label>
              <AccountSummary account={selectedTo} quotes={quotes} />
            </div>
          </div>

          <Segmented
            label="Occurrence"
            value={occurrence}
            options={[{ value: 'one_time', label: 'One-time' }, { value: 'recurring', label: 'Recurring' }]}
            onChange={setOccurrence}
          />

          {occurrence === 'one_time' ? (
            <>
              <Segmented
                label="Transfer option"
                value={transferOption}
                options={[{ value: 'cash', label: 'Cash' }, { value: 'shares', label: 'Shares' }]}
                onChange={setTransferOption}
              />
              {transferOption === 'cash' && (
                <>
                  <label className="form-field">
                    <span>Amount</span>
                    <input type="number" min="1" step="0.01" placeholder="$" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </label>
                  <p className="form-hint warning-text">If you transfer more money than your current cash available, you may be able to sell investments to free up additional cash.</p>
                  <div className="limit-row"><span>Transaction limit</span><strong>$99,999,999.99</strong></div>
                </>
              )}
              {transferOption === 'shares' && (
                <button className="secondary-button" type="button" onClick={() => setStep('shares')}>Continue to eligible investments</button>
              )}
            </>
          ) : (
            <div className="transfer-stack">
              <label className="check-row">
                <input type="radio" checked={recurringOption === 'fixed'} onChange={() => setRecurringOption('fixed')} />
                <span>Withdraw a fixed amount</span>
              </label>
              <label className="check-row">
                <input type="radio" checked={recurringOption === 'earnings'} onChange={() => setRecurringOption('earnings')} />
                <span>Withdraw only my earnings from this account</span>
              </label>
              <label className="form-field">
                <span>Frequency</span>
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                  {['Business day', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div className="two-column">
                <label className="form-field"><span>Start</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="form-field"><span>End (optional)</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div>
              {recurringOption === 'fixed' && (
                <label className="form-field">
                  <span>Amount</span>
                  <input type="number" min="1" step="0.01" placeholder="$" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </label>
              )}
              <div className="limit-row"><span>Transaction limit</span><strong>$99,999.99</strong></div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={continueBillyDetails}>Continue</button>
          </div>
        </section>
      )}

      {mode === 'billy' && step === 'sell' && (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Sell assets to increase liquid cash</h2>
              <p>Your requested cash transfer exceeds the available liquid cash in the origin account.</p>
            </div>
          </header>
          <div className="investment-list">
            {(selectedFrom?.positions || []).map((position) => (
              <article className="investment-row" key={position.ticker}>
                <span><strong>{position.ticker}</strong><small>{STOCKS_BASE[position.ticker]?.name}</small></span>
                <span className="mono">{fmt(position.shares, 4)}</span>
                <input type="number" min="0" max={position.shares} step="0.0001" placeholder="0.0000" value={saleDrafts[position.ticker] || ''} onChange={(event) => setSaleDrafts({ ...saleDrafts, [position.ticker]: event.target.value })} />
              </article>
            ))}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setStep('details')}>Back</button>
            <button type="button" disabled={submitting} onClick={sellToCover}>{submitting ? 'Selling...' : 'Sell selected assets'}</button>
          </div>
        </section>
      )}

      {mode === 'billy' && step === 'shares' && (
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Eligible investments</h2>
              <p>Select some or all shares to move to the destination Billy account.</p>
            </div>
          </header>
          <div className="investment-table">
            <div className="investment-head"><span>Symbol</span><span>Quantity owned</span><span>Shares</span></div>
            {(selectedFrom?.positions || []).map((position) => (
              <article className="investment-row" key={position.ticker}>
                <span><strong>{position.ticker}</strong><small>{STOCKS_BASE[position.ticker]?.name}</small></span>
                <span className="mono">{fmt(position.shares, 4)}</span>
                <span className="share-entry">
                  <button type="button" className="secondary-button" onClick={() => setShareDrafts({ ...shareDrafts, [position.ticker]: position.shares })}>All</button>
                  <input type="number" min="0" max={position.shares} step="0.0001" placeholder="0.0000" value={shareDrafts[position.ticker] || ''} onChange={(event) => setShareDrafts({ ...shareDrafts, [position.ticker]: event.target.value })} />
                </span>
              </article>
            ))}
            {!selectedFrom?.positions?.length && <div className="empty-state">No eligible investments in this account.</div>}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setStep('details')}>Back</button>
            <button type="button" onClick={() => shareSelections.length ? setStep('confirm') : setError('Enter shares to transfer before continuing.')}>Continue</button>
          </div>
        </section>
      )}

      {mode === 'billy' && step === 'confirm' && (
        <section className="panel transfer-panel transfer-narrow">
          <header className="panel-header">
            <div>
              <h2>Confirm transfer</h2>
              <p>Review the details before submitting. A portfolio notification will be recorded.</p>
            </div>
          </header>
          <div className="confirmation-grid">
            <span>From</span><strong>{selectedFrom?.label} ({selectedFrom?.accountNumber})</strong>
            <span>To</span><strong>{selectedTo?.label} ({selectedTo?.accountNumber})</strong>
            <span>Type</span><strong>{occurrence === 'recurring' ? `${frequency} recurring ${recurringOption}` : transferOption}</strong>
            <span>Amount</span><strong>{transferOption === 'shares' ? `${shareSelections.length} position(s)` : fmtPrice(cashAmount || 0)}</strong>
            <span>Transaction ID</span><strong>Pending assignment</strong>
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={() => setStep(transferOption === 'shares' ? 'shares' : 'details')}>Back</button>
            <button type="button" disabled={submitting} onClick={handleConfirm}>{submitting ? 'Submitting...' : 'Confirm transfer'}</button>
          </div>
        </section>
      )}

      <section className="panel transfer-history-preview">
        <header className="panel-header">
          <div>
            <h2>Recent Transfer Notifications</h2>
            <p>The latest five transfers are shown here.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => navigate('/transfers/history')}>View Transfer History</button>
        </header>
        <div className="transfer-list">
          {[...transfers, ...assetTransfers].slice(0, 5).map((transfer) => (
            <article className="transfer-row" key={`${transfer.ticker || transfer.transfer_type}-${transfer.id}`}>
              <span>
                <strong>{transfer.from_label || transfer.from_account}</strong>
                <small>to {transfer.to_label || transfer.to_account}</small>
              </span>
              <span className="mono">{transfer.ticker ? `${transfer.ticker} ${fmt(transfer.shares, 4)}` : fmtPrice(transfer.amount)}</span>
              <span className="status-pill active">{transfer.status}</span>
            </article>
          ))}
          {!transfers.length && !assetTransfers.length && <div className="empty-state">No cash or share transfers yet.</div>}
        </div>
      </section>
    </div>
  );
}
