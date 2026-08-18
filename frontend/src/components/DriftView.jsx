import React, { useState } from 'react';
import { BarChart3, PieChart, Info, Activity } from 'lucide-react';

function SegmentedDriftGauge({ score, showLabels = true }) {
  const percentage = Math.max(0, Math.min(100, (score || 0) * 100));

  return (
    <div style={{ margin: '8px 0' }}>
      {/* Horizontal Segmented Gauge */}
      <div style={{
        position: 'relative',
        height: '14px',
        borderRadius: '3px',
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid #E2DFD6',
        background: '#FFFFFF'
      }}>
        {/* Zone 1: Archive (<0.40) */}
        <div style={{ width: '40%', background: '#EBE8DF', height: '100%', borderRight: '1px solid #E2DFD6' }} title="Archive Zone (<0.40)" />
        {/* Zone 2: Low P3 (0.40 - 0.59) */}
        <div style={{ width: '20%', background: '#D2E6DC', height: '100%', borderRight: '1px solid #E2DFD6' }} title="P3 Low Risk (0.40 - 0.59)" />
        {/* Zone 3: Medium P2 (0.60 - 0.79) */}
        <div style={{ width: '20%', background: '#F7E5CD', height: '100%', borderRight: '1px solid #E2DFD6' }} title="P2 Medium Risk (0.60 - 0.79)" />
        {/* Zone 4: High P1 (>=0.80) */}
        <div style={{ width: '20%', background: '#F7D6D3', height: '100%' }} title="P1 High Risk (>=0.80)" />

        {/* Pointer Pin Marker */}
        <div style={{
          position: 'absolute',
          left: `calc(${percentage}% - 2px)`,
          top: 0,
          bottom: 0,
          width: '4px',
          background: '#0B3D66',
          boxShadow: '0 0 2px rgba(0,0,0,0.4)',
          zIndex: 5
        }} />
      </div>

      {showLabels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5B6470', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
          <span>0.00 (Archive)</span>
          <span>0.40 (P3)</span>
          <span>0.60 (P2)</span>
          <span>0.80 (P1)</span>
          <span>1.00</span>
        </div>
      )}
    </div>
  );
}

export default function DriftView({ analytics }) {
  const [regulatorFilter, setRegulatorFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  if (!analytics) return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
      <Activity size={28} className="animate-spin" style={{ marginBottom: '12px', color: 'var(--color-primary)' }} />
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
        <div className="glass-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Total Circulars Evaluated</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
            {total_evaluated || 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>SEBI & RBI Regulatory Directives</div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Average Policy Drift Score</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            {avg_drift ? avg_drift.toFixed(4) : '0.0000'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Scale: 0.0 (Matched) to 1.0 (Critical Drift)</div>
        </div>

        <div className="glass-card card-p1">
          <div style={{ color: 'var(--color-risk-high)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>High Priority (P1) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-risk-high)', fontFamily: 'var(--font-mono)' }}>
            {priority_counts['HIGH (P1)'] || 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-risk-high)', marginTop: '4px' }}>Immediate Remediation SLA</div>
        </div>

        <div className="glass-card card-p2">
          <div style={{ color: 'var(--color-risk-medium)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Medium Priority (P2) Drift</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-risk-medium)', fontFamily: 'var(--font-mono)' }}>
            {priority_counts['MEDIUM (P2)'] || 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-risk-medium)', marginTop: '4px' }}>45-Day Compliance Audit SLA</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* ── Drift Score Breakdown ── */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-serif)' }}>
              <BarChart3 size={18} color="var(--color-primary)" /> Policy Drift Segmented Evaluation ({filteredScores.length})
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={regulatorFilter} 
                onChange={(e) => setRegulatorFilter(e.target.value)}
              >
                <option value="ALL">All Regulators</option>
                <option value="SEBI">SEBI</option>
                <option value="RBI">RBI</option>
              </select>

              <select 
                value={priorityFilter} 
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">HIGH (P1)</option>
                <option value="MEDIUM">MEDIUM (P2)</option>
                <option value="LOW">LOW (P3)</option>
              </select>
            </div>
          </div>
          
          {filteredScores.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '30px', fontSize: '14px' }}>
              No drift scores match current filter criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '460px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredScores.map((item, idx) => (
                <div key={idx} style={{ background: '#F7F5F0', padding: '14px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '14px', marginBottom: '6px' }}>
                    <span>
                      <strong style={{ color: item.regulator === 'SEBI' ? '#1D5B8C' : '#236B48', marginRight: '6px' }}>[{item.regulator}]</strong> 
                      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{item.title}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>
                      {item.drift_score.toFixed(4)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    <span>Domain: {item.domain}</span>
                    <span className={`badge ${item.priority.includes('HIGH') ? 'badge-p1' : item.priority.includes('MEDIUM') ? 'badge-p2' : item.priority.includes('LOW') ? 'badge-p3' : 'badge-archive'}`}>
                      {item.priority}
                    </span>
                  </div>

                  {/* Horizontal Segmented Drift Gauge */}
                  <SegmentedDriftGauge score={item.drift_score} showLabels={false} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Routing Distribution & Formula ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-serif)' }}>
              <PieChart size={18} color="var(--color-accent)" /> Evaluation Routing Distribution
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#F7F5F0', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-p1">HIGH (P1) — Drift &gt; 0.80</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-risk-high)', fontFamily: 'var(--font-mono)' }}>{priority_counts['HIGH (P1)'] || 0}</span>
              </div>

              <div style={{ background: '#F7F5F0', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-p2">MEDIUM (P2) — Drift 0.60 - 0.79</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-risk-medium)', fontFamily: 'var(--font-mono)' }}>{priority_counts['MEDIUM (P2)'] || 0}</span>
              </div>

              <div style={{ background: '#F7F5F0', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-p3">LOW (P3) — Drift 0.40 - 0.59</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-risk-low)', fontFamily: 'var(--font-mono)' }}>{priority_counts['LOW (P3)'] || 0}</span>
              </div>

              <div style={{ background: '#F7F5F0', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-archive">Archived — Drift &lt; 0.40</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{priority_counts['Archive'] || 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-serif)' }}>
              <Info size={16} /> Regulatory Drift Score Mathematical Model
            </h4>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.6', background: '#F7F5F0', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
              Drift Score = (0.60 × Cosine Similarity) + (0.25 × Keyword Match) + (0.15 × NER Entity Match)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

