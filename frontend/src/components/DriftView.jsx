import React, { useState } from 'react';
import { BarChart3, PieChart, Info, Activity } from 'lucide-react';

export default function DriftView({ analytics }) {
  const [regulatorFilter, setRegulatorFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  if (!analytics) return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
      <Activity size={32} className="animate-spin" style={{ marginBottom: '12px', color: '#3B82F6' }} />
      <div>Loading policy drift analytics...</div>
    </div>
  );

  const { total_evaluated, avg_drift, priority_counts = {}, domain_scores = [] } = analytics;

  const filteredScores = domain_scores.filter(item => {
    const matchesReg = regulatorFilter === 'ALL' || item.regulator === regulatorFilter;
    const matchesPrio = priorityFilter === 'ALL' || item.priority.includes(priorityFilter);
    return matchesReg && matchesPrio;
  });

  return (
    <div>
      {/* ── Key Metrics Cards ── */}
      <div className="metrics-grid">
        <div className="glass-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Circulars Evaluated</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#F8FAFC' }}>
            {total_evaluated || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>SEBI & RBI Regulatory Directives</div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #06B6D4' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>Average Policy Drift Score</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#38BDF8' }}>
            {avg_drift ? avg_drift.toFixed(4) : '0.0000'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>Range: 0.0 (Matched) — 1.0 (Critical Drift)</div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #EF4444' }}>
          <div style={{ color: '#F87171', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>High Priority (P1) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#F87171' }}>
            {priority_counts['HIGH (P1)'] || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#F87171', marginTop: '4px' }}>Immediate SLA Remediation Required</div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div style={{ color: '#FBBF24', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>Medium Priority (P2) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: '#FBBF24' }}>
            {priority_counts['MEDIUM (P2)'] || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#FBBF24', marginTop: '4px' }}>45-Day Compliance Audit SLA</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* ── Drift Score Breakdown ── */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="#38BDF8" /> Policy Drift Scores ({filteredScores.length})
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={regulatorFilter} 
                onChange={(e) => setRegulatorFilter(e.target.value)}
                style={{ background: '#0A1628', border: '1px solid #1E3A5F', color: '#F8FAFC', borderRadius: '8px', padding: '5px 10px', fontSize: '0.78rem' }}
              >
                <option value="ALL">All Regulators</option>
                <option value="SEBI">SEBI</option>
                <option value="RBI">RBI</option>
              </select>

              <select 
                value={priorityFilter} 
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ background: '#0A1628', border: '1px solid #1E3A5F', color: '#F8FAFC', borderRadius: '8px', padding: '5px 10px', fontSize: '0.78rem' }}
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">HIGH (P1)</option>
                <option value="MEDIUM">MEDIUM (P2)</option>
                <option value="LOW">LOW (P3)</option>
              </select>
            </div>
          </div>
          
          {filteredScores.length === 0 ? (
            <div style={{ color: '#64748B', textAlign: 'center', padding: '30px', fontSize: '0.85rem' }}>
              No drift scores match current filter criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredScores.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid #1E3A5F' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span>
                      <strong style={{ color: item.regulator === 'SEBI' ? '#60A5FA' : '#34D399', marginRight: '6px' }}>[{item.regulator}]</strong> 
                      <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{item.title}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: '#38BDF8', marginLeft: '10px' }}>{item.drift_score.toFixed(4)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem', color: '#64748B' }}>
                    <span>Domain: {item.domain}</span>
                    <span className={`badge ${item.priority.includes('HIGH') ? 'badge-high' : item.priority.includes('MEDIUM') ? 'badge-medium' : 'badge-low'}`}>
                      {item.priority}
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: '#0A1628', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, item.drift_score * 100)}%`, 
                        height: '100%', 
                        background: item.priority.includes('HIGH') 
                          ? 'linear-gradient(90deg, #EF4444, #DC2626)' 
                          : item.priority.includes('MEDIUM') 
                          ? 'linear-gradient(90deg, #F59E0B, #D97706)' 
                          : 'linear-gradient(90deg, #6366F1, #4F46E5)',
                        borderRadius: '4px', transition: 'width 0.5s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Routing Distribution & Mathematical Formula ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} color="#FBBF24" /> Evaluation Routing Distribution
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-high">HIGH (P1) — Drift &gt; 0.80</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#F87171' }}>{priority_counts['HIGH (P1)'] || 0}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-medium">MEDIUM (P2) — Drift 0.60 - 0.79</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FBBF24' }}>{priority_counts['MEDIUM (P2)'] || 0}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-low">LOW (P3) — Drift 0.40 - 0.59</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#A5B4FC' }}>{priority_counts['LOW (P3)'] || 0}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.3)' }}>Archived — Drift &lt; 0.40</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#94A3B8' }}>{priority_counts['Archive'] || 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid #38BDF8' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={16} /> Weighted Drift Score Calculation Formula
            </h4>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#CBD5E1', lineHeight: '1.6', background: '#0A1628', padding: '10px 14px', borderRadius: '8px', border: '1px solid #1E3A5F' }}>
              Drift Score = (0.60 × Cosine Similarity) + (0.25 × Keyword Match) + (0.15 × NER Entity Match)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
