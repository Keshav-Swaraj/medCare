import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ScanLine, ChevronRight, Bell, Search,
  CheckCircle, AlertTriangle, Stethoscope,
  TestTube2, Download, Printer, Share2, MessageSquare
} from 'lucide-react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';

// PDF Styles
const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header: { borderBottom: '2 solid #e2e8f0', paddingBottom: 15, marginBottom: 20 },
  brand: { fontSize: 24, fontWeight: 'bold', color: '#0ea5e9' },
  reportTitle: { fontSize: 14, color: '#64748b', marginTop: 5 },
  section: { marginBottom: 15 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#0f172a', textTransform: 'uppercase' },
  text: { fontSize: 11, color: '#334155', lineHeight: 1.5 },
  bullet: { fontSize: 11, color: '#334155', marginBottom: 4, paddingLeft: 10 },
  diagnosisBox: { backgroundColor: '#f0f9ff', padding: 15, borderRadius: 8, marginBottom: 20 },
  diagnosisTitle: { fontSize: 12, color: '#0369a1', fontWeight: 'bold', marginBottom: 4 },
  diagnosisText: { fontSize: 18, color: '#0f172a', fontWeight: 'bold' },
  confidenceText: { fontSize: 10, color: '#0284c7', marginTop: 4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderTop: '1 solid #e2e8f0', paddingTop: 10 }
});

const ReportPDF = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.header}>
        <Text style={pdfStyles.brand}>MedCare Diagnostics</Text>
        <Text style={pdfStyles.reportTitle}>Clinical AI Diagnostic Report</Text>
      </View>
      
      <View style={pdfStyles.diagnosisBox}>
        <Text style={pdfStyles.diagnosisTitle}>PRIMARY DIAGNOSIS</Text>
        <Text style={pdfStyles.diagnosisText}>{data.diagnosis}</Text>
        {!data.hideConfidence && data.confidence != null && (
          <Text style={pdfStyles.confidenceText}>AI Confidence: {data.confidence}%</Text>
        )}
        <Text style={{ fontSize: 10, color: '#0f172a', marginTop: 5 }}>Suggested Specialist: {data.specialty}</Text>
      </View>
      
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.title}>Detected Conditions & Symptoms</Text>
        {data.symptoms.length > 0 ? data.symptoms.map((s, i) => <Text key={i} style={pdfStyles.bullet}>• {s}</Text>) : <Text style={pdfStyles.text}>No specific conditions explicitly detected.</Text>}
      </View>
      
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.title}>Clinical Recommendations</Text>
        {data.recommendations.length > 0 ? data.recommendations.map((r, i) => <Text key={i} style={pdfStyles.bullet}>• {r}</Text>) : <Text style={pdfStyles.text}>No recommendations provided.</Text>}
      </View>

      <View style={pdfStyles.section}>
        <Text style={pdfStyles.title}>Suggested Diagnostic Tests</Text>
        {data.suggested_tests.length > 0 ? data.suggested_tests.map((t, i) => <Text key={i} style={pdfStyles.bullet}>• {t}</Text>) : <Text style={pdfStyles.text}>No specific tests suggested.</Text>}
      </View>
      
      <View style={pdfStyles.section}>
        <Text style={pdfStyles.title}>Detailed Explanation</Text>
        <Text style={pdfStyles.text}>{data.report || 'No detailed explanation available.'}</Text>
      </View>
      
      <Text style={pdfStyles.footer}>
        Generated on {new Date().toLocaleDateString()} by MedCare AI. This is an AI-assisted report and does not replace a professional medical diagnosis. Please consult a doctor.
      </Text>
    </Page>
  </Document>
);



