import React, { useState } from 'react';
import { Shield, Lock, Mail, Key, ArrowRight, CheckCircle2, ShieldAlert, UserCheck } from 'lucide-react';
import axios from 'axios';

export default function LoginView({ onLoginSuccess, onBackToLanding }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    {
      role: 'compliance_officer',
      title: 'Senior Compliance Officer',
      email: 'officer@bankofindia.co.in',
      password: 'Officer2026!',
      badgeColor: '#0B3D66',
      desc: 'Full Access: Audit policies, run pipeline, create & approve policy patches.'
    },
    {
      role: 'auditor',
      title: 'Internal / RBI Auditor',
      email: 'auditor@bankofindia.co.in',
      password: 'Auditor2026!',
      badgeColor: '#3A7A5D',
      desc: 'Read-Only Audit: Inspect tickets, drift scores & export immutable CSV logs.'
    },
    {
      role: 'admin',
      title: 'System Administrator',
      email: 'admin@bankofindia.co.in',
      password: 'Admin2026!',
      badgeColor: '#C88A2E',
      desc: 'Admin Controls: System configuration, vector store status & user management.'
    }
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post('/api/auth/login', {
        email: email.trim(),
        password: password
      });

      if (res.data.status === 'success') {
        onLoginSuccess(res.data.user, res.data.access_token);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setErrorMsg(err.response.data.detail);
      } else {
        setErrorMsg('Authentication failed. Ensure FastAPI backend is running on port 8001.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrorMsg('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box'
    }}>
      {onBackToLanding && (
        <div style={{ maxWidth: '1000px', width: '100%', marginBottom: '16px' }}>
          <button
            onClick={onBackToLanding}
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Back to Platform Overview
          </button>
        </div>
      )}

      <div style={{
        maxWidth: '1000px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px',
        alignItems: 'stretch'
      }}>

        {/* Left Side: Enterprise Portal Login Form */}
        <div className="glass-card" style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#0B3D66', padding: '12px', borderRadius: '8px', display: 'flex' }}>
              <Shield size={28} color="#C88A2E" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--color-primary)', margin: 0 }}>
                Bank of India
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                AI COMPLIANCE COPILOT — ENTERPRISE PORTAL
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Sign in with your authorized Bank of India credentials to access role-tailored regulatory drift monitoring & policy management.
          </p>

          {errorMsg && (
            <div style={{
              background: 'rgba(178,58,46,0.1)',
              border: '1px solid #B23A2E',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#B23A2E',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldAlert size={16} />
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Mail size={14} color="#C084FC" /> Official Email Address:
              </label>
              <input 
                type="email"
                required
                placeholder="e.g. officer@bankofindia.co.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="search-input"
                style={{ width: '100%', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: '#F8FAFC', padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Key size={14} color="#C084FC" /> Password:
              </label>
              <input 
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="search-input"
                style={{ width: '100%', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: '#F8FAFC', padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="pill-btn-purple"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? 'Authenticating Credentials...' : 'Secure Sign In'} <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            🔒 256-Bit Encrypted JWT Authentication • SEBI & RBI Regulated
          </div>
        </div>

        {/* Right Side: Demo Credentials & Role Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-serif)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔑 Select a Demo Role to Test Specific Permissions:
          </div>

          {demoAccounts.map((acc, idx) => {
            const isSelected = email === acc.email;
            return (
              <div
                key={idx}
                onClick={() => handleQuickSelect(acc)}
                style={{
                  background: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '2px solid #A855F7' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: isSelected ? '0 0 20px rgba(168, 85, 247, 0.3)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    background: isSelected ? 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {acc.title}
                  </span>
                  {isSelected && <CheckCircle2 size={18} color="#A855F7" />}
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)', margin: '6px 0 4px 0' }}>
                  {acc.email}
                </div>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                  {acc.desc}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
