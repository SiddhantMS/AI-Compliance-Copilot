import React, { useState } from 'react';
import { UserCheck, Lock, Shield, X, Check } from 'lucide-react';
import axios from 'axios';

export default function LoginModal({ isOpen, onClose, currentUser, onLoginSuccess }) {
  const [username, setUsername] = useState('officer');
  const [password, setPassword] = useState('officer123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/login', { username, password });
      onLoginSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickSwitch = async (u, p) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/login', { username: u, password: p });
      onLoginSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Quick switch failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 61, 102, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: '440px', background: '#FFFFFF',
        borderRadius: 6, border: '1px solid var(--color-border)', padding: 24,
        boxShadow: 'var(--shadow-elevation)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#082A47', padding: 8, borderRadius: 4, color: '#C88A2E' }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                Bank of India Portal Sign-In
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Role-Based Access Control (RBAC)</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#FDF2F0', border: '1px solid #E8BDB6', color: 'var(--color-risk-high)', padding: '10px 14px', borderRadius: 4, fontSize: '13px', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <button type="submit" className="action-btn" disabled={loading} style={{ justifyContent: 'center', marginTop: 6 }}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick Demo Role Switcher:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { u: 'officer', p: 'officer123', label: 'Compliance Officer', role: 'compliance_officer', badge: 'badge-p2' },
              { u: 'auditor', p: 'auditor123', label: 'RBI Auditor (Read-Only)', role: 'auditor', badge: 'badge-p3' },
              { u: 'admin', p: 'admin123', label: 'System Admin', role: 'admin', badge: 'badge-sebi' },
            ].map(r => (
              <button key={r.u} onClick={() => quickSwitch(r.u, r.p)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)',
                background: currentUser?.username === r.u ? '#F7F5F0' : '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', fontSize: '13px'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{r.label}</span>
                <span className={`badge ${r.badge}`}>
                  {r.u} {currentUser?.username === r.u && <Check size={10} style={{ marginLeft: 2 }} />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

