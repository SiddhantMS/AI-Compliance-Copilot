import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import TicketsView from './components/TicketsView';
import DriftView from './components/DriftView';
import UploadAuditView from './components/UploadAuditView';
import AuditView from './components/AuditView';
import ChatView from './components/ChatView';
import LoginView from './components/LoginView';
import AdminView from './components/AdminView';
import LandingView from './components/LandingView';

const API_BASE = '/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('boi_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('boi_token') || '');
  const [viewMode, setViewMode] = useState(() => (localStorage.getItem('boi_user') ? 'dashboard' : 'landing')); // 'landing', 'login', 'dashboard'
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    setViewMode('dashboard');
    localStorage.setItem('boi_user', JSON.stringify(user));
    localStorage.setItem('boi_token', token);

    if (user.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('tickets');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken('');
    setViewMode('landing');
    localStorage.removeItem('boi_user');
    localStorage.removeItem('boi_token');
  };

  const fetchData = async () => {
    try {
      const [ticketsRes, driftRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE}/tickets`),
        axios.get(`${API_BASE}/drift`),
        axios.get(`${API_BASE}/audit`)
      ]);

      setTickets(ticketsRes.data.tickets || []);
      setAnalytics(driftRes.data || null);
      setAuditLogs(auditRes.data.logs || []);
    } catch (err) {
      console.error('Error fetching data from FastAPI backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && viewMode === 'dashboard') {
      fetchData();
    }
  }, [currentUser, viewMode]);

  useEffect(() => {
    let interval = null;
    if (runningPipeline && currentUser && viewMode === 'dashboard') {
      interval = setInterval(() => {
        fetchData();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runningPipeline, currentUser, viewMode]);

  const handleRunPipeline = async () => {
    setRunningPipeline(true);
    try {
      await axios.post(`${API_BASE}/pipeline/run`);
      alert('SEBI & RBI Compliance Pipeline started! Tickets and drift scores will update live in the UI as agents process circulars.');

      setTimeout(() => {
        fetchData();
        setRunningPipeline(false);
      }, 30000);
    } catch (err) {
      alert('Error triggering pipeline. Check if backend is running on port 8001.');
      setRunningPipeline(false);
    }
  };

  // 1. Landing Page View
  if (viewMode === 'landing' && !currentUser) {
    return <LandingView onEnterPortal={() => setViewMode('login')} />;
  }

  // 2. Enterprise Access Login Portal View
  if (!currentUser || viewMode === 'login') {
    return (
      <LoginView 
        onLoginSuccess={handleLoginSuccess} 
        onBackToLanding={() => setViewMode('landing')} 
      />
    );
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunPipeline={handleRunPipeline}
        runningPipeline={runningPipeline}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {currentUser.role === 'auditor' && (
        <div style={{
          background: 'rgba(58,122,93,0.15)',
          borderBottom: '1px solid #3A7A5D',
          padding: '8px 24px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#3A7A5D',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)'
        }}>
          🔒 READ-ONLY AUDITOR INSPECTION MODE — Policy edits and ticket resolutions are disabled.
        </div>
      )}

      <main>
        {activeTab === 'admin' && <AdminView />}
        {activeTab === 'tickets' && <TicketsView tickets={tickets} loading={loading} readOnly={currentUser.role === 'auditor'} />}
        {activeTab === 'drift' && <DriftView analytics={analytics} />}
        {activeTab === 'upload' && <UploadAuditView />}
        {activeTab === 'audit' && <AuditView auditLogs={auditLogs} loading={loading} />}
        {activeTab === 'chat' && <ChatView />}
      </main>
    </div>
  );
}
