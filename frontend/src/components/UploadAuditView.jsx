import React, { useState } from 'react';
import { Upload, FileText, Printer, ShieldCheck, AlertTriangle, BookOpen, CheckCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function UploadAuditView() {
  const [orgName, setOrgName] = useState('Bank of India / Client Org');
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
      const res = await axios.post('http://localhost:8000/api/audit-policy', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReport(res.data);
    } catch (err) {
      alert('Error analyzing policy. Check if FastAPI backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Printable Report Styles */}
      <style>{`
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
          }
          .no-print, header, nav, button, input, select, textarea {
            display: none !important;
          }
          .printable-report {
            background: #FFFFFF !important;
            color: #000000 !important;
            border: 2px solid #000000 !important;
            box-shadow: none !important;
            padding: 30px !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .printable-report h2, .printable-report h3, .printable-report h4 {
            color: #000000 !important;
          }
          .print-badge {
            border: 1px solid #000 !important;
            color: #000 !important;
            background: none !important;
          }
        }
      `}</style>

      {/* Top Input & Upload Section */}
      <div className="glass-card no-print" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Upload size={22} color="#38BDF8" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Upload Internal Policy for AI Regulation Comparison</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
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
            <label style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
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

        {/* File Drag & Drop / Upload Input */}
        <div style={{ border: '2px dashed #334155', borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '16px', background: '#0F172A' }}>
          <FileText size={32} color="#60A5FA" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '4px' }}>
            Upload Organization Policy PDF or Text Document
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '12px' }}>
            Supports .pdf, .txt formats
          </div>
          <input 
            type="file" 
            accept=".pdf,.txt" 
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="policy-file-upload"
          />
          <label htmlFor="policy-file-upload" className="action-btn" style={{ background: '#334155', cursor: 'pointer' }}>
            Choose File...
          </label>
          {selectedFile && (
            <div style={{ marginTop: '10px', color: '#34D399', fontSize: '0.85rem', fontWeight: 600 }}>
              ✓ Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Alternative Paste Text Area */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '0.85rem', color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Or Paste Policy Content Directly:
          </label>
          <textarea 
            rows={4}
            placeholder="Paste your internal bank policy text here (e.g., KYC procedures, cyber security protocols, grievance resolution rules)..."
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            className="search-input"
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Submit Action Button */}
        <button 
          className="action-btn" 
          onClick={handleAnalyze} 
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem' }}
        >
          {loading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
          {loading ? 'Comparing Policy against Active SEBI & RBI Regulations...' : 'Analyze Policy & Generate Official Report'}
        </button>
      </div>

      {/* Analysis Loading State */}
      {loading && (
        <div className="glass-card no-print" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38BDF8', marginBottom: '8px' }}>
            🔍 AI Evaluation Pipeline in Progress
          </div>
          <div style={{ color: '#94A3B8', fontSize: '0.9rem' }}>
            Extracting text $\rightarrow$ Querying ChromaDB SEBI & RBI Collections $\rightarrow$ Computing Weighted Drift Score $\rightarrow$ Formulating Compliance Amendment Plan...
          </div>
        </div>
      )}

      {/* Report Result Display */}
      {report && (
        <div className="glass-card printable-report">
          {/* Header & Print Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '2px solid #334155', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                OFFICIAL REGULATORY DRIFT AUDIT REPORT
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2px' }}>{report.policy_name}</h2>
              <div style={{ fontSize: '0.88rem', color: '#94A3B8', marginTop: '2px' }}>
                Organization: <strong>{report.organization_name}</strong> | Target Regulators: <strong>SEBI & RBI</strong> | Date: <strong>{new Date().toLocaleDateString()}</strong>
              </div>
            </div>

            <button className="action-btn no-print" onClick={handlePrint} style={{ background: '#059669' }}>
              <Printer size={16} /> Print Official Report for Compliance Team
            </button>
          </div>

          {/* Key Metrics Header Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>Calculated Drift Score</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                {report.drift_score.toFixed(4)}
              </div>
            </div>

            <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>Priority Risk Classification</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '6px' }}>
                <span className={`badge print-badge ${report.priority.includes('HIGH') ? 'badge-high' : report.priority.includes('MEDIUM') ? 'badge-medium' : 'badge-low'}`}>
                  {report.priority}
                </span>
              </div>
            </div>

            <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>Compliance Assessment</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC', marginTop: '6px' }}>
                {report.risk_level}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #3B82F6' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#93C5FD', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={16} /> Executive Compliance Summary
            </h4>
            <div style={{ fontSize: '0.92rem', color: '#E2E8F0', lineHeight: '1.6' }}>
              {report.summary}
            </div>
          </div>

          {/* Matched Regulations Table */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={16} color="#60A5FA" /> Matched SEBI & RBI Active Regulations
            </h4>
            {report.matched_regulations && report.matched_regulations.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '10px 12px' }}>Regulator</th>
                    <th style={{ padding: '10px 12px' }}>Circular ID</th>
                    <th style={{ padding: '10px 12px' }}>Regulatory Directive Excerpt</th>
                    <th style={{ padding: '10px 12px' }}>Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.matched_regulations.map((reg, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${reg.regulator === 'SEBI' ? 'badge-sebi' : 'badge-rbi'}`}>
                          {reg.regulator}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#38BDF8' }}>
                        #{reg.circular_id}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#CBD5E1' }}>{reg.text}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F8FAFC' }}>
                        {(reg.similarity * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>No specific regulatory conflicts detected.</div>
            )}
          </div>

          {/* Action Plan for Compliance Team */}
          <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#34D399', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} /> Recommended Action Steps for Internal Compliance Team
            </h4>
            <ol style={{ paddingLeft: '20px', color: '#CBD5E1', fontSize: '0.9rem', lineHeight: '1.7' }}>
              {report.action_items.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
