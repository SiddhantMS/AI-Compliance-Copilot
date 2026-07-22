import React, { useState } from 'react';
import { Send, Bot, User, BookOpen } from 'lucide-react';
import axios from 'axios';

export default function ChatView() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your AI Compliance Assistant. Ask me anything about SEBI and RBI regulatory circulars or Bank of India internal policy requirements.',
      sources: []
    }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!query.trim()) return;
    const userMsg = query.trim();
    setQuery('');

    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:8000/api/chat', { query: userMsg });
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.answer,
          sources: res.data.sources || []
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: 'Error connecting to RAG backend service. Please check if FastAPI backend server is running.',
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '650px' }}>
        {/* Header */}
        <div style={{ paddingBottom: '14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bot size={22} color="#38BDF8" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>RAG Regulatory Assistant (SEBI & RBI)</h3>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.sender === 'bot' && (
                <div style={{ background: '#2563EB', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <Bot size={16} color="#FFF" />
                </div>
              )}

              <div style={{ 
                maxWidth: '75%', 
                background: msg.sender === 'user' ? '#2563EB' : '#0F172A', 
                color: '#F8FAFC', 
                padding: '12px 16px', 
                borderRadius: '12px',
                border: msg.sender === 'bot' ? '1px solid #334155' : 'none'
              }}>
                <div style={{ fontSize: '0.92rem', whiteSpace: 'pre-line' }}>{msg.text}</div>

                {/* Grounding Context Cards */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #334155' }}>
                    <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={12} color="#60A5FA" /> Grounded RAG Policy Context:
                    </div>
                    {msg.sources.map((s, sIdx) => (
                      <div key={sIdx} style={{ background: '#1E293B', padding: '8px 10px', borderRadius: '6px', marginBottom: '6px', fontSize: '0.8rem', color: '#CBD5E1' }}>
                        <div style={{ fontWeight: 600, color: '#38BDF8' }}>📄 {s.doc_name} (Domain: {s.domain})</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>{s.text.slice(0, 160)}...</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div style={{ background: '#475569', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <User size={16} color="#FFF" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem', fontStyle: 'italic', paddingLeft: '40px' }}>
              Searching ChromaDB vector stores & formulating response...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid #334155', display: 'flex', gap: '10px' }}>
          <input 
            type="text"
            placeholder="Ask e.g. What is the Video-CIP re-KYC requirement for high risk bank accounts under SEBI/RBI?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="search-input"
            disabled={loading}
          />
          <button className="action-btn" onClick={handleSend} disabled={loading}>
            <Send size={16} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
