import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BookOpen, Trash2, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8001/api';

function TypingIndicator({ waitTime }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)', padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
        <Bot size={16} color="#FFF" />
      </div>
      <div style={{
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: '0 12px 12px 12px',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA', animation: 'bounce 1.2s infinite', animationDelay: '0s', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA', animation: 'bounce 1.2s infinite', animationDelay: '0.2s', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA', animation: 'bounce 1.2s infinite', animationDelay: '0.4s', display: 'inline-block' }} />
          <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: '6px' }}>Generating response...</span>
        </div>
        {waitTime > 8 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#F59E0B' }}>
            <Clock size={11} />
            {waitTime > 40
              ? `Still working... (${waitTime}s) — Llama 3.1 is a large model, please wait`
              : `Llama 3.1 is thinking... (~30-60s for first response)`}
          </div>
        )}
        <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
      </div>
    </div>
  );
}

function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: '10px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent',
          border: '1px solid #334155',
          borderRadius: '6px',
          color: '#60A5FA',
          fontSize: '0.75rem',
          padding: '4px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <BookOpen size={12} />
        {sources.length} source{sources.length > 1 ? 's' : ''} retrieved
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sources.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.78rem'
            }}>
              <div style={{ color: '#38BDF8', fontWeight: 600, marginBottom: '4px' }}>
                📄 {s.doc_name || 'Policy Document'}
                <span style={{ color: '#64748B', fontWeight: 400, marginLeft: '8px' }}>
                  {s.domain && `Domain: ${s.domain} · `}Similarity: {s.similarity}
                </span>
              </div>
              <div style={{ color: '#94A3B8', lineHeight: 1.5 }}>
                {(s.text || '').slice(0, 200)}{s.text && s.text.length > 200 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.sender === 'user';
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      animation: 'fadeIn 0.3s ease'
    }}>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {!isUser && (
        <div style={{
          background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
          padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0, marginTop: '2px'
        }}>
          <Bot size={16} color="#FFF" />
        </div>
      )}

      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: isUser
            ? 'linear-gradient(135deg, #2563EB, #1D4ED8)'
            : '#1E293B',
          color: '#F8FAFC',
          padding: '12px 16px',
          borderRadius: isUser ? '12px 12px 0 12px' : '0 12px 12px 12px',
          border: isUser ? 'none' : '1px solid #334155',
          fontSize: '0.92rem',
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: isUser
            ? '0 2px 12px rgba(37,99,235,0.3)'
            : '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {msg.text}
        </div>

        {!isUser && <SourcesPanel sources={msg.sources} />}

        <div style={{
          fontSize: '0.7rem', color: '#475569', marginTop: '4px',
          textAlign: isUser ? 'right' : 'left'
        }}>
          {msg.time}
        </div>
      </div>

      {isUser && (
        <div style={{
          background: '#334155',
          padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0, marginTop: '2px'
        }}>
          <User size={16} color="#FFF" />
        </div>
      )}
    </div>
  );
}

export default function ChatView() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 Hi! I'm your AI Compliance Assistant powered by Llama 3.1 + Hybrid RAG.\n\nI can answer anything — SEBI/RBI regulations, KYC norms, compliance, penalties, general questions, and more. What would you like to know?",
      sources: [],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGreeting: true  // mark so we exclude from history
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const waitTimerRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Wait-time counter for slow model feedback
  useEffect(() => {
    if (loading) {
      setWaitTime(0);
      waitTimerRef.current = setInterval(() => setWaitTime(t => t + 1), 1000);
    } else {
      clearInterval(waitTimerRef.current);
      setWaitTime(0);
    }
    return () => clearInterval(waitTimerRef.current);
  }, [loading]);

  const handleSend = async () => {
    const text = query.trim();
    if (!text || loading) return;
    setQuery('');

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user', text, time: now };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build proper {query, answer} PAIRS for multi-turn memory (last 4 turns)
    // Filter out the initial greeting, then pair user→bot messages
    const realMsgs = messages.filter(m => !m.isGreeting);
    const history = [];
    for (let i = 0; i < realMsgs.length - 1; i++) {
      if (realMsgs[i].sender === 'user' && realMsgs[i + 1]?.sender === 'bot') {
        history.push({
          query: realMsgs[i].text,
          answer: realMsgs[i + 1].text
        });
        i++; // skip the bot message we just consumed
      }
    }
    const recentHistory = history.slice(-4); // last 4 pairs = 8 messages

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        query: text,
        regulator: 'ALL',
        chat_history: recentHistory
      }, { timeout: 180000 });  // 3 minutes — Llama 3.1 can be slow

      const botNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: res.data.answer || 'No response received.',
        sources: res.data.sources || [],
        time: botNow
      }]);
    } catch (err) {
      const botNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const errMsg = err.code === 'ECONNREFUSED' || err.message.includes('Network')
        ? '⚠️ Cannot connect to backend (port 8001). Please ensure the FastAPI server is running.\n\nRun: `python src/api.py`'
        : `⚠️ Error: ${err.response?.data?.detail || err.message}`;

      setMessages(prev => [...prev, { sender: 'bot', text: errMsg, sources: [], time: botNow }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessages([{
      sender: 'bot',
      text: "Chat cleared. How can I help you?",
      sources: [],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const suggestions = [
    "What is the re-KYC requirement for high risk accounts?",
    "Explain SEBI SCORES 2.0 penalty rules",
    "What is the 6-hour cyber incident reporting SLA?",
    "Summarize RBI KYC master directions"
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: '600px' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{
          paddingBottom: '14px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              padding: '10px', borderRadius: '12px', display: 'flex'
            }}>
              <Bot size={22} color="#FFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>AI Compliance Assistant</h3>
              <div style={{ fontSize: '0.75rem', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={11} /> Powered by Llama 3.1 + Hybrid RAG (ChromaDB × BM25)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {messages.length - 1} message{messages.length !== 2 ? 's' : ''}
            </span>
            <button
              onClick={handleClear}
              title="Clear chat"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                color: '#F87171',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.8rem'
              }}
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {messages.map((msg, idx) => <Message key={idx} msg={msg} />)}
          {loading && <TypingIndicator waitTime={waitTime} />}
          <div ref={bottomRef} />
        </div>

        {/* ── Quick Suggestions (shown when only greeting) ── */}
        {messages.length === 1 && (
          <div style={{ padding: '0 0 12px 0', flexShrink: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '8px' }}>
              💡 Try asking:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                  style={{
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: '20px',
                    color: '#93C5FD',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Bar ── */}
        <div style={{
          paddingTop: '14px',
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: '10px',
          flexShrink: 0
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask me anything — regulations, compliance, finance, or anything else..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="search-input"
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            className="action-btn"
            onClick={handleSend}
            disabled={loading || !query.trim()}
            style={{ opacity: (loading || !query.trim()) ? 0.5 : 1, flexShrink: 0 }}
          >
            <Send size={15} />
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
