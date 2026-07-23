import React, { useState } from 'react';
import { Download, Search, History } from 'lucide-react';

export default function AuditView({ auditLogs = [], loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState('ALL');

  const agents = ['ALL', ...new Set(auditLogs.map(l => l.agent_name).filter(Boolean))];

  const filteredLogs = auditLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesAgent = agentFilter === 'ALL' || log.agent_name === agentFilter;
    const matchesSearch = (
      log.agent_name?.toLowerCase().includes(term) ||
      log.step?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term) ||
      String(log.circular_id).includes(term)
    );
    return matchesAgent && matchesSearch;
  });

  const exportCSV = () => {
    if (!auditLogs.length) return;
    const headers = ['ID', 'Timestamp', 'Circular ID', 'Agent Name', 'Step', 'Action', 'Details'];
    const rows = auditLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.circular_id}"`,
      `"${l.agent_name}"`,
      `"${l.step}"`,
      `"${l.action}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bank_of_india_compliance_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* ── Control Header ── */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={22} color="#38BDF8" />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>RBI & SEBI Inspectable Audit Trail Log</h3>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Immutable Agentic Decision Log ({auditLogs.length} entries recorded)</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Agent Node Filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              style={{ background: '#0A1628', border: '1px solid #1E3A5F', color: '#F8FAFC', borderRadius: '8px', padding: '7px 12px', fontSize: '0.8rem' }}
            >
              {agents.map(a => <option key={a} value={a}>{a === 'ALL' ? 'All Agent Nodes' : a}</option>)}
            </select>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748B' }} />
              <input 
                type="text"
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ paddingLeft: '32px', fontSize: '0.82rem', padding: '7px 10px 7px 32px' }}
              />
            </div>

            {/* Export CSV */}
            <button className="action-btn" onClick={exportCSV} style={{ background: '#1E3A5F', padding: '7px 14px', fontSize: '0.82rem' }}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Audit Logs Table ── */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading audit trail...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '0.88rem' }}>
          No audit logs matching search query.
        </div>
      ) : (
        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0A1628', color: '#64748B', borderBottom: '1px solid #1E3A5F' }}>
                <th style={{ padding: '12px 16px' }}>Log ID</th>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>Circular ID</th>
                <th style={{ padding: '12px 16px' }}>Agent Node</th>
                <th style={{ padding: '12px 16px' }}>Action</th>
                <th style={{ padding: '12px 16px' }}>Regulatory Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 100).map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(30,58,95,0.4)' }}>
                  <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'monospace' }}>#{log.id}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '0.78rem' }}>{log.timestamp ? log.timestamp.split('T')[0] : ''}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#60A5FA', fontWeight: 600 }}>{log.circular_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#F8FAFC' }}>
                    <span style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)', fontSize: '0.75rem' }}>
                      {log.agent_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', color: '#CBD5E1', fontSize: '0.78rem' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#CBD5E1', maxWidth: '450px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
