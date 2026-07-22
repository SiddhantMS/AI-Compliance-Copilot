import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import TicketsView from './components/TicketsView';
import DriftView from './components/DriftView';
import AuditView from './components/AuditView';
import ChatView from './components/ChatView';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);

  const fetchData = async () => {
    setLoading(true);
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
    fetchData();
  }, []);

  const handleRunPipeline = async () => {
    setRunningPipeline(true);
    try {
      await axios.post(`${API_BASE}/pipeline/run`);
      alert('SEBI & RBI Compliance Pipeline triggered in background.');
      setTimeout(() => {
        fetchData();
        setRunningPipeline(false);
      }, 5000);
    } catch (err) {
      alert('Error triggering pipeline. Check if backend is running on port 8000.');
      setRunningPipeline(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onRunPipeline={handleRunPipeline}
        runningPipeline={runningPipeline}
      />

      <main>
        {activeTab === 'tickets' && <TicketsView tickets={tickets} loading={loading} />}
        {activeTab === 'drift' && <DriftView analytics={analytics} />}
        {activeTab === 'audit' && <AuditView auditLogs={auditLogs} loading={loading} />}
        {activeTab === 'chat' && <ChatView />}
      </main>
    </div>
  );
}
