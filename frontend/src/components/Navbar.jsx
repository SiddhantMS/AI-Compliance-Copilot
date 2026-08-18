import React, { useState, useEffect } from 'react';
import { Shield, Play, Activity, CheckCircle, XCircle, LogOut, User, Lock, Settings, Clock } from 'lucide-react';
import axios from 'axios';

export default function Navbar({ activeTab, setActiveTab, onRunPipeline, runningPipeline, currentUser, onLogout }) {
  const [backendOnline, setBackendOnline] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate remaining time until next 6-hour Airflow run (00:00, 06:00, 12:00, 18:00 UTC)
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const nextRun = new Date(now);
      
      const currentHour = now.getHours();
      const nextHour = Math.ceil((currentHour + 0.0001) / 6) * 6;
      
      if (nextHour >= 24) {
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(0, 0, 0, 0);
      } else {
        nextRun.setHours(nextHour, 0, 0, 0);
      }

      const diffMs = nextRun - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');

      setTimeLeft(`${hStr}h ${mStr}m ${sStr}s`);
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get('/api/health', { timeout: 8000 });
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const userRole = currentUser?.role || 'compliance_officer';

  // Role-Based Tab Configurations
  const getRoleTabs = () => {
    if (userRole === 'auditor') {
      return [
        { id: 'tickets', label: 'Tickets (Read-Only)' },
        { id: 'drift', label: 'Drift Analytics' },
        { id: 'audit', label: 'Audit Trail (CSV Export)' }
      ];
    } else if (userRole === 'admin') {
      return [
        { id: 'admin', label: 'System Admin' },
        { id: 'tickets', label: 'Tickets Queue' },
        { id: 'drift', label: 'Drift Analytics' },
        { id: 'audit', label: 'Audit Logs' }
      ];
    } else {
      // Compliance Officer (Full Access)
      return [
        { id: 'tickets', label: 'Tickets Queue' },
        { id: 'drift', label: 'Drift Analytics' },
        { id: 'upload', label: 'Audit Policy & Print' },
        { id: 'audit', label: 'Audit Trail' },
        { id: 'chat', label: 'Ask AI' }
      ];
    }
  };

  const roleTabs = getRoleTabs();

  return (
    <header className="app-header no-print">
      <div style={{ maxWidth: '1380px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand Title & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)'
          }}>
            <Shield size={24} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                Nexa <span style={{ color: '#A855F7' }}>Compliance</span>
              </h1>
              
              {/* AI Engine Status Badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                background: backendOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: backendOnline ? '#34D399' : '#FCA5A5',
                border: `1px solid ${backendOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: backendOnline ? '#34D399' : '#EF4444' }} />
                {backendOnline ? 'AI Engine: Online' : 'AI Engine: Offline'}
              </span>

              {/* Airflow 6-Hour Reverse Countdown Timer Badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                background: 'rgba(168, 85, 247, 0.18)',
                color: '#C084FC',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)'
              }} title="Airflow 6-Hour Automated Pipeline Sync Timer">
                <Clock size={11} color="#C084FC" />
                Airflow Sync in: <strong style={{ color: '#F8FAFC' }}>{timeLeft}</strong>
              </span>
            </div>

            {/* Role Profile Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#C084FC',
                background: 'rgba(168, 85, 247, 0.15)',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontFamily: 'var(--font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <User size={11} /> {currentUser?.name || 'Compliance Officer'} ({userRole.toUpperCase()})
              </span>
              <span style={{ color: '#475569', fontSize: '11px' }}>•</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#CBD5E1', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>SEBI</span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#CBD5E1', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>RBI</span>
            </div>
          </div>
        </div>

        {/* Role-Based Tab Navigation */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '9999px', border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '2px' }}>
          {roleTabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Controls & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {userRole !== 'auditor' && (
            <button
              className="pill-btn-purple"
              onClick={onRunPipeline}
              disabled={runningPipeline}
              style={{ fontSize: '13px', padding: '8px 18px' }}
            >
              {runningPipeline ? <Activity className="animate-spin" size={14} /> : <Play size={14} />}
              {runningPipeline ? 'Running Pipeline...' : 'Run Pipeline'}
            </button>
          )}

          <button
            onClick={onLogout}
            className="pill-btn-glass"
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

      </div>
    </header>
  );
}

