import { useEffect, useState } from 'react';
import { PLANS } from '../data/market';
import { fmtPrice } from '../utils/formatters';
import { api } from '../services/api';

function PaymentModal({ plan, onClose, onComplete }) {
  const [step, setStep] = useState('summary');
  const [form, setForm] = useState({ name: '', card: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');

  const submit = () => {
    if (!form.name.trim()) return setError('Enter the cardholder name.');
    if (form.card.replace(/\D/g, '').length < 16) return setError('Enter a 16-digit card number.');
    if (form.expiry.length < 5) return setError('Enter an expiry date.');
    if (form.cvv.length < 3) return setError('Enter a CVV.');
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
            <button type="button" onClick={() => setStep('payment')}>Continue to Payment</button>
          </>
        ) : (
          <>
            <label className="form-field"><span>Cardholder Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label className="form-field"><span>Card Number</span><input value={form.card} maxLength={19} onChange={(event) => setForm({ ...form, card: event.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim() })} /></label>
            <div className="two-column compact">
              <label className="form-field"><span>Expiry</span><input value={form.expiry} maxLength={5} onChange={(event) => setForm({ ...form, expiry: event.target.value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2') })} /></label>
              <label className="form-field"><span>CVV</span><input value={form.cvv} maxLength={4} onChange={(event) => setForm({ ...form, cvv: event.target.value.replace(/\D/g, '').slice(0, 4) })} /></label>
            </div>
            {error && <p className="status error">{error}</p>}
            <button type="button" onClick={submit}>Pay {fmtPrice(plan.price)}</button>
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
          <h1>Subscription plans</h1>
          <p>Demo plan selection migrated from the standalone checkout flow.</p>
          {status && <p className="form-hint">{status}</p>}
        </div>
      </header>

      <section className="plan-grid">
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
            <button type="button" disabled={plan === item.id} onClick={() => setTarget(item.id)}>
              {plan === item.id ? 'Current Plan' : item.price === 0 ? 'Choose Starter' : `Upgrade to ${item.name}`}
            </button>
          </article>
        ))}
      </section>

      {targetPlan && <PaymentModal plan={targetPlan} onClose={() => setTarget(null)} onComplete={complete} />}
    </div>
  );
}
