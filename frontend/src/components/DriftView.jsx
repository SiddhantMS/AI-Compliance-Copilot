import React, { useState } from 'react';
import { BarChart3, PieChart, Filter } from 'lucide-react';

export default function DriftView({ analytics }) {
  const [regulatorFilter, setRegulatorFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  if (!analytics) return <div className="glass-card">Loading drift analytics...</div>;

  const { total_evaluated, total_tickets, avg_drift, priority_counts, regulator_counts, domain_scores } = analytics;

  const filteredScores = (domain_scores || []).filter(item => {
    const matchesReg = regulatorFilter === 'ALL' || item.regulator === regulatorFilter;
    const matchesPrio = priorityFilter === 'ALL' || item.priority.includes(priorityFilter);
    return matchesReg && matchesPrio;
  });

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card">
          <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Total Circulars Evaluated</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#F8FAFC' }}>
            {total_evaluated || 0}
          </div>
        </div>
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
          <div style={{ color: '#FBBF24', fontSize: '0.85rem' }}>Medium Priority (P2) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: '#FBBF24' }}>
            {priority_counts['MEDIUM (P2)'] || 0}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* All Circular Drift Scores List */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="#38BDF8" /> All Evaluated Policy Drift Scores ({filteredScores.length})
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={regulatorFilter} 
                onChange={(e) => setRegulatorFilter(e.target.value)}
                className="search-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Regulators</option>
                <option value="SEBI">SEBI</option>
                <option value="RBI">RBI</option>
              </select>

              <select 
                value={priorityFilter} 
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="search-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Tiers</option>
                <option value="HIGH">HIGH (P1)</option>
                <option value="MEDIUM">MEDIUM (P2)</option>
                <option value="LOW">LOW (P3)</option>
                <option value="Archive">Archive</option>
              </select>
            </div>
          </div>
          
          {filteredScores.length === 0 ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: '20px' }}>
              No drift scores recorded yet. Click "Run Pipeline" to trigger ingestion & evaluation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '450px', overflowY: 'auto', paddingRight: '6px' }}>
              {filteredScores.map((item, idx) => (
                <div key={idx} style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span>
                      <strong style={{ color: item.regulator === 'SEBI' ? '#60A5FA' : '#34D399', marginRight: '6px' }}>[{item.regulator}]</strong> 
                      <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{item.title}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: '#38BDF8', marginLeft: '10px' }}>{item.drift_score.toFixed(4)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.78rem', color: '#94A3B8' }}>
                    <span>Domain: {item.domain}</span>
                    <span className={`badge ${item.priority.includes('HIGH') ? 'badge-high' : item.priority.includes('MEDIUM') ? 'badge-medium' : item.priority.includes('LOW') ? 'badge-low' : ''}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                      {item.priority}
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: '#1E293B', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, item.drift_score * 100)}%`, 
                        height: '100%', 
                        background: item.priority.includes('HIGH') ? 'linear-gradient(90deg, #EF4444, #DC2626)' : (item.priority.includes('MEDIUM') ? 'linear-gradient(90deg, #F59E0B, #D97706)' : (item.priority.includes('LOW') ? 'linear-gradient(90deg, #6366F1, #4F46E5)' : 'linear-gradient(90deg, #64748B, #475569)')),
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Tier Distribution & Formula */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={18} color="#FBBF24" /> Evaluation Routing Distribution
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

              <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94A3B8', border: '1px solid #475569' }}>Archived Gate — Drift &lt; 0.40</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{priority_counts['Archive'] || 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.9)', borderLeft: '4px solid #38BDF8' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38BDF8', marginBottom: '6px' }}>
              📐 Weighted Drift Score Calculation Formula
            </h4>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#CBD5E1', lineHeight: '1.6' }}>
              Drift Score = (0.60 × Semantic Cosine Sim) + (0.25 × Policy Keyword Match) + (0.15 × NER Entity Match)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
