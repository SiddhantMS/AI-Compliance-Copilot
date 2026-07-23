import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Trash2, Clock, CheckCircle2,
  Circle, FileText, History, X, Search,
  ShieldAlert, BarChart2, Activity,
  ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────
const STATUSES = {
  not_started: { label: 'Not Started', icon: Circle,        color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', glow: 'none' },
  in_progress:  { label: 'In Progress', icon: Activity,      color: '#06B6D4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.4)',   glow: '0 0 20px rgba(6,182,212,0.25)' },
  pending:      { label: 'Pending',     icon: Clock,         color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',   glow: '0 0 20px rgba(245,158,11,0.2)' },
  done:         { label: 'Done',        icon: CheckCircle2,  color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)',   glow: '0 0 20px rgba(16,185,129,0.25)' },
};

const PRIORITY_CONFIG = {
  HIGH:   { color: '#F43F5E', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.3)',   glow: '#F43F5E' },
  MEDIUM: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  glow: '#F59E0B' },
  LOW:    { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)',  glow: '#8B5CF6' },
};

const STORAGE_KEY = 'compliance_ticket_statuses';
const HISTORY_KEY = 'compliance_ticket_history';

function getPriority(prio = '') {
  if (prio.includes('HIGH'))   return 'HIGH';
  if (prio.includes('MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

// ── StatusDropdown ─────────────────────────────────────────────
function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = STATUSES[value] || STATUSES.not_started;
  const Icon = cfg.icon;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
        color: cfg.color, fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.03em', whiteSpace: 'nowrap',
        boxShadow: cfg.glow, transition: 'all 0.25s ease'
      }}>
        <Icon size={13} />
        {cfg.label}
        <ChevronDown size={12} style={{ marginLeft: 2 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '115%', right: 0, zIndex: 100,
          background: '#0B1120', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px', padding: '8px', minWidth: '160px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)'
        }}>
          {Object.entries(STATUSES).map(([key, s]) => {
            const SIcon = s.icon;
            return (
              <button key={key} onClick={() => { onChange(key); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '8px 12px', borderRadius: '8px', border: 'none',
                background: key === value ? s.bg : 'transparent',
                color: key === value ? s.color : '#94A3B8',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left'
              }}>
                <SIcon size={14} />
                {s.label}
                {key === value && <CheckCircle2 size={13} style={{ marginLeft: 'auto', color: s.color }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TicketCard ─────────────────────────────────────────────────
function TicketCard({ ticket, status, onStatusChange, onDelete, isActive }) {
  const [expanded, setExpanded] = useState(false);
  const prio = getPriority(ticket.priority);
  const pc = PRIORITY_CONFIG[prio];
  const sc = STATUSES[status] || STATUSES.not_started;
  const isDone = status === 'done';
  const reg = ticket.regulator === 'SEBI';

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.8) 0%, rgba(11, 17, 32, 0.95) 100%)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '20px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: isActive
        ? `0 20px 40px -10px rgba(0,0,0,0.6), ${sc.glow}`
        : '0 10px 30px -10px rgba(0,0,0,0.4)',
      transform: isActive ? 'translateY(-2px)' : 'none',
      transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      minHeight: '340px', display: 'flex', flexDirection: 'column'
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: 'absolute', top: -50, right: -50,
        width: 180, height: 180, borderRadius: '50%',
        background: reg
          ? 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Priority Accent Line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 4,
        background: `linear-gradient(to bottom, ${pc.color}, transparent)`,
        borderRadius: '20px 0 0 20px'
      }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingLeft: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem',
              color: '#38BDF8', background: 'rgba(6,182,212,0.1)',
              padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.25)'
            }}>
              {ticket.ticket_id}
            </span>
            <span className={`badge ${reg ? 'badge-sebi' : 'badge-rbi'}`}>
              {ticket.regulator}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
              background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`
            }}>
              {prio}
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
            Domain: <strong style={{ color: '#94A3B8' }}>{ticket.domain}</strong> · Drift Score: <strong style={{ color: '#06B6D4' }}>{ticket.drift_score?.toFixed(4)}</strong>
          </span>
        </div>

        <StatusDropdown value={status} onChange={onStatusChange} />
      </div>

      {/* ── Summary Box ── */}
      <div style={{
        background: 'rgba(3, 7, 18, 0.5)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: '14px 16px', marginBottom: 14, flex: 1
      }}>
        <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Summary
        </div>
        <div style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.6 }}>
          {ticket.summary}
        </div>
      </div>

      {/* ── Details Toggle ── */}
      <button onClick={() => setExpanded(e => !e)} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
        color: '#38BDF8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
        padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 12, width: 'fit-content', transition: 'all 0.2s'
      }}>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div style={{ animation: 'fadeIn 0.3s ease', marginBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={12} color="#38BDF8" /> Affected Policies
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ticket.affected_policies?.map((p, i) => (
                <span key={i} style={{
                  background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                  padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem',
                  border: '1px solid rgba(99,102,241,0.25)'
                }}>📄 {p}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={12} color="#10B981" /> Action Items
            </div>
            {ticket.change_list?.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <ArrowRight size={12} color="#10B981" style={{ marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Archive Action ── */}
      {isDone && (
        <div style={{
          marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#10B981', fontWeight: 600 }}>
            <CheckCircle2 size={15} /> Completed — Move to history?
          </div>
          <button onClick={onDelete} style={{
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: 8, color: '#F43F5E', padding: '6px 14px', cursor: 'pointer',
            fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s', fontWeight: 700
          }}>
            <Trash2 size={13} /> Archive Ticket
          </button>
        </div>
      )}
    </div>
  );
}

// ── HistoryCard ────────────────────────────────────────────────
function HistoryCard({ ticket, onRestore }) {
  const prio = getPriority(ticket.priority);
  const pc = PRIORITY_CONFIG[prio];
  const reg = ticket.regulator === 'SEBI';
  return (
    <div style={{
      background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#38BDF8', fontWeight: 700 }}>{ticket.ticket_id}</span>
          <span className={`badge ${reg ? 'badge-sebi' : 'badge-rbi'}`}>{ticket.regulator}</span>
          <span style={{ fontSize: '0.7rem', background: pc.bg, color: pc.color, padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>{prio}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.5 }}>
          {ticket.summary?.slice(0, 90)}{ticket.summary?.length > 90 ? '...' : ''}
        </div>
      </div>
      <button onClick={onRestore} style={{
        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 8, color: '#A5B4FC', padding: '6px 12px', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
      }}>
        ↩ Restore
      </button>
    </div>
  );
}

// ── Main TicketsView ───────────────────────────────────────────
export default function TicketsView({ tickets, loading }) {
  const [statuses, setStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  });
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [regFilter, setRegFilter] = useState('ALL');
  const [prioFilter, setPrioFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const CARDS_PER_PAGE = 3;

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses)); }, [statuses]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }, [history]);

  const handleStatusChange = (id, newStatus) => {
    setStatuses(prev => ({ ...prev, [id]: newStatus }));
  };

  const handleArchive = (ticket) => {
    setHistory(prev => [{...ticket, archivedAt: Date.now(), status: 'done'}, ...prev]);
    setStatuses(prev => { const n = {...prev}; delete n[ticket.ticket_id]; return n; });
  };

  const handleRestore = (ticket) => {
    setHistory(prev => prev.filter(h => h.ticket_id !== ticket.ticket_id));
    setStatuses(prev => ({ ...prev, [ticket.ticket_id]: 'not_started' }));
  };

  const archivedIds = new Set(history.map(h => h.ticket_id));
  const activeTickets = tickets.filter(t => !archivedIds.has(t.ticket_id));

  const filteredTickets = activeTickets.filter(t => {
    const prio = getPriority(t.priority);
    const st = statuses[t.ticket_id] || 'not_started';
    return (
      (regFilter === 'ALL' || t.regulator === regFilter) &&
      (prioFilter === 'ALL' || prio === prioFilter) &&
      (statusFilter === 'ALL' || st === statusFilter) &&
      (search === '' ||
        t.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
        t.summary.toLowerCase().includes(search.toLowerCase()) ||
        t.domain.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / CARDS_PER_PAGE));
  const safeIndex = Math.min(sliderIndex, Math.max(0, filteredTickets.length - CARDS_PER_PAGE));
  const visibleTickets = filteredTickets.slice(safeIndex, safeIndex + CARDS_PER_PAGE);

  const canPrev = safeIndex > 0;
  const canNext = safeIndex + CARDS_PER_PAGE < filteredTickets.length;

  const total = activeTickets.length;
  const done = Object.values(statuses).filter(s => s === 'done').length;
  const inProgress = Object.values(statuses).filter(s => s === 'in_progress').length;
  const pending = Object.values(statuses).filter(s => s === 'pending').length;
  const notStarted = total - done - inProgress - pending;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <Activity size={36} color="#6366F1" className="animate-spin" />
      <span style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Loading compliance tickets...</span>
    </div>
  );

  return (
    <div>
      {/* ── Hero Banner ── */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(3, 7, 18, 0.95) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 24, padding: '32px',
        marginBottom: 24, position: 'relative', overflow: 'hidden'
      }}>
        {/* Glow Spheres */}
        <div style={{ position: 'absolute', top: -60, right: -40, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: 200, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ background: 'var(--grad-primary)', padding: '12px', borderRadius: 16, boxShadow: 'var(--glow-violet)' }}>
                <ShieldAlert size={26} color="#FFF" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.7rem', fontWeight: 800, background: 'linear-gradient(90deg, #F8FAFC 0%, #A5B4FC 50%, #38BDF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Compliance Remediation Tickets
                </h1>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: 2 }}>
                  Automated SEBI & RBI Policy Gap Detection & Multi-tier Workflow
                </p>
              </div>
            </div>
          </div>

          <button onClick={() => setShowHistory(h => !h)} style={{
            background: showHistory ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showHistory ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 14, color: showHistory ? '#34D399' : '#F8FAFC',
            padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 8, fontSize: '0.85rem', fontWeight: 700, transition: 'all 0.25s'
          }}>
            <History size={16} />
            Archived History
            {history.length > 0 && (
              <span style={{ background: '#10B981', color: '#FFF', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 800 }}>
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Stats Metric Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 24 }}>
          {[
            { label: 'Active Tickets', value: total, color: '#38BDF8', icon: BarChart2 },
            { label: 'Not Started', value: notStarted, color: '#94A3B8', icon: Circle },
            { label: 'In Progress', value: inProgress, color: '#06B6D4', icon: Activity },
            { label: 'Pending', value: pending, color: '#F59E0B', icon: Clock },
            { label: 'Completed', value: done, color: '#10B981', icon: CheckCircle2 },
            { label: 'Archived', value: history.length, color: '#8B5CF6', icon: History },
          ].map((s, i) => {
            const SIcon = s.icon;
            return (
              <div key={i} style={{
                background: 'rgba(3, 7, 18, 0.6)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '14px', transition: 'all 0.25s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <SIcon size={13} color={s.color} />
                  <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── History Panel ── */}
      {showHistory && (
        <div style={{ animation: 'fadeIn 0.3s ease', marginBottom: 24 }}>
          <div className="glass-card" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <History size={18} color="#10B981" />
                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Archived Completed Tickets</h3>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748B', padding: '30px 0', fontSize: '0.88rem' }}>
                No archived tickets yet. Mark a ticket as Done and click Archive.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {history.map((t, i) => (
                  <HistoryCard key={i} ticket={t} onRestore={() => handleRestore(t)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search tickets by ID, domain, keyword..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSliderIndex(0); }}
            className="search-input"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'SEBI', 'RBI'].map(r => (
            <button key={r} onClick={() => { setRegFilter(r); setSliderIndex(0); }}
              style={{
                background: regFilter === r ? 'var(--grad-primary)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${regFilter === r ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                color: regFilter === r ? '#FFF' : '#94A3B8', fontSize: '0.78rem', fontWeight: 700,
                transition: 'all 0.2s', boxShadow: regFilter === r ? 'var(--glow-violet)' : 'none'
              }}>
              {r === 'ALL' ? 'All Regulators' : r}
            </button>
          ))}
        </div>

        <select value={prioFilter} onChange={e => { setPrioFilter(e.target.value); setSliderIndex(0); }}
          style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94A3B8', padding: '8px 14px', fontSize: '0.8rem', outline: 'none' }}>
          <option value="ALL">All Priorities</option>
          <option value="HIGH">HIGH (P1)</option>
          <option value="MEDIUM">MEDIUM (P2)</option>
          <option value="LOW">LOW (P3)</option>
        </select>

        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setSliderIndex(0); }}
          style={{ background: '#0B1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94A3B8', padding: '8px 14px', fontSize: '0.8rem', outline: 'none' }}>
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* ── Slider View ── */}
      {filteredTickets.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <ShieldAlert size={40} color="#6366F1" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>No tickets match your filters</div>
          <div style={{ fontSize: '0.85rem' }}>Try clearing your search or filter options.</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSliderIndex(s => Math.max(0, s - 1))} disabled={!canPrev}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '8px 16px', cursor: canPrev ? 'pointer' : 'not-allowed',
                  color: canPrev ? '#F8FAFC' : '#475569', display: 'flex', alignItems: 'center',
                  gap: 6, fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s'
                }}>
                <ChevronLeft size={16} /> Prev
              </button>
              <button onClick={() => setSliderIndex(s => s + 1)} disabled={!canNext}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '8px 16px', cursor: canNext ? 'pointer' : 'not-allowed',
                  color: canNext ? '#F8FAFC' : '#475569', display: 'flex', alignItems: 'center',
                  gap: 6, fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s'
                }}>
                Next <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B', marginRight: 6 }}>
                {safeIndex + 1}–{Math.min(safeIndex + CARDS_PER_PAGE, filteredTickets.length)} of {filteredTickets.length}
              </span>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setSliderIndex(i * CARDS_PER_PAGE)}
                  style={{
                    width: i === Math.floor(safeIndex / CARDS_PER_PAGE) ? 24 : 8,
                    height: 8, borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: i === Math.floor(safeIndex / CARDS_PER_PAGE) ? '#6366F1' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.3s', padding: 0
                  }} />
              ))}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(visibleTickets.length, 3)}, 1fr)`,
            gap: 16, animation: 'fadeIn 0.3s ease'
          }}>
            {visibleTickets.map((ticket, i) => (
              <TicketCard
                key={ticket.ticket_id}
                ticket={ticket}
                status={statuses[ticket.ticket_id] || 'not_started'}
                onStatusChange={val => handleStatusChange(ticket.ticket_id, val)}
                onDelete={() => handleArchive(ticket)}
                isActive={i === 1 || visibleTickets.length === 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
