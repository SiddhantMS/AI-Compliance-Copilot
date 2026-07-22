import React from 'react';
import { BarChart3, PieChart, ShieldAlert } from 'lucide-react';

export default function DriftView({ analytics }) {
  if (!analytics) return <div className="glass-card">Loading drift analytics...</div>;

  const { total_tickets, avg_drift, priority_counts, regulator_counts, domain_scores } = analytics;

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card">
          <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Average Policy Drift Score</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#38BDF8' }}>
            {avg_drift ? avg_drift.toFixed(4) : '0.0000'}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#F87171', fontSize: '0.85rem' }}>High Priority (P1) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#F87171' }}>
            {priority_counts['HIGH (P1)'] || 0}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#60A5FA', fontSize: '0.85rem' }}>SEBI Circular Drift Tickets</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#60A5FA' }}>
            {regulator_counts['SEBI'] || 0}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#34D399', fontSize: '0.85rem' }}>RBI Circular Drift Tickets</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#34D399' }}>
            {regulator_counts['RBI'] || 0}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Domain Scores Bar Breakdown */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#38BDF8" /> Policy Drift per Domain (SEBI & RBI)
          </h3>
          
          {domain_scores.length === 0 ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: '20px' }}>No drift scores calculated yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {domain_scores.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>
                      <strong style={{ color: item.regulator === 'SEBI' ? '#60A5FA' : '#34D399' }}>[{item.regulator}]</strong> {item.domain}
                    </span>
                    <span style={{ fontWeight: 600 }}>{item.drift_score.toFixed(4)}</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#0F172A', borderRadius: '5px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, item.drift_score * 100)}%`, 
                        height: '100%', 
                        background: item.priority.includes('HIGH') ? 'linear-gradient(90deg, #EF4444, #DC2626)' : (item.priority.includes('MEDIUM') ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #6366F1, #4F46E5)'),
                        borderRadius: '5px'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Tier Distribution */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#FBBF24" /> Priority Tier Distribution
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-high">HIGH (P1) — Drift &gt; 0.80</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{priority_counts['HIGH (P1)'] || 0}</span>
            </div>

            <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-medium">MEDIUM (P2) — Drift 0.60 - 0.79</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{priority_counts['MEDIUM (P2)'] || 0}</span>
            </div>

            <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-low">LOW (P3) — Drift 0.40 - 0.59</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{priority_counts['LOW (P3)'] || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formula Reference Card */}
      <div className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.9)', borderLeft: '4px solid #38BDF8' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38BDF8', marginBottom: '6px' }}>
          📐 Weighted Drift Score Calculation Formula
        </h4>
        <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#CBD5E1' }}>
          Drift Score = (0.60 × Semantic Cosine Sim) + (0.25 × Policy Keyword Match) + (0.15 × NER Entity Match)
        </div>
      </div>
    </div>
  );
}
