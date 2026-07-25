import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Trash2, Clock, CheckCircle2,
  Circle, History, X, Search, Activity,
  ChevronDown, ChevronUp, ArrowRight, UserCheck, Lock, Shield, Scale, FileText, ExternalLink
} from 'lucide-react';
import axios from 'axios';

// ── Status config ──────────────────────────────────────────────
const STATUSES = {
  not_started: { label: 'Not Started', icon: Circle,        color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  in_progress:  { label: 'In Progress', icon: Activity,      color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  pending:      { label: 'Pending',     icon: Clock,         color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  done:         { label: 'Done',        icon: CheckCircle2,  color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
};

const PRIORITY_CONFIG = {
  HIGH:   { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  MEDIUM: { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  LOW:    { color: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
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
        borderRadius: '6px', padding: '5px 12px', color: cfg.color,
        fontSize: '0.75rem', fontWeight: 700
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
        borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
        color: cfg.color, fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.02em', whiteSpace: 'nowrap'
      }}>
        <Icon size={13} />
        {cfg.label}
        <ChevronDown size={12} style={{ marginLeft: 2 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '115%', right: 0, zIndex: 100,
          background: '#FFFFFF', border: '1px solid #CBD5E1',
          borderRadius: '8px', padding: '6px', minWidth: '150px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
        }}>
          {Object.entries(STATUSES).map(([key, s]) => {
            const SIcon = s.icon;
            return (
              <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 12px', borderRadius: '6px', border: 'none',
                background: key === value ? s.bg : 'transparent',
                color: key === value ? s.color : '#334155',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
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
  const sealColor = isHigh ? '#DC2626' : isMed ? '#D97706' : '#059669';
  const sealBg = isHigh ? '#FEF2F2' : isMed ? '#FFFBEB' : '#ECFDF5';

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '68px', height: '68px', borderRadius: '50%', background: sealBg,
      border: `2px dashed ${sealColor}`, padding: '4px', textAlign: 'center', flexShrink: 0
    }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, color: sealColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        DRIFT
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 800, color: sealColor, lineHeight: 1 }}>
        {driftScore.toFixed(4)}
      </div>
      <div style={{ fontSize: '0.55rem', fontWeight: 700, color: sealColor, textTransform: 'uppercase', marginTop: 1 }}>
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
    <div className="glass-card" style={{
      position: 'relative', overflow: 'hidden', minHeight: '380px',
      display: 'flex', flexDirection: 'column', borderLeft: `5px solid ${pc.color}`
    }}>
      {/* ── Header Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <InspectionSeal driftScore={ticket.drift_score || 0} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.85rem', color: '#0C1B33' }}>
                {ticket.ticket_id}
              </span>
              <span className={`badge ${reg ? 'badge-sebi' : 'badge-rbi'}`}>
                {ticket.regulator}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
                {prio}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 3 }}>
              Domain: <strong style={{ color: '#0F172A' }}>{ticket.domain}</strong>
            </div>
          </div>
        </div>

        <StatusDropdown value={status} onChange={onStatusChange} disabled={isAuditor} />
      </div>

      {/* ── Side-by-Side Document Comparison Panel ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10,
        marginBottom: 14, background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 10, padding: 12
      }}>
        {/* Fetched Official Regulation */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: reg ? '#1D4ED8' : '#6D28D9', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Scale size={12} /> Fetched {ticket.regulator} Regulation
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
            {ticket.circular_title || `${ticket.regulator} Directive #${ticket.circular_id}`}
          </div>
        </div>

        {/* Matched Internal Bank Policy */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileText size={12} /> Compared BOI Internal Policy
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ticket.affected_policies?.length > 0 ? (
              ticket.affected_policies.map((pol, i) => (
                <span key={i} style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700, border: '1px solid #FDE68A' }}>
                  📄 {pol}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>BOI Internal Policy Standard</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Executive Summary Box ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 14px', marginBottom: 14, flex: 1 }}>
        <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
          Compliance Executive Summary & Gap Assessment
        </div>
        <div style={{ fontSize: '0.86rem', color: '#1E293B', lineHeight: 1.55 }}>
          {ticket.summary}
        </div>
      </div>

      {/* ── Ticket Assignment Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '6px 10px', background: '#F1F5F9', borderRadius: 6, fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600 }}>
          <UserCheck size={14} color="#0C1B33" /> Assigned To:
        </div>
        {isAuditor ? (
          <span style={{ fontWeight: 700, color: '#0F172A' }}>{ticket.assigned_to || 'Unassigned'}</span>
        ) : (
          <select
            value={ticket.assigned_to || 'Unassigned'}
            onChange={e => onAssignChange(ticket.ticket_id, e.target.value)}
            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', outline: 'none' }}
          >
            <option value="Unassigned">Unassigned</option>
            {users.map(u => (
              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Expand Action Items ── */}
      <button onClick={() => setExpanded(e => !e)} style={{
        background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 6,
        color: '#1D4ED8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4,
        marginBottom: 10, width: 'fit-content'
      }}>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide Action Plan' : 'Show Action Plan'}
      </button>

      {expanded && (
        <div style={{ animation: 'fadeIn 0.25s ease', marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginBottom: 4 }}>
            Mandatory Action Items:
          </div>
          {ticket.change_list?.slice(0, 3).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <ArrowRight size={12} color="#059669" style={{ marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Done & Archive Action ── */}
      {isDone && !isAuditor && (
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>✓ Ready for Audit Archive</span>
          <button onClick={onDelete} style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6,
            color: '#DC2626', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
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
        const res = await axios.get('http://localhost:8001/api/users');
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
      await axios.post(`http://localhost:8001/api/tickets/${id}/status`, {
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
      await axios.post(`http://localhost:8001/api/tickets/${id}/assign`, {
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
    <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
      <Activity size={32} className="animate-spin" style={{ color: '#0C1B33' }} />
      <div style={{ marginTop: 12 }}>Loading compliance remediation tickets...</div>
    </div>
  );

  return (
    <div>
      {/* ── Institution Header Banner ── */}
      <div className="glass-card" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 800, color: '#0C1B33' }}>
              SEBI & RBI Compliance Remediation Tickets
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              Bank of India Operational Risk Oversight · Role: <strong>{currentUser?.full_name || 'Compliance Officer'}</strong> ({currentUser?.role || 'compliance_officer'})
            </p>
          </div>

          <button onClick={() => setShowHistory(h => !h)} className="gold-btn">
            <History size={15} />
            Archived Audit History ({history.length})
          </button>
        </div>
      </div>

      {/* ── History Drawer ── */}
      {showHistory && (
        <div className="glass-card" style={{ marginBottom: 20, border: '2px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>Archived Compliance Tickets</h3>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {history.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#64748B', padding: '20px 0', textAlign: 'center' }}>No archived tickets.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {history.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px 14px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                  <div>
                    <strong style={{ color: '#0C1B33', marginRight: 8 }}>{t.ticket_id}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#475569' }}>{t.summary?.slice(0, 80)}...</span>
                  </div>
                  {!isAuditor && <button onClick={() => handleRestore(t)} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Restore</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Filter by Ticket ID, Domain, Regulation Title, Keyword..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSliderIndex(0); }}
            className="search-input"
            style={{ paddingLeft: 36 }}
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
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
          No compliance tickets match current filter selection.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSliderIndex(s => Math.max(0, s - 1))} disabled={!canPrev} className="action-btn" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
                <ChevronLeft size={14} /> Previous
              </button>
              <button onClick={() => setSliderIndex(s => s + 1)} disabled={!canNext} className="action-btn" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
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
