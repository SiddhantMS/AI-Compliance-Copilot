import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Trash2, Clock, CheckCircle2,
  Circle, History, X, Search, Activity,
  ChevronDown, ChevronUp, ArrowRight, UserCheck, Lock, Shield, Scale, FileText, ExternalLink
} from 'lucide-react';
import axios from 'axios';

// ── Status config ──────────────────────────────────────────────
const STATUSES = {
  not_started: { label: 'Not Started', icon: Circle,        color: 'var(--color-text-muted)', bg: '#F1F3F5', border: 'var(--color-border)' },
  in_progress:  { label: 'In Progress', icon: Activity,      color: 'var(--color-primary)', bg: '#EFF6FC', border: '#B5D3EC' },
  pending:      { label: 'Pending',     icon: Clock,         color: 'var(--color-risk-medium)', bg: '#FDF8F0', border: '#F0D4AD' },
  done:         { label: 'Done',        icon: CheckCircle2,  color: 'var(--color-risk-low)', bg: '#F0F7F4', border: '#B8DACD' },
};

const PRIORITY_CONFIG = {
  HIGH:   { color: 'var(--color-risk-high)', bg: '#FDF2F0', border: '#E8BDB6', className: 'card-p1' },
  MEDIUM: { color: 'var(--color-risk-medium)', bg: '#FDF8F0', border: '#F0D4AD', className: 'card-p2' },
  LOW:    { color: 'var(--color-risk-low)', bg: '#F0F7F4', border: '#B8DACD', className: 'card-p3' },
};

const STORAGE_KEY = 'compliance_ticket_statuses';
const HISTORY_KEY = 'compliance_ticket_history';

