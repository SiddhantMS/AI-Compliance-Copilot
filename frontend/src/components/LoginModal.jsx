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
      const res = await axios.post('http://localhost:8001/api/login', { username, password });
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
      const res = await axios.post('http://localhost:8001/api/login', { username: u, password: p });
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
      background: 'rgba(12, 27, 51, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: '440px', background: '#FFFFFF',
        borderRadius: 16, border: '2px solid #0C1B33', padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'fadeIn 0.25s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#0C1B33', padding: 8, borderRadius: 8, color: '#F59E0B' }}>
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 800, color: '#0C1B33' }}>
                Bank of India Portal Sign-In
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Role-Based Access Control (RBAC)</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="search-input"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="search-input"
              required
            />
          </div>

          <button type="submit" className="action-btn" disabled={loading} style={{ justifyContent: 'center', marginTop: 6 }}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick Demo Role Switcher:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { u: 'officer', p: 'officer123', label: 'Compliance Officer', role: 'compliance_officer', badge: '#B45309' },
              { u: 'auditor', p: 'auditor123', label: 'RBI Auditor (Read-Only)', role: 'auditor', badge: '#059669' },
              { u: 'admin', p: 'admin123', label: 'System Admin', role: 'admin', badge: '#0C1B33' },
            ].map(r => (
              <button key={r.u} onClick={() => quickSwitch(r.u, r.p)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                background: currentUser?.username === r.u ? '#F8FAFC' : '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem'
              }}>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{r.label}</span>
                <span className="badge" style={{ background: `${r.badge}15`, color: r.badge, border: `1px solid ${r.badge}40`, fontSize: '0.68rem' }}>
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
