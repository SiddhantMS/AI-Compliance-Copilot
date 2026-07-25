import React, { useState } from 'react';
import { Upload, FileText, Printer, ShieldCheck, RefreshCw, CheckCircle, ShieldAlert } from 'lucide-react';
import axios from 'axios';

export default function UploadAuditView() {
  const [orgName, setOrgName] = useState('Bank of India / Internal Audit');
  const [policyName, setPolicyName] = useState('Internal Operational Compliance Policy 2026');
  const [policyText, setPolicyText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !policyText.trim()) {
      alert('Please upload a PDF/text file or paste policy text to analyze.');
      return;
    }

    setLoading(true);
    setReport(null);

    const formData = new FormData();
    formData.append('organization_name', orgName);
    formData.append('policy_name', policyName);

    if (selectedFile) {
      formData.append('file', selectedFile);
    } else {
      formData.append('policy_text', policyText);
    }

    try {
      const res = await axios.post('http://localhost:8001/api/audit-policy', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReport(res.data);
    } catch (err) {
      alert('Error analyzing policy. Ensure FastAPI backend is running on port 8001.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* ── Printable CSS Overrides ── */}
      <style>{`
        @media print {
          body { background: #FFFFFF !important; color: #000000 !important; }
          .no-print, header, nav, button, input, select, textarea { display: none !important; }
          .printable-report {
            background: #FFFFFF !important; color: #000000 !important;
            border: 2px solid #000000 !important; box-shadow: none !important;
            padding: 30px !important; margin: 0 !important; width: 100% !important;
          }
          .printable-report h2, .printable-report h3, .printable-report h4 { color: #000000 !important; }
          .print-badge { border: 1px solid #000 !important; color: #000 !important; background: none !important; }
        }
      `}</style>

      {/* ── Upload & Form Section ── */}
      <div className="glass-card no-print" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Upload size={22} color="#38BDF8" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Upload Internal Policy for SEBI & RBI AI Audit</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Organization Name:
            </label>
            <input 
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="search-input"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Internal Policy Document Title:
            </label>
            <input 
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Drag & Drop File Input */}
        <div style={{ border: '2px dashed #1E3A5F', borderRadius: '14px', padding: '24px', textAlign: 'center', marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <FileText size={36} color="#60A5FA" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '4px' }}>
            Upload Organization Policy Document (.pdf or .txt)
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '14px' }}>
            Supports PDF circulars, internal policy manual texts
          </div>
          <input 
            type="file" 
            accept=".pdf,.txt" 
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="policy-file-upload"
          />
          <label htmlFor="policy-file-upload" className="action-btn" style={{ background: '#1E3A5F', cursor: 'pointer', fontSize: '0.85rem' }}>
            Choose File...
          </label>
          {selectedFile && (
            <div style={{ marginTop: '12px', color: '#34D399', fontSize: '0.82rem', fontWeight: 600 }}>
              ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Or Paste Policy Content */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Or Paste Policy Content Directly:
          </label>
          <textarea 
            rows={4}
            placeholder="Paste your internal bank policy text here (e.g., KYC procedures, cyber security protocols, grievance resolution rules)..."
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            className="search-input"
            style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
          />
        </div>

        {/* Submit Action */}
        <button 
          className="action-btn" 
          onClick={handleAnalyze} 
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
        >
          {loading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
          {loading ? 'Analyzing Policy against Active SEBI & RBI Directives via Milvus Vector Engine...' : 'Analyze Policy & Generate Official Audit Report'}
        </button>
      </div>

      {/* ── Loading Spinner State ── */}
      {loading && (
        <div className="glass-card no-print" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38BDF8', marginBottom: '8px' }}>
            🔍 AI Compliance Pipeline in Progress
          </div>
          <div style={{ color: '#64748B', fontSize: '0.85rem' }}>
            Extracting text $\rightarrow$ Querying ChromaDB Vector Index $\rightarrow$ Computing Drift Score $\rightarrow$ Generating Recommendation Plan...
          </div>
        </div>
      )}

      {/* ── Report Output Display ── */}
      {report && (
        <div className="glass-card printable-report">
          {/* Header & Print Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #1E3A5F', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                OFFICIAL REGULATORY DRIFT AUDIT REPORT
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>{report.policy_name}</h2>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Organization: <strong>{report.organization_name}</strong> | Target Regulators: <strong>SEBI & RBI</strong> | Date: <strong>{new Date().toLocaleDateString()}</strong>
              </div>
            </div>

            <button className="action-btn no-print" onClick={handlePrint} style={{ background: '#10B981' }}>
              <Printer size={16} /> Print Audit Report
            </button>
          </div>

          {/* Key Metrics Header Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid #1E3A5F' }}>
              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>Calculated Drift Score</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>
                {report.drift_score?.toFixed(4)}
              </div>
            </div>

            <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid #1E3A5F' }}>
              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>Priority Risk Tier</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '6px' }}>
                <span className={`badge print-badge ${report.priority?.includes('HIGH') ? 'badge-high' : report.priority?.includes('MEDIUM') ? 'badge-medium' : 'badge-low'}`}>
                  {report.priority}
                </span>
              </div>
            </div>

            <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid #1E3A5F' }}>
              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>Compliance Status</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#F8FAFC', marginTop: '6px' }}>
                {report.risk_level}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ background: '#0A1628', padding: '16px', borderRadius: '10px', marginBottom: '20px', borderLeft: '4px solid #3B82F6' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#60A5FA', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Executive Compliance Summary
            </h4>
            <div style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.65 }}>
              {report.summary}
            </div>
          </div>

          {/* Recommended Roadmap */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#EF4444" /> Executive Action Roadmap (SEBI & RBI Mandates)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', borderTop: '4px solid #EF4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-high">High Priority (P1)</span>
                  <span style={{ fontSize: '0.72rem', color: '#F87171', fontWeight: 600 }}>15–30 Days SLA</span>
                </div>
                <ul style={{ paddingLeft: '16px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '4px' }}><strong>KYC & V-CIP</strong>: Enforce 2-yr re-KYC for high risk accounts & CKYCR 3-day SLA.</li>
                  <li><strong>Cyber Resilience</strong>: 24x7 SOC, MFA, and 6-hour incident reporting to CSIRT-Fin.</li>
                </ul>
              </div>

              <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.3)', borderTop: '4px solid #F59E0B' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-medium">Medium Priority (P2)</span>
                  <span style={{ fontSize: '0.72rem', color: '#FBBF24', fontWeight: 600 }}>45–60 Days SLA</span>
                </div>
                <ul style={{ paddingLeft: '16px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '4px' }}><strong>SCORES 2.0</strong>: Integrate complaint tracking with SEBI 21-day SLAs.</li>
                  <li><strong>Trading Kill Switch</strong>: Deploy order limit kill switches in trading terminals.</li>
                </ul>
              </div>

              <div style={{ background: '#0A1628', padding: '14px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)', borderTop: '4px solid #6366F1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-low">Low Priority (P3)</span>
                  <span style={{ fontSize: '0.72rem', color: '#A5B4FC', fontWeight: 600 }}>90 Days SLA</span>
                </div>
                <ul style={{ paddingLeft: '16px', fontSize: '0.82rem', color: '#CBD5E1', lineHeight: '1.6' }}>
                  <li style={{ marginBottom: '4px' }}><strong>Fair Lending</strong>: Separate loan non-compliance charges from principal capitalization.</li>
                  <li><strong>Dormant Accounts</strong>: Automate 10-year dormant account transfers to DEA Fund.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Steps */}
          <div style={{ background: '#0A1628', padding: '16px', borderRadius: '10px', border: '1px solid #1E3A5F' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34D399', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} /> Recommended Action Steps for Internal Audit
            </h4>
            <ol style={{ paddingLeft: '20px', color: '#CBD5E1', fontSize: '0.85rem', lineHeight: '1.7' }}>
              {report.action_items?.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
