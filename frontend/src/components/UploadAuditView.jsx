import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Printer, ShieldCheck, RefreshCw, CheckCircle, ShieldAlert, FileUp, X, File, Sparkles, Building2, BookOpen, Filter, Landmark } from 'lucide-react';
import axios from 'axios';

export default function UploadAuditView() {
  const [orgName, setOrgName] = useState('Bank of India / Internal Audit');
  const [policyName, setPolicyName] = useState('Internal Operational Compliance Policy 2026');
  const [policyText, setPolicyText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeInputMode, setActiveInputMode] = useState('file'); // 'file' or 'text'
  const [targetRegulator, setTargetRegulator] = useState('ALL'); // 'ALL', 'SEBI', 'RBI'
  const [targetCircularId, setTargetCircularId] = useState('ALL');
  const [availableCirculars, setAvailableCirculars] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchCirculars = async () => {
      try {
        const res = await axios.get('/api/circulars');
        setAvailableCirculars(res.data.circulars || []);
      } catch (err) {
        console.error('Error loading circulars list:', err);
      }
    };
    fetchCirculars();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.pdf') || file.name.endsWith('.txt')) {
        setSelectedFile(file);
      } else {
        alert('Please upload a valid PDF or TXT file.');
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (activeInputMode === 'file' && !selectedFile) {
      alert('Please select or drag & drop an internal policy PDF/TXT document to analyze.');
      return;
    }
    if (activeInputMode === 'text' && !policyText.trim()) {
      alert('Please paste internal policy text or compliance SOP clauses to analyze.');
      return;
    }

    setLoading(true);
    setReport(null);

    const formData = new FormData();
    formData.append('organization_name', orgName);
    formData.append('policy_name', policyName);
    formData.append('target_regulator', targetRegulator);
    formData.append('target_circular_id', targetCircularId);

    if (activeInputMode === 'file' && selectedFile) {
      formData.append('file', selectedFile);
    } else {
      formData.append('policy_text', policyText);
    }

    try {
      const res = await axios.post('/api/audit-policy', formData, {
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
      <div className="glass-card no-print" style={{ marginBottom: '24px', padding: '24px' }}>
        
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#0B3D66', padding: '10px', borderRadius: '6px', display: 'flex', color: '#FFFFFF' }}>
              <UploadCloud size={22} color="#C88A2E" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--color-primary)', margin: 0 }}>
                Upload Internal Policy for SEBI & RBI Audit
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Compare organizational policy documents against active regulatory circulars to compute compliance drift scores.
              </p>
            </div>
          </div>

          {/* Mode Selector Segmented Tabs */}
          <div style={{ display: 'flex', background: '#F0ECE1', padding: '3px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setActiveInputMode('file')}
              style={{
                background: activeInputMode === 'file' ? '#FFFFFF' : 'transparent',
                color: activeInputMode === 'file' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: activeInputMode === 'file' ? 600 : 500,
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeInputMode === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <FileUp size={14} /> Upload Policy File
            </button>

            <button
              onClick={() => setActiveInputMode('text')}
              style={{
                background: activeInputMode === 'text' ? '#FFFFFF' : 'transparent',
                color: activeInputMode === 'text' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: activeInputMode === 'text' ? 600 : 500,
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeInputMode === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <FileText size={14} /> Paste Policy Text / SOP
            </button>
          </div>
        </div>

        {/* Form Metadata Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Building2 size={13} color="#C084FC" /> Organization / Department:
            </label>
            <input 
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="search-input"
              style={{ width: '100%', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: '#F8FAFC' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#F8FAFC', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <BookOpen size={13} color="#C084FC" /> Internal Policy Title:
            </label>
            <input 
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              className="search-input"
              style={{ width: '100%', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: '#F8FAFC' }}
            />
          </div>
        </div>

        {/* Target Regulation Selector */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '16px 18px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Landmark size={15} color="#C084FC" />
            Select Target Regulatory Framework to Compare Against:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', alignItems: 'center' }}>
            {/* Regulator Scope Segmented Selector */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'ALL', label: '🏛️ All SEBI & RBI' },
                { id: 'SEBI', label: '📈 SEBI Only' },
                { id: 'RBI', label: '🏦 RBI Only' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTargetRegulator(opt.id);
                    setTargetCircularId('ALL');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: targetRegulator === opt.id ? 700 : 500,
                    borderRadius: '9999px',
                    border: `1px solid ${targetRegulator === opt.id ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
                    background: targetRegulator === opt.id ? 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)' : 'rgba(255, 255, 255, 0.05)',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: targetRegulator === opt.id ? '0 0 15px rgba(168, 85, 247, 0.4)' : 'none'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Specific Master Direction / Circular Dropdown */}
            <div>
              <select
                value={targetCircularId}
                onChange={(e) => setTargetCircularId(e.target.value)}
                className="search-input"
                style={{ width: '100%', fontSize: '12px', background: '#0E1017', color: '#F8FAFC', padding: '8px 12px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px' }}
              >
                <option value="ALL" style={{ background: '#0E1017', color: '#F8FAFC' }}>📜 Compare Against All Master Directions & Circulars ({availableCirculars.length} total)</option>
                {availableCirculars
                  .filter(c => targetRegulator === 'ALL' || c.regulator === targetRegulator)
                  .map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#0E1017', color: '#F8FAFC' }}>
                      [{c.regulator}] #{c.id} — {c.title.length > 60 ? c.title.slice(0, 60) + '...' : c.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Input Area: Mode A (File Drag & Drop) vs Mode B (Text Area) */}
        {activeInputMode === 'file' ? (
          <div style={{ marginBottom: '20px' }}>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".pdf,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {!selectedFile ? (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  border: isDragging ? '2px dashed #A855F7' : '2px dashed rgba(255, 255, 255, 0.18)',
                  borderRadius: '16px',
                  background: isDragging ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(168, 85, 247, 0.15)', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: '12px',
                  border: '1px solid rgba(168, 85, 247, 0.3)'
                }}>
                  <UploadCloud size={24} color="#C084FC" />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px 0', fontFamily: 'var(--font-serif)' }}>
                  Drag & Drop Internal Policy Document Here
                </h4>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px 0' }}>
                  Supported formats: <strong>.PDF</strong> or <strong>.TXT</strong> (Digital & Scanned PDFs supported via Tesseract OCR)
                </p>
                <button type="button" className="pill-btn-purple" style={{ fontSize: '12px', padding: '8px 18px' }}>
                  <FileUp size={14} /> Browse Local File
                </button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '10px', borderRadius: '10px', color: '#C084FC', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    <FileText size={22} color="#C084FC" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC', fontFamily: 'var(--font-mono)' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                      <span>Size: {(selectedFile.size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span style={{ color: '#34D399', fontWeight: 600 }}>✓ File Loaded Ready for Audit</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleRemoveFile}
                  title="Remove file"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#F8FAFC'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <textarea 
              rows={5}
              placeholder="Paste internal policy clauses, SOPs, or compliance rules here..."
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              className="search-input"
              style={{ width: '100%', resize: 'vertical', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: '#F8FAFC', lineHeight: 1.5 }}
            />
          </div>
        )}

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="pill-btn-purple" 
            onClick={handleAnalyze} 
            disabled={loading}
            style={{ padding: '12px 28px', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            {loading ? 'Evaluating Regulatory Drift...' : 'Compare Document Against SEBI & RBI Regulations'}
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="glass-card no-print" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px', fontFamily: 'var(--font-serif)' }}>
            🔍 AI Compliance Pipeline in Progress
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Extracting text → Querying Policy Index → Computing Drift Score → Generating Recommendation Plan...
          </div>
        </div>
      )}

      {/* ── Report Output Display ── */}
      {report && (
        <div className="glass-card printable-report">
          {/* Header & Print Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '20px' }}>
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
