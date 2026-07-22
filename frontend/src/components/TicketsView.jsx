import React, { useState } from 'react';
import { AlertCircle, FileText, CheckCircle2, Search, Filter, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export default function TicketsView({ tickets, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [regulatorFilter, setRegulatorFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showRecommendations, setShowRecommendations] = useState(true);

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ticket_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesReg = regulatorFilter === 'ALL' || t.regulator === regulatorFilter;
    const matchesPrio = priorityFilter === 'ALL' || t.priority.includes(priorityFilter);

    return matchesSearch && matchesReg && matchesPrio;
  });

  const getPriorityBadgeClass = (prio) => {
    if (prio.includes('HIGH')) return 'badge-high';
    if (prio.includes('MEDIUM')) return 'badge-medium';
    return 'badge-low';
  };

  return (
    <div>
      {/* Executive Recommendations Summary Banner */}
      <div className="glass-card" style={{ marginBottom: '20px', borderLeft: '5px solid #38BDF8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowRecommendations(!showRecommendations)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#38BDF8" />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Master Executive Compliance Recommendations & Directives</h3>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Actionable policy change roadmap for SEBI & RBI regulatory alignment</div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            {showRecommendations ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {showRecommendations && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', borderTop: '3px solid #EF4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-high">P1 High Priority</span>
                <span style={{ fontSize: '0.75rem', color: '#F87171' }}>15–30 Days SLA</span>
              </div>
              <ul style={{ paddingLeft: '14px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                <li><strong>KYC & V-CIP</strong>: 2-yr re-KYC for high risk & 3-day CKYCR upload SLA.</li>
                <li><strong>Cyber Security</strong>: 24x7 SOC, MFA, and 6-hour incident reporting to CSIRT-Fin.</li>
              </ul>
            </div>

            <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', borderTop: '3px solid #F59E0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-medium">P2 Medium Priority</span>
                <span style={{ fontSize: '0.75rem', color: '#FBBF24' }}>45–60 Days SLA</span>
              </div>
              <ul style={{ paddingLeft: '14px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                <li><strong>SCORES 2.0 Grievances</strong>: Integrate complaint tracking with SEBI 21-day SLAs.</li>
                <li><strong>Treasury Kill Switches</strong>: Deploy order limit kill switches in trading terminals.</li>
              </ul>
            </div>

            <div style={{ background: '#0F172A', padding: '12px 14px', borderRadius: '8px', borderTop: '3px solid #6366F1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-low">P3 Low Priority</span>
                <span style={{ fontSize: '0.75rem', color: '#A5B4FC' }}>90 Days SLA</span>
              </div>
              <ul style={{ paddingLeft: '14px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.5' }}>
                <li><strong>Fair Lending</strong>: Separate loan non-compliance charges from principal capitalization.</li>
                <li><strong>Dormant Accounts</strong>: Automate monthly 10-year dormant sweeps to DEA Fund.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Top Metrics Row */}
      <div className="metrics-grid">
        <div className="glass-card">
          <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Total SEBI & RBI Tickets</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>{tickets.length}</div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#F87171', fontSize: '0.85rem' }}>High Priority (P1)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: '#F87171' }}>
            {tickets.filter(t => t.priority.includes('HIGH')).length}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#FBBF24', fontSize: '0.85rem' }}>Medium Priority (P2)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: '#FBBF24' }}>
            {tickets.filter(t => t.priority.includes('MEDIUM')).length}
          </div>
        </div>
        <div className="glass-card">
          <div style={{ color: '#A5B4FC', fontSize: '0.85rem' }}>Low Priority (P3)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', color: '#A5B4FC' }}>
            {tickets.filter(t => t.priority.includes('LOW')).length}
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748B' }} />
            <input 
              type="text" 
              placeholder="Search tickets by ID, domain, or circular text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#94A3B8" />
            <select 
              value={regulatorFilter} 
              onChange={(e) => setRegulatorFilter(e.target.value)}
              className="search-input"
              style={{ width: 'auto' }}
            >
              <option value="ALL">All Regulators (SEBI & RBI)</option>
              <option value="SEBI">SEBI Only</option>
              <option value="RBI">RBI Only</option>
            </select>

            <select 
              value={priorityFilter} 
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="search-input"
              style={{ width: 'auto' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">HIGH (P1)</option>
              <option value="MEDIUM">MEDIUM (P2)</option>
              <option value="LOW">LOW (P3)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          Loading compliance tickets...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
          No compliance tickets found matching filters.
        </div>
      ) : (
        <div className="tickets-grid">
          {filteredTickets.map((ticket) => (
            <div key={ticket.ticket_id} className="glass-card" style={{ borderLeft: `5px solid ${ticket.priority.includes('HIGH') ? '#EF4444' : ticket.priority.includes('MEDIUM') ? '#F59E0B' : '#6366F1'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8', fontSize: '1.05rem', marginRight: '10px' }}>
                    [{ticket.ticket_id}]
                  </span>
                  <span className={`badge ${ticket.regulator === 'SEBI' ? 'badge-sebi' : 'badge-rbi'}`} style={{ marginRight: '8px' }}>
                    {ticket.regulator}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#E2E8F0', border: '1px solid #334155', marginRight: '8px' }}>
                    {ticket.domain}
                  </span>
                  <span className={`badge ${getPriorityBadgeClass(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  Drift Score: <strong style={{ color: '#F8FAFC' }}>{ticket.drift_score.toFixed(4)}</strong>
                </div>
              </div>

              {/* Summary Box */}
              <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', marginBottom: '14px', borderLeft: '3px solid #3B82F6' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#93C5FD', marginBottom: '4px' }}>Executive Summary</div>
                <div style={{ fontSize: '0.92rem', color: '#E2E8F0' }}>{ticket.summary}</div>
              </div>

              {/* Affected Policies */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#60A5FA" /> Affected Internal Policies:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ticket.affected_policies.map((pol, idx) => (
                    <span key={idx} style={{ background: 'rgba(51, 65, 85, 0.6)', color: '#CBD5E1', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                      📄 {pol}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action List */}
              <div>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} color="#34D399" /> Actionable Compliance Steps:
                </div>
                <ul style={{ listStyleType: 'none', paddingLeft: '0' }}>
                  {ticket.change_list.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '0.88rem', color: '#CBD5E1', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