function getPriority(prio = '') {
  if (prio.includes('HIGH'))   return 'HIGH';
  if (prio.includes('MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

// ── StatusDropdown ─────────────────────────────────────────────
function StatusDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = STATUSES[value] || STATUSES.not_started;
  const Icon = cfg.icon;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (disabled) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '4px', padding: '4px 10px', color: cfg.color,
        fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)'
      }}>
        <Lock size={12} />
        {cfg.label}
      </span>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
        color: cfg.color, fontSize: '12px', fontWeight: 600,
        fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap'
      }}>
        <Icon size={13} />
        {cfg.label}
        <ChevronDown size={12} style={{ marginLeft: 2 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '115%', right: 0, zIndex: 100,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '4px', padding: '4px', minWidth: '150px',
          boxShadow: 'var(--shadow-elevation)'
        }}>
          {Object.entries(STATUSES).map(([key, s]) => {
            const SIcon = s.icon;
            return (
              <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '6px 10px', borderRadius: '4px', border: 'none',
                background: key === value ? s.bg : 'transparent',
                color: key === value ? s.color : 'var(--color-text)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                textAlign: 'left'
              }}>
                <SIcon size={13} />
                {s.label}
                {key === value && <CheckCircle2 size={12} style={{ marginLeft: 'auto', color: s.color }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Signature RBI Inspectable Seal Gauge ───────────────────────
function InspectionSeal({ driftScore }) {
  const isHigh = driftScore > 0.80;
  const isMed = driftScore >= 0.60;
  const sealColor = isHigh ? '#EF4444' : isMed ? '#F59E0B' : '#10B981';
  const sealBg = isHigh ? 'rgba(239,68,68,0.15)' : isMed ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '64px', height: '64px', borderRadius: '50%', background: sealBg,
      border: `2px dashed ${sealColor}`, padding: '4px', textAlign: 'center', flexShrink: 0
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: sealColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        DRIFT
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: sealColor, lineHeight: 1 }}>
        {driftScore.toFixed(4)}
      </div>
      <div style={{ fontSize: '8px', fontWeight: 600, color: sealColor, textTransform: 'uppercase', marginTop: 1 }}>
        INSPECTED
      </div>
    </div>
  );
}

// ── TicketCard ─────────────────────────────────────────────────
function TicketCard({ ticket, status, onStatusChange, onAssignChange, onDelete, users, isAuditor }) {
  const [expanded, setExpanded] = useState(false);
  const prio = getPriority(ticket.priority);
  const pc = PRIORITY_CONFIG[prio];
  const isDone = status === 'done';
  const reg = ticket.regulator === 'SEBI';

  return (
    <div className={`glass-card ${pc.className}`} style={{
      position: 'relative', overflow: 'hidden', minHeight: '380px',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* ── Header Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <InspectionSeal driftScore={ticket.drift_score || 0} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: '#A855F7' }}>
                {ticket.ticket_id}
              </span>
              <span className={`badge ${reg ? 'badge-sebi' : 'badge-rbi'}`}>
                {ticket.regulator}
              </span>
              <span className={`badge ${prio === 'HIGH' ? 'badge-p1' : prio === 'MEDIUM' ? 'badge-p2' : 'badge-p3'}`}>
                {prio}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 3 }}>
              Domain: <strong style={{ color: '#F8FAFC' }}>{ticket.domain}</strong>
            </div>
          </div>
        </div>

        <StatusDropdown value={status} onChange={onStatusChange} disabled={isAuditor} />
      </div>

      {/* ── Side-by-Side Document Comparison Panel ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10,
        marginBottom: 14, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10
      }}>
        {/* Fetched Official Regulation */}
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: reg ? '#38BDF8' : '#34D399', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Scale size={12} /> Fetched {ticket.regulator} Regulation
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', lineHeight: 1.4 }}>
            {ticket.circular_title || `${ticket.regulator} Directive #${ticket.circular_id}`}
          </div>
        </div>

        {/* Matched Internal Bank Policy */}
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#C084FC', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileText size={12} /> Compared BOI Internal Policy
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ticket.affected_policies?.length > 0 ? (
              ticket.affected_policies.map((pol, i) => (
                <span key={i} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#C084FC', padding: '3px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  📄 {pol}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>BOI Internal Policy Standard</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Executive Summary Box ── */}
      <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, flex: 1 }}>
        <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Compliance Executive Summary & Gap Assessment
        </div>
        <div style={{ fontSize: '14px', color: '#F8FAFC', lineHeight: 1.6, fontWeight: 400 }}>
          {ticket.summary}
        </div>
      </div>

      {/* ── Ticket Assignment Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6, fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontWeight: 500 }}>
          <UserCheck size={14} color="#C084FC" /> Assigned To:
        </div>
        {isAuditor ? (
          <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{ticket.assigned_to || 'Unassigned'}</span>
        ) : (
          <select
            value={ticket.assigned_to || 'Unassigned'}
            onChange={e => onAssignChange(ticket.ticket_id, e.target.value)}
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 6, padding: '4px 8px', fontSize: '12px', fontWeight: 600, color: '#F8FAFC', outline: 'none' }}
          >
            <option value="Unassigned" style={{ background: '#0F111A', color: '#F8FAFC' }}>Unassigned</option>
            {users.map(u => (
              <option key={u.username} value={u.full_name} style={{ background: '#0F111A', color: '#F8FAFC' }}>{u.full_name} ({u.role})</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Expand Action Items ── */}
      <button onClick={() => setExpanded(e => !e)} style={{
        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 6,
        color: '#C084FC', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
        padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10, width: 'fit-content'
      }}>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide Action Plan' : 'Show Action Plan'}
      </button>

      {expanded && (
        <div style={{ marginBottom: 12, background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 6, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>
            Mandatory Action Items:
          </div>
          {ticket.change_list?.slice(0, 3).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <ArrowRight size={14} color="#34D399" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#F8FAFC', lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Done & Archive Action ── */}
      {isDone && !isAuditor && (
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-risk-low)', fontWeight: 600 }}>✓ Ready for Audit Archive</span>
          <button onClick={onDelete} style={{
            background: '#FDF2F0', border: '1px solid #E8BDB6', borderRadius: 4,
            color: 'var(--color-risk-high)', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4
          }}>
            <Trash2 size={13} /> Archive
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main TicketsView ───────────────────────────────────────────
export default function TicketsView({ tickets, loading, currentUser }) {
  const [statuses, setStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  });
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  });
  const [users, setUsers] = useState([]);
  const [ticketAssignments, setTicketAssignments] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [regFilter, setRegFilter] = useState('ALL');
  const [prioFilter, setPrioFilter] = useState('ALL');
  const CARDS_PER_PAGE = 3;

  const isAuditor = currentUser?.role === 'auditor';

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses)); }, [statuses]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users');
        setUsers(res.data.users || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    if (isAuditor) return;
    setStatuses(prev => ({ ...prev, [id]: newStatus }));
    try {
      await axios.post(`/api/tickets/${id}/status`, {
        status: newStatus,
        updated_by: currentUser?.full_name || 'Compliance Officer'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignChange = async (id, assignedTo) => {
    if (isAuditor) return;
    setTicketAssignments(prev => ({ ...prev, [id]: assignedTo }));
    try {
      await axios.post(`/api/tickets/${id}/assign`, {
        assigned_to: assignedTo,
        updated_by: currentUser?.full_name || 'Compliance Officer'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchive = (ticket) => {
    if (isAuditor) return;
    setHistory(prev => [{...ticket, archivedAt: Date.now(), status: 'done'}, ...prev]);
    setStatuses(prev => { const n = {...prev}; delete n[ticket.ticket_id]; return n; });
  };

  const handleRestore = (ticket) => {
    if (isAuditor) return;
    setHistory(prev => prev.filter(h => h.ticket_id !== ticket.ticket_id));
    setStatuses(prev => ({ ...prev, [ticket.ticket_id]: 'not_started' }));
  };

  const archivedIds = new Set(history.map(h => h.ticket_id));
  const activeTickets = tickets.filter(t => !archivedIds.has(t.ticket_id));

  const filteredTickets = activeTickets.filter(t => {
    const prio = getPriority(t.priority);
    return (
      (regFilter === 'ALL' || t.regulator === regFilter) &&
      (prioFilter === 'ALL' || prio === prioFilter) &&
      (search === '' ||
        t.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
        t.summary.toLowerCase().includes(search.toLowerCase()) ||
        t.circular_title?.toLowerCase().includes(search.toLowerCase()) ||
        t.domain.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / CARDS_PER_PAGE));
  const safeIndex = Math.min(sliderIndex, Math.max(0, filteredTickets.length - CARDS_PER_PAGE));
  const visibleTickets = filteredTickets.slice(safeIndex, safeIndex + CARDS_PER_PAGE);

  const canPrev = safeIndex > 0;
  const canNext = safeIndex + CARDS_PER_PAGE < filteredTickets.length;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
      <Activity size={28} className="animate-spin" style={{ color: 'var(--color-primary)', marginBottom: 8 }} />
      <div>Loading compliance remediation tickets...</div>
    </div>
  );

  return (
    <div>
      {/* ── Institution Header Banner ── */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-serif)' }}>
              SEBI & RBI Compliance Remediation Tickets
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Bank of India Operational Risk Oversight · Role: <strong>{currentUser?.full_name || 'Compliance Officer'}</strong> ({currentUser?.role || 'compliance_officer'})
            </p>
          </div>

          <button onClick={() => setShowHistory(h => !h)} className="action-btn-secondary" style={{ fontSize: '13px' }}>
            <History size={15} />
            Archived Audit History ({history.length})
          </button>
        </div>
      </div>

      {/* ── History Drawer ── */}
      {showHistory && (
        <div className="glass-card" style={{ marginBottom: 20, borderLeft: '4px solid var(--color-risk-low)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-risk-low)', fontFamily: 'var(--font-serif)' }}>Archived Compliance Tickets</h3>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={16} /></button>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', padding: '16px 0', textAlign: 'center' }}>No archived tickets.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {history.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F7F5F0', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--color-border)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-primary)', marginRight: 8, fontFamily: 'var(--font-mono)' }}>{t.ticket_id}</strong>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t.summary?.slice(0, 80)}...</span>
                  </div>
                  {!isAuditor && <button onClick={() => handleRestore(t)} className="action-btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>Restore</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Filter by Ticket ID, Domain, Regulation Title, Keyword..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSliderIndex(0); }}
            className="search-input"
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>

        <select value={regFilter} onChange={e => setRegFilter(e.target.value)} className="search-input" style={{ width: 'auto' }}>
          <option value="ALL">All Regulators</option>
          <option value="SEBI">SEBI</option>
          <option value="RBI">RBI</option>
        </select>

        <select value={prioFilter} onChange={e => setPrioFilter(e.target.value)} className="search-input" style={{ width: 'auto' }}>
          <option value="ALL">All Priorities</option>
          <option value="HIGH">HIGH (P1)</option>
          <option value="MEDIUM">MEDIUM (P2)</option>
          <option value="LOW">LOW (P3)</option>
        </select>
      </div>

      {/* ── Ticket Grid Carousel ── */}
      {filteredTickets.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          No compliance tickets match current filter selection.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSliderIndex(s => Math.max(0, s - 1))} disabled={!canPrev} className="action-btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                <ChevronLeft size={14} /> Previous
              </button>
              <button onClick={() => setSliderIndex(s => s + 1)} disabled={!canNext} className="action-btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              Showing {safeIndex + 1}–{Math.min(safeIndex + CARDS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length} tickets
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibleTickets.length, 3)}, 1fr)`, gap: 16 }}>
            {visibleTickets.map(ticket => (
              <TicketCard
                key={ticket.ticket_id}
                ticket={{
                  ...ticket,
                  assigned_to: ticketAssignments[ticket.ticket_id] || ticket.assigned_to || 'Unassigned'
                }}
                status={statuses[ticket.ticket_id] || 'not_started'}
                onStatusChange={val => handleStatusChange(ticket.ticket_id, val)}
                onAssignChange={handleAssignChange}
                onDelete={() => handleArchive(ticket)}
                users={users}
                isAuditor={isAuditor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

