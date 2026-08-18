import React, { useState, useEffect } from 'react';
import { Users, Database, Shield, Settings, Activity, Lock, CheckCircle, RefreshCw, Key, Server, Cpu } from 'lucide-react';
import axios from 'axios';

export default function AdminView() {
  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const usersList = [
    {
      id: 'USER-001',
      name: 'Senior Compliance Officer',
      email: 'officer@bankofindia.co.in',
      role: 'compliance_officer',
      department: 'Regulatory Risk & Governance',
      status: 'ACTIVE',
      lastLogin: '2026-07-27 14:15 IST'
    },
    {
      id: 'USER-002',
      name: 'RBI/SEBI External Auditor',
      email: 'auditor@bankofindia.co.in',
      role: 'auditor',
      department: 'Internal & External Audit',
      status: 'ACTIVE',
      lastLogin: '2026-07-27 13:50 IST'
    },
    {
      id: 'USER-003',
      name: 'System Administrator',
      email: 'admin@bankofindia.co.in',
      role: 'admin',
      department: 'IT Compliance Infrastructure',
      status: 'ACTIVE',
      lastLogin: '2026-07-27 14:35 IST'
    }
  ];

  return (
    <div>
      {/* Admin Header */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <div style={{ background: '#0B3D66', padding: '12px', borderRadius: '8px', color: '#FFFFFF', display: 'flex' }}>
            <Settings size={26} color="#C88A2E" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--color-primary)', margin: 0 }}>
              System Administration & User Management Dashboard
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              Bank of India Infrastructure & Role-Based Access Control (RBAC) Settings
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Active Enterprise Users</span>
            <Users size={18} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', margin: '8px 0 4px 0' }}>
            3 Accounts
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-risk-low)', fontWeight: 600 }}>✓ RBAC JWT Auth Enabled</div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Active LLM Model</span>
            <Cpu size={18} color="var(--color-accent)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', margin: '8px 0 4px 0' }}>
            llama3.1:latest
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-risk-low)', fontWeight: 600 }}>✓ Fast 8B Execution (~1.5s)</div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Vector Index Engine</span>
            <Database size={18} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', margin: '8px 0 4px 0' }}>
            HNSW x BM25
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>37 Master Directions Indexed</div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Airflow Scheduler</span>
            <Server size={18} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', margin: '8px 0 4px 0' }}>
            Active (08:00 IST)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-risk-low)', fontWeight: 600 }}>✓ Daily SEBI/RBI Cron Job</div>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--color-primary)', margin: '0 0 16px 0' }}>
          👥 Bank of India Enterprise Users Directory
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last Access</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((user) => (
                <tr key={user.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{user.id}</td>
                  <td style={{ fontWeight: 600 }}>{user.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{user.email}</td>
                  <td>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      background: user.role === 'compliance_officer' ? 'rgba(11,61,102,0.1)' : user.role === 'auditor' ? 'rgba(58,122,93,0.1)' : 'rgba(200,138,46,0.1)',
                      color: user.role === 'compliance_officer' ? '#0B3D66' : user.role === 'auditor' ? '#3A7A5D' : '#C88A2E',
                      border: `1px solid ${user.role === 'compliance_officer' ? '#0B3D66' : user.role === 'auditor' ? '#3A7A5D' : '#C88A2E'}`
                    }}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{user.department}</td>
                  <td>
                    <span style={{ color: 'var(--color-risk-low)', fontWeight: 600, fontSize: '12px' }}>
                      ✓ {user.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {user.lastLogin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
