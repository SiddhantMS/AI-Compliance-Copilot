import React, { useState, useEffect } from 'react';
import { Shield, Play, Activity, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

export default function Navbar({ activeTab, setActiveTab, onRunPipeline, runningPipeline }) {
  const [backendOnline, setBackendOnline] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get('http://localhost:8001/api/tickets', { timeout: 3000 });
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-card no-print" style={{ marginBottom: '24px', padding: '16px 24px', border: '1px solid #1E3A5F' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', padding: '10px', borderRadius: '14px', display: 'flex', boxShadow: '0 0 20px rgba(37,99,235,0.3)' }}>
            <Shield size={26} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(90deg, #F8FAFC, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                AI Compliance Copilot
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
                background: backendOnline ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: backendOnline ? '#34D399' : '#F87171',
                border: `1px solid ${backendOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                {backendOnline ? <CheckCircle size={10} /> : <XCircle size={10} />}
                {backendOnline ? 'API Connected' : 'API Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
              <span>Bank of India Audit</span>
              <span>•</span>
              <span className="badge badge-sebi">SEBI</span>
              <span className="badge badge-rbi">RBI</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', background: '#0A1628', padding: '4px', borderRadius: '12px', border: '1px solid #1E3A5F', flexWrap: 'wrap', gap: '4px' }}>
          {[
            { id: 'tickets', label: '🎟️ Tickets' },
            { id: 'drift', label: '📊 Drift Analytics' },
            { id: 'upload', label: '📤 Audit Policy & Print' },
            { id: 'evaluation', label: '🧪 RAGAS Benchmark' },
            { id: 'audit', label: '📜 Audit Trail' },
            { id: 'chat', label: '💬 Ask AI' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <button
          className="action-btn"
          onClick={onRunPipeline}
          disabled={runningPipeline}
          style={{ opacity: runningPipeline ? 0.7 : 1 }}
        >
          {runningPipeline ? <Activity className="animate-spin" size={16} /> : <Play size={16} />}
          {runningPipeline ? 'Running Pipeline...' : 'Run Pipeline'}
        </button>
      </div>
    </header>
  );
}
