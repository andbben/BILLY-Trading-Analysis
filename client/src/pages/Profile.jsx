import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Profile() {
  const [user, setUser] = useState({});
  const [prefs, setPrefs] = useState(() => JSON.parse(localStorage.getItem('bb_profile_prefs') || '{"email":true,"push":true,"text":false,"privacy":true}'));
  const [status, setStatus] = useState('');

  useEffect(() => {
    api.getProfile().then((data) => setUser(data.user || {})).catch(() => {});
  }, []);

  const save = () => {
    localStorage.setItem('bb_profile_prefs', JSON.stringify(prefs));
    localStorage.setItem('bb_user', JSON.stringify(user));
    setStatus('Profile preferences saved locally.');
  };

  return (
    <div className="page">
      <header className="page-header"><div><span className="section-eyebrow">Profile</span><h1>Account Profile</h1><p>Manage account details, privacy preferences, notifications, and tax form requests.</p></div></header>
      {status && <p className="status success">{status}</p>}
      <div className="two-column">
        <section className="panel profile-panel">
          <header className="panel-header"><h2>Account Details</h2></header>
          <label className="form-field"><span>Name</span><input value={user.name || ''} onChange={(event) => setUser({ ...user, name: event.target.value })} /></label>
          <label className="form-field"><span>Email</span><input value={user.email || ''} onChange={(event) => setUser({ ...user, email: event.target.value })} /></label>
          <label className="form-field"><span>New Password</span><input type="password" placeholder="Enter a new password" /></label>
          <button type="button" onClick={save}>Save Profile</button>
        </section>
        <section className="panel profile-panel">
          <header className="panel-header"><h2>Notification Preferences</h2></header>
          <label className="check-row"><input type="checkbox" checked={prefs.email} onChange={(event) => setPrefs({ ...prefs, email: event.target.checked })} /><span>Email notifications</span></label>
          <label className="check-row"><input type="checkbox" checked={prefs.push} onChange={(event) => setPrefs({ ...prefs, push: event.target.checked })} /><span>Push notifications</span></label>
          <label className="check-row"><input type="checkbox" checked={prefs.text} onChange={(event) => setPrefs({ ...prefs, text: event.target.checked })} /><span>Text notifications</span></label>
          <label className="check-row"><input type="checkbox" checked={prefs.privacy} onChange={(event) => setPrefs({ ...prefs, privacy: event.target.checked })} /><span>I acknowledge Billy privacy and trading-risk disclaimers.</span></label>
        </section>
      </div>
      <section className="panel">
        <header className="panel-header"><div><h2>Tax Forms</h2><p>Request demo trading tax forms for realized activity and annual reporting.</p></div></header>
        <div className="account-grid">
          {['1099-B Trading Activity', '1099-DIV Dividend Summary', 'Year-End Gain/Loss Report'].map((form) => (
            <article className="account-card" key={form}><span>{form}</span><strong>Available On Request</strong><button className="secondary-button" type="button" onClick={() => setStatus(`${form} request queued.`)}>Request Form</button></article>
          ))}
        </div>
      </section>
    </div>
  );
}
