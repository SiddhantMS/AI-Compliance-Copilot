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
            <History size={22} color="var(--color-primary)" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-serif)', color: 'var(--color-primary)' }}>
                RBI & SEBI Inspectable Audit Trail Log
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Agent Decision Log (<span style={{ fontFamily: 'var(--font-mono)' }}>{auditLogs.length}</span> entries recorded)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Agent Node Filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              {agents.map(a => <option key={a} value={a}>{a === 'ALL' ? 'All Agent Nodes' : a}</option>)}
            </select>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input 
                type="text"
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>

            {/* Export CSV */}
            <button className="action-btn-secondary" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Audit Logs Table ── */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Loading audit trail...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
          No audit logs matching search query.
        </div>
      ) : (
        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F7F5F0', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', fontSize: '13px' }}>
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
                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>#{log.id}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{log.timestamp ? log.timestamp.split('T')[0] : ''}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 600 }}>{log.circular_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                    <span style={{ background: '#EFF6FC', color: '#1D5B8C', padding: '2px 8px', borderRadius: '4px', border: '1px solid #B5D3EC', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      {log.agent_name}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: '#F7F5F0', padding: '2px 8px', borderRadius: '3px', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: '12px' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text)', maxWidth: '450px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4, fontSize: '13px' }}>
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

