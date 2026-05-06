import { useEffect, useState } from 'react';
import { PLANS } from '../data/market';
import { fmtPrice } from '../utils/formatters';
import { api } from '../services/api';

function PaymentModal({ plan, onClose, onComplete }) {
  const [step, setStep] = useState('summary');
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPortfolio()
      .then((data) => {
        const rows = data.accounts || [];
        setAccounts(rows);
        setAccountId(rows[0]?.id || '');
      })
      .catch(() => setAccounts([]));
  }, []);

  const submit = () => {
    if (!accountId) return setError('Select an account for subscription billing.');
    setStep('processing');
    window.setTimeout(() => {
      onComplete(plan.id);
      onClose();
    }, 1000);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>Upgrade to {plan.name}</h2>
          <button className="icon-btn" type="button" onClick={onClose}>x</button>
        </header>
        {step === 'processing' ? (
          <p className="status">Processing demo payment...</p>
        ) : step === 'summary' ? (
          <>
            <div className="plan-summary">
              <strong>{plan.name}</strong>
              <span>{fmtPrice(plan.price)} / month</span>
              {plan.features.map((feature) => <p key={feature}>{feature}</p>)}
            </div>
            <p className="form-hint">Demo checkout only. No real charge will be made.</p>
            <button className="secondary-button alert-create-button plan-action-button" type="button" onClick={() => setStep('payment')}>Continue To Payment</button>
          </>
        ) : (
          <>
            <label className="form-field"><span>Billing Account</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label} {account.type === 'bank' ? '(Bank)' : '(Billy)'}</option>)}</select></label>
            {accounts.find((account) => account.id === accountId)?.type === 'billy' && <p className="form-hint">If this Billy account balance drops below the subscription cost, the next available EFT bank account will be charged.</p>}
            {error && <p className="status error">{error}</p>}
            <button className="secondary-button alert-create-button plan-action-button" type="button" onClick={submit}>Subscribe For {fmtPrice(plan.price)}</button>
          </>
        )}
      </section>
    </div>
  );
}

export default function Plans() {
  const [plan, setPlan] = useState(() => localStorage.getItem('bb_plan') || 'free');
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState('');
  const [showBillyInfo, setShowBillyInfo] = useState(false);
  const targetPlan = PLANS.find((item) => item.id === target);

  useEffect(() => {
    let cancelled = false;
    api.getProfile()
      .then((data) => {
        if (cancelled || !data.user?.plan) return;
        localStorage.setItem('bb_plan', data.user.plan);
        setPlan(data.user.plan);
      })
      .catch(() => {
        // Public page: unauthenticated visitors can still preview demo plans.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const complete = async (id) => {
    localStorage.setItem('bb_plan', id);
    setPlan(id);
    setStatus('');

    try {
      await api.updatePlan(id);
      setStatus('Plan saved to your account.');
    } catch {
      setStatus('Plan saved locally. Sign in to persist it to your account.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">Plans</span>
          <h1>Subscription Plans</h1>
          <p>Demo plan selection migrated from the standalone checkout flow.</p>
          {status && <p className="form-hint">{status}</p>}
        </div>
      </header>

      <section className="plan-grid fidelity-plan-grid">
        {PLANS.map((item) => (
          <article className={`plan-card ${item.id === 'pro' ? 'featured' : ''}`} key={item.id}>
            <span>{plan === item.id ? 'Current Plan' : item.id === 'pro' ? 'Most Popular' : 'Plan'}</span>
            <h2 style={{ color: item.color }}>{item.name}</h2>
            <strong>{item.price === 0 ? 'Free' : fmtPrice(item.price)}</strong>
            <p>{item.price === 0 ? 'forever' : 'per month'}</p>
            <ul>
              {item.features.map((feature) => <li key={feature}>{feature}</li>)}
              {(item.locked || []).map((feature) => <li className="locked" key={feature}>{feature}</li>)}
            </ul>
            {item.id === 'pro' && (
              <button className="plan-info-button" type="button" onClick={() => setShowBillyInfo(true)}>
                <span>i</span> Billy Analyst
              </button>
            )}
            <button className="secondary-button alert-create-button plan-action-button" type="button" disabled={plan === item.id} onClick={() => setTarget(item.id)}>
              {plan === item.id ? 'Current Plan' : item.price === 0 ? 'Choose Starter' : `Upgrade to ${item.name}`}
            </button>
          </article>
        ))}
      </section>

      {targetPlan && <PaymentModal plan={targetPlan} onClose={() => setTarget(null)} onComplete={complete} />}
      {showBillyInfo && (
        <div className="overlay" onClick={() => setShowBillyInfo(false)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h2>Billy Analyst</h2>
              <button className="icon-btn" type="button" onClick={() => setShowBillyInfo(false)}>x</button>
            </header>
            <p className="form-hint">Billy Analyst is a Pro-only simulated trading assistant that combines quote data, market movement, news sentiment, technical signals, and user-defined risk limits. It is rules-based, can lose money, and is not financial advice.</p>
          </section>
        </div>
      )}
    </div>
  );
}
