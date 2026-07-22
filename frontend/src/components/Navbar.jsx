import React from 'react';
import { Shield, Play, Activity } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onRunPipeline, runningPipeline }) {
  return (
    <header className="glass-card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
            <Shield size={28} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, background: 'linear-gradient(90deg, #F8FAFC, #94A3B8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Compliance Copilot
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94A3B8' }}>
              <span>Bank of India Master Audit</span>
              <span>•</span>
              <span className="badge badge-sebi">SEBI</span>
              <span className="badge badge-rbi">RBI</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', background: '#0F172A', padding: '4px', borderRadius: '10px', border: '1px solid #334155' }}>
          <button className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            🎟️ Tickets
          </button>
          <button className={`tab-btn ${activeTab === 'drift' ? 'active' : ''}`} onClick={() => setActiveTab('drift')}>
            📊 Drift Analytics
          </button>
          <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            📜 Audit Trail
          </button>
          <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            💬 Ask AI
          </button>
        </div>

        {/* Action Button */}
        <button 
          className="action-btn" 
          onClick={onRunPipeline} 
          disabled={runningPipeline}
          style={{ opacity: runningPipeline ? 0.7 : 1 }}
        >
          {runningPipeline ? <Activity className="animate-spin" size={16} /> : <Play size={16} />}
          {runningPipeline ? 'Running SEBI & RBI Pipeline...' : 'Run Pipeline'}
        </button>
      </div>
    </header>
  );
}
