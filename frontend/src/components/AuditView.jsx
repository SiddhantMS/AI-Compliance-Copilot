import React, { useState } from 'react';
import { Download, Search, History } from 'lucide-react';

export default function AuditView({ auditLogs, loading }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.agent_name.toLowerCase().includes(term) ||
      log.step.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      String(log.circular_id).includes(term)
    );
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
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sebi_rbi_compliance_audit_log.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={20} color="#38BDF8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>RBI & SEBI Inspectable Audit Trail Log</h3>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: '#64748B' }} />
              <input 
                type="text"
                placeholder="Filter audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>

            <button className="action-btn" onClick={exportCSV} style={{ background: '#334155' }}>
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '30px' }}>Loading audit trail...</div>
      ) : (
        <div className="glass-card" style={{ overflowX: 'auto', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '12px 16px' }}>Log ID</th>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>Circular ID</th>
                <th style={{ padding: '12px 16px' }}>Agent Node</th>
                <th style={{ padding: '12px 16px' }}>Step / Action</th>
                <th style={{ padding: '12px 16px' }}>RBI Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 100).map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>#{log.id}</td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8' }}>{log.timestamp ? log.timestamp.split('T')[0] : ''}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#38BDF8' }}>{log.circular_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#F8FAFC' }}>{log.agent_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'rgba(51, 65, 85, 0.5)', padding: '2px 8px', borderRadius: '4px', color: '#E2E8F0' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#CBD5E1', maxWidth: '450px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
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