export default function DiagnosticsResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedImageType, processedData } = location.state || {};

  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (processedData) {
      const predictionData = processedData.predictions || [];
      const sorted = Array.isArray(predictionData) && predictionData.length
        ? [...predictionData].sort((a, b) => b[1] - a[1]) : [];
      const topK = sorted.slice(0, 3);
      const topSymptoms = processedData.symptoms?.length ? processedData.symptoms : topK.map(([c]) => c);
      const [bestCond, bestScore] = sorted.length ? sorted[0] : [processedData.disease, 1];
      const hideConfidence = processedData.hideConfidence === true || selectedImageType === 'lab_report';
      const reportConfidence = Number(processedData.confidence);
      const specialtyMap = { Diabetes: 'Endocrinologist', Pneumonia: 'Pulmonologist', Depression: 'Psychiatrist', 'Heart Disease': 'Cardiologist', 'Pleural Effusion': 'Pulmonologist' };
      const specialty = processedData.specialty || specialtyMap[bestCond] || 'General Physician';

      const formatted = {
        symptoms: topSymptoms,
        diagnosis: processedData.disease || bestCond,
        ...(hideConfidence ? {} : {
          confidence: Number.isFinite(reportConfidence) ? Math.round(reportConfidence) : Math.round((bestScore || 1) * 100),
        }),
        recommendations: processedData.recommendations?.length ? processedData.recommendations : [`Consult a ${specialty}`, 'Follow a healthy lifestyle', 'Get relevant tests done'],
        suggested_tests: processedData.suggested_tests?.length ? processedData.suggested_tests : ['Blood Test', 'Imaging', 'Consultation'],
        specialty,
        timestamp: new Date().toISOString(),
        report: processedData.report || '',
        hideConfidence,
        imagePreview: processedData.imagePreview,
      };
      setReportData(formatted);
      sessionStorage.setItem('latestReportContext', JSON.stringify(formatted));
      setLoading(false);
    } else {
      setError('No scan data found. Please upload a scan first.');
      setLoading(false);
    }
  }, [processedData, selectedImageType]);

  const TABS = ['summary', 'findings', 'recommendations', 'tests', 'detailed'];

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const blob = await pdf(<ReportPDF data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Diagnostic_Report_${reportData.diagnosis.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const confidenceColor = (c) => c >= 85 ? 'text-emerald-600' : c >= 70 ? 'text-amber-600' : 'text-red-500';
  const confidenceBg = (c) => c >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200';

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar activeTab="diagnostics" />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <ScanLine className="w-4 h-4 text-sky-500" />
            <button onClick={() => navigate('/diagnostics')} className="hover:text-gray-700">Diagnostics</button>
            <ChevronRight className="w-3 h-3 opacity-50" />
            <span className="text-gray-900 font-semibold">Diagnostic Report</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-8">
          {loading ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-12 flex flex-col items-center text-center">
              <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
              <p className="text-gray-700 font-medium">{error}</p>
              <button onClick={() => navigate('/diagnostics')} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20">
                Go to Upload
              </button>
            </div>
          ) : (
            <>
              {/* Header card */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">Diagnostic Report</h1>
                    <p className="text-sm text-gray-400 mt-1">
                      Generated on {new Date(reportData.timestamp).toLocaleDateString()} at {new Date(reportData.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!reportData.hideConfidence && reportData.confidence != null && (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${confidenceBg(reportData.confidence)}`}>
                        {reportData.confidence}% Confidence
                      </span>
                    )}
                  </div>
                </div>

                {/* Scan preview strip */}
                {reportData.imagePreview && (
                  <div className="mt-4 flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <img src={reportData.imagePreview} alt="Scan" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scan Type</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{selectedImageType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {TABS.map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-5 py-3.5 text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
                        activeTab === t ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="p-8">
                  {activeTab === 'summary' && (
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Diagnosis</p>
                        <p className="text-lg font-semibold text-blue-700">{reportData.diagnosis}</p>
                      </div>
                      {!reportData.hideConfidence && reportData.confidence != null && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Confidence</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${reportData.confidence >= 85 ? 'bg-emerald-500' : reportData.confidence >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${reportData.confidence}%` }} />
                            </div>
                            <span className={`text-sm font-bold ${confidenceColor(reportData.confidence)}`}>{reportData.confidence}%</span>
                            {reportData.confidence >= 85 ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {reportData.confidence >= 85 ? 'High confidence in diagnosis.' : reportData.confidence >= 70 ? 'Moderate confidence. Consider a second opinion.' : 'Low confidence. Consult a specialist urgently.'}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Suggested Specialist</p>
                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-xl w-fit border border-emerald-100">
                          <Stethoscope className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-700">{reportData.specialty}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'findings' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Detected Conditions</p>
                      <ul className="space-y-2.5">
                        {reportData.symptoms.length ? reportData.symptoms.map((s, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            <span className="text-sm text-gray-700">{s}</span>
                          </li>
                        )) : <p className="text-sm text-gray-400 italic">No specific conditions detected.</p>}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'recommendations' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Clinical Recommendations</p>
                      <ul className="space-y-2.5">
                        {reportData.recommendations.length ? reportData.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-sm text-gray-700">{r}</span>
                          </li>
                        )) : <p className="text-sm text-gray-400 italic">No recommendations provided.</p>}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Suggested Diagnostic Tests</p>
                      <ul className="space-y-2.5">
                        {reportData.suggested_tests.length ? reportData.suggested_tests.map((t, i) => (
                          <li key={i} className="flex items-center gap-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                            <TestTube2 className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="text-sm text-gray-700">{t}</span>
                          </li>
                        )) : <p className="text-sm text-gray-400 italic">No tests suggested.</p>}
                      </ul>
                    </div>
                  )}

                  {activeTab === 'detailed' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Full Diagnostic Explanation</p>
                      {reportData.report ? (
                        <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                          {reportData.report}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No detailed explanation available.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-wrap gap-3">
                <button 
                  onClick={handleDownloadPDF} 
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl font-semibold text-sm hover:bg-sky-100 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingPdf ? <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => navigator.share ? navigator.share({ title: 'Diagnostic Report', text: `Diagnosis: ${reportData.diagnosis}`, url: window.location.href }) : alert('Sharing not supported.')}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button
                  onClick={() => navigate('/diagnostics/chat', { state: { reportContext: reportData } })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl font-semibold text-sm hover:bg-sky-100 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> Chat with Report
                </button>
                <button
                  onClick={() => navigate('/search-doctor', { state: { defaultSpecialty: reportData.specialty, diagnosis: reportData.diagnosis } })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors ml-auto"
                >
                  <Stethoscope className="w-4 h-4" /> Find a Doctor
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
