import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload as UploadIcon, FileImage, PenLine, X, CheckCircle2,
  AlertCircle, Plus, Trash2, Loader2, ArrowRight, Pill, Camera, IndianRupee, ExternalLink, Calendar, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const OCR_API_URL = import.meta.env.VITE_OCR_API_URL || 'http://localhost:8000';

const emptyMed = () => ({
  id: Date.now() + Math.random(),
  name: '',
  frequency: '',
  duration: '',
  description: '',
  morning: false,
  afternoon: false,
  evening: false,
});

export default function UploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('image'); // 'image' | 'manual'

  // Image state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Shared Results State
  const [ocrResult, setOcrResult] = useState(null); // array of meds
  const [ocrError, setOcrError] = useState(null);
  const [ocrConfidence, setOcrConfidence] = useState(null); // { score, label, medicines_detected }

  const fileInputRef = useRef(null);

  // Manual state
  const [medicines, setMedicines] = useState([emptyMed()]);
  const [manualError, setManualError] = useState('');
  const [showManualResults, setShowManualResults] = useState(false);

  const acceptFile = useCallback((f) => {
    setFile(f);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview('pdf'); // Basic pdf indicator
    }
    setOcrResult(null);
  }, []);

  // --- Drag & Drop ---
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type.startsWith('image/') || dropped.type === 'application/pdf')) {
      acceptFile(dropped);
    }
  }, [acceptFile]);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setOcrResult(null);
    setOcrError(null);
    setOcrConfidence(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Image Upload Flow ---
  const handleExtract = async () => {
    if (!file) return;
    setUploading(true);
    setOcrResult(null);
    setOcrError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${OCR_API_URL}/api/v1/extract-prescription/`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      
      let results = data.extracted_data;
      if (results && results.length > 0 && results[0].brand_name !== undefined) {
         results = results.map(r => ({
           name: `${r.brand_name} ${r.generic_salt || ''}`.trim(),
           frequency: r.dosage || 'As prescribed',
           duration: '30 days',
           description: r.description || '',
           morning: r.morning || false,
           afternoon: r.afternoon || false,
           evening: r.evening || false
         }));
      } else if (results && results.length > 0 && results[0].name !== undefined) {
         // It might already be in the right format.
         results = results.map(r => ({
           name: r.name || r.brand_name || '',
           frequency: r.frequency || r.dosage || '',
           duration: r.duration || r.durationDays || '30 days',
           description: r.description || '',
           morning: r.morning || false,
           afternoon: r.afternoon || false,
           evening: r.evening || false
         }));
      } else if (results && results.length > 0 && results[0].medicine_name !== undefined) {
         results = results.map(r => ({
           name: r.medicine_name || '',
           frequency: r.frequency || '',
           duration: r.duration || '30 days',
           description: r.description || '',
           morning: r.morning || false,
           afternoon: r.afternoon || false,
           evening: r.evening || false
         }));
      }

      setOcrResult(results);
      setOcrConfidence(data.confidence || null);
    } catch (err) {
      console.error("OCR Error:", err);
      setOcrError(err.message || 'OCR failed. Please check the backend is running.');
    }
    setUploading(false);
  };

  // --- Manual Entry Flow ---
  const updateMed = (id, field, value) => {
    setMedicines(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeMed = (id) => {
    setMedicines(prev => prev.filter(m => m.id !== id));
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const filled = medicines.filter(m => m.name.trim());
    if (!filled.length) {
      setManualError('Please add at least one medicine.');
      return;
    }
    setManualError('');
    setUploading(true);
    setOcrResult(filled);
    
    setShowManualResults(true);
    setUploading(false);
  };

  const handleActivate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase.from('journeys').insert([{
        user_id: user.id,
        status: 'active',
        source: activeTab,
        extracted_data: ocrResult
      }]);
      
      if (error) {
        console.error("Error saving journey:", error);
        alert(`Failed to save journey: ${error.message}\n\nPlease check your Supabase dashboard and make sure the 'journeys' table was created properly.`);
        return;
      }
    }
    navigate('/home');
  };

  const resetManual = () => {
    setShowManualResults(false);
    setOcrResult(null);
  };

  const renderCombinedResults = () => {
    return (
      <div className="space-y-8 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl border border-sky-100 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
           <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
               <CheckCircle2 className="w-5 h-5 text-emerald-600" />
             </div>
             Medicines Extracted
           </h3>
        </div>

        <div className="space-y-6">
          {ocrResult.map((med, i) => {
             return (
              <div key={i} className="group relative bg-white rounded-[2rem] border border-gray-100/50 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300">
                <div className="bg-gray-50/50 rounded-[1.8rem] p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brandBlue to-sky-400 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-500/30 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg">{med.name}</h4>
                        {med.description && <p className="text-sm text-gray-500 mt-1">{med.description}</p>}
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                          <Clock className="w-4 h-4 text-sky-500" />
                          <div className="flex gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${med.morning ? 'bg-emerald-400 ring-2 ring-emerald-100' : 'bg-gray-200'}`} title="Morning" />
                            <span className={`w-2 h-2 rounded-full ${med.afternoon ? 'bg-sky-400 ring-2 ring-sky-100' : 'bg-gray-200'}`} title="Afternoon" />
                            <span className={`w-2 h-2 rounded-full ${med.evening ? 'bg-violet-400 ring-2 ring-violet-100' : 'bg-gray-200'}`} title="Evening" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                          <Calendar className="w-4 h-4 text-sky-500" />
                          <span className="font-semibold text-gray-700 text-sm">{med.duration}</span>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] bg-dotted overflow-hidden flex flex-col relative">
      
      {/* Background Ambience Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-sky-200/40 to-blue-300/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply hidden lg:block" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-indigo-200/30 to-violet-200/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply hidden lg:block" />

      {/* Navbar */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-6 px-6 sm:px-8 z-10 relative">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="grid grid-cols-2 gap-1 bg-white p-2 rounded-xl shadow-[0_4px_15px_rgb(0,0,0,0.05)] border border-gray-100 group-hover:shadow-[0_8px_25px_rgba(46,116,255,0.15)] transition-all">
            <div className="w-2.5 h-2.5 rounded-full bg-brandBlue" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          </div>
          <span className="font-black text-2xl tracking-tight text-gray-900">MedCare</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center py-8 sm:py-12 px-4 sm:px-8 relative z-10">
        <div className="w-full max-w-6xl">
          
          {/* Header Texts */}
          <div className="text-center mb-12 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-sky-100 shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-sky-600">AI-Powered Extraction</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-6 leading-tight">
              Digitize your prescription <br className="hidden sm:block"/> in seconds.
            </h1>
            <p className="text-gray-500 text-lg sm:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
              Upload a photo or enter medicines manually. Our agent extracts the details and finds you the absolute best prices online.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex justify-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-2 flex flex-wrap sm:flex-nowrap gap-2 w-full max-w-md relative z-20">
              <button
                onClick={() => { setActiveTab('image'); clearFile(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'image' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'text-gray-500 hover:text-sky-600 hover:bg-sky-50'}`}
              >
                <Camera className="w-4 h-4" /> Upload Image
              </button>
              <button
                onClick={() => { setActiveTab('manual'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'manual' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'text-gray-500 hover:text-sky-600 hover:bg-sky-50'}`}
              >
                <PenLine className="w-4 h-4" /> Manual Entry
              </button>
            </div>
          </div>

          {/* ----- IMAGE TAB CONTENT ----- */}
          {activeTab === 'image' && (
            <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              {!file ? (
                // State 1: Upload Zone
                <div className="max-w-3xl mx-auto">
                  <div className="relative group">
                    {/* Glowing effect behind the dropzone */}
                    <div className="absolute inset-[-4px] bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 -z-10" />
                    
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative bg-white/80 backdrop-blur-xl border-[3px] border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-300 py-24 px-8 text-center overflow-hidden
                        ${dragging ? 'border-sky-500 bg-sky-50/80 scale-[1.02]' : 'border-gray-200 hover:border-sky-400 hover:bg-white'}`}
                    >
                      <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-gray-50 to-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-center border border-gray-100 group-hover:-translate-y-2 transition-transform duration-500">
                        <UploadIcon className="w-10 h-10 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-black text-2xl tracking-tight mb-2">
                          {dragging ? 'Drop prescription here' : 'Drag & drop your document'}
                        </p>
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest">
                          Supports JPG, PNG, PDF up to 10MB
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg, image/png, application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) acceptFile(f);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // State 2: 2-Column Split View (Preview + Extraction/Results)
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
                  {/* Left Column: Image Preview */}
                  <div className="bg-white rounded-[2.5rem] border border-gray-100/60 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 lg:sticky lg:top-8">
                    <div className="flex items-center justify-between mb-5 px-2">
                      <h3 className="font-black text-gray-900 text-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <FileImage className="w-4 h-4 text-gray-600" />
                        </div>
                        Source Document
                      </h3>
                      <button onClick={clearFile} className="text-gray-400 hover:text-white hover:bg-red-500 transition-all p-2 rounded-full">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="rounded-[2rem] overflow-hidden border border-gray-100/50 bg-gray-50/50 flex items-center justify-center relative group w-full min-h-[300px] shadow-inner">
                      {preview === 'pdf' ? (
                        <div className="text-center py-20">
                          <FileImage className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-bold">PDF Document</p>
                          <p className="text-gray-400 text-sm">{file.name}</p>
                        </div>
                      ) : (
                        <img src={preview} alt="Prescription" className="w-full max-h-[70vh] object-contain rounded-[2rem]" />
                      )}
                      
                      {/* Scanning Animation */}
                      {uploading && (
                        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[2rem] bg-sky-900/10 backdrop-blur-[1px]">
                          <div className="absolute w-full h-[4px] bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_25px_8px_rgba(56,189,248,0.6)] animate-scan" />
                        </div>
                      )}
                    </div>

                    {/* Confidence Score Badge */}
                    {ocrConfidence && (
                      <div className="mt-4 px-1">
                        <div className="bg-gradient-to-br from-slate-50 to-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">OCR Confidence</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              ocrConfidence.label === 'High' ? 'bg-emerald-100 text-emerald-700' :
                              ocrConfidence.label === 'Medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>{ocrConfidence.label}</span>
                          </div>
                          <div className="flex items-end gap-3">
                            <span className={`text-3xl font-black tabular-nums ${
                              ocrConfidence.label === 'High' ? 'text-emerald-600' :
                              ocrConfidence.label === 'Medium' ? 'text-amber-500' :
                              'text-red-500'
                            }`}>{ocrConfidence.score}%</span>
                            <span className="text-sm text-gray-400 font-medium mb-0.5">
                              {ocrConfidence.medicines_detected} medicine{ocrConfidence.medicines_detected !== 1 ? 's' : ''} detected
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                ocrConfidence.label === 'High' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                ocrConfidence.label === 'Medium' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                'bg-gradient-to-r from-red-400 to-red-500'
                              }`}
                              style={{ width: `${ocrConfidence.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            Based on field completeness of extracted medicine data.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Loading / Results */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 sm:p-10 min-h-[450px] sm:min-h-[600px] flex flex-col relative overflow-hidden">
                    {!ocrResult ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
                        {ocrError ? (
                          <div className="animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-red-100">
                              <AlertCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Extraction Interrupted</h3>
                            <p className="text-red-500 font-medium mb-8 px-4 max-w-md mx-auto">{ocrError}</p>
                            <button
                              onClick={handleExtract}
                              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                              <Pill className="w-5 h-5" /> Try Again
                            </button>
                          </div>
                        ) : !uploading ? (
                          <div className="animate-in zoom-in-95 duration-500 max-w-md mx-auto">
                            <div className="relative w-24 h-24 mx-auto mb-8">
                              <div className="absolute inset-0 bg-sky-200 rounded-[2rem] blur-xl opacity-60 animate-pulse" />
                              <div className="relative w-full h-full bg-gradient-to-br from-white to-sky-50 rounded-[2rem] flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white">
                                <UploadIcon className="w-10 h-10 text-sky-500" />
                              </div>
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Ready to process</h3>
                            <p className="text-gray-500 text-lg mb-10 leading-relaxed">Our clinical AI will scan this document to extract medicines and dosages automatically.</p>
                            <button
                              onClick={handleExtract}
                              className="w-full group relative flex items-center justify-center gap-3 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold py-5 px-8 rounded-[1.5rem] shadow-[0_10px_40px_rgba(56,189,248,0.4)] transition-all duration-300 hover:shadow-[0_20px_50px_rgba(56,189,248,0.6)] hover:-translate-y-1 overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                              <Pill className="w-6 h-6 relative z-10" />
                              <span className="text-lg relative z-10">Extract</span>
                            </button>
                          </div>
                        ) : (
                          <div className="animate-in fade-in duration-500 flex flex-col items-center">
                            <div className="relative w-24 h-24 mb-8">
                              <div className="absolute inset-0 rounded-full border-[4px] border-sky-100" />
                              <div className="absolute inset-0 rounded-full border-[4px] border-sky-500 border-t-transparent animate-spin" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Pill className="w-8 h-8 text-sky-500 animate-pulse" />
                              </div>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Analyzing Document</h3>
                            <p className="text-gray-500 text-lg max-w-sm">Detecting medical terms and formatting your schedule...</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {renderCombinedResults()}
                        <div className="mt-auto pt-6">
                          <button
                            onClick={handleActivate}
                            className="w-full group flex items-center justify-between bg-gradient-to-r from-sky-500 to-brandBlue hover:from-sky-600 hover:to-blue-700 text-white font-bold py-5 px-8 rounded-2xl shadow-xl shadow-sky-500/20 transition-all hover:-translate-y-1"
                          >
                            <span className="text-lg">Activate Agent Tracker</span>
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                              <ArrowRight className="w-5 h-5" />
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----- MANUAL TAB CONTENT ----- */}
          {activeTab === 'manual' && (
            <div className="w-full max-w-3xl mx-auto">
              {!showManualResults ? (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <PenLine className="w-5 h-5 text-sky-500" />
                    Add Medicines Manually
                  </h2>
                  <form onSubmit={handleManualSubmit} className="space-y-6">
                    <div className="space-y-5">
                      {medicines.map((med, idx) => (
                        <div key={med.id} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              Medicine {idx + 1}
                            </span>
                            {medicines.length > 1 && (
                              <button type="button" onClick={() => removeMed(med.id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Medicine Name + Strength</label>
                            <input
                              required
                              placeholder="e.g. Dolo 650mg"
                              value={med.name}
                              onChange={(e) => updateMed(med.id, 'name', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900 placeholder:text-gray-400"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (Optional)</label>
                            <input
                              placeholder="e.g. Used to treat fever and pain"
                              value={med.description}
                              onChange={(e) => updateMed(med.id, 'description', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900 placeholder:text-gray-400"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">When to take</label>
                              <div className="flex items-center gap-4 mb-2 mt-1">
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={med.morning || false} onChange={(e) => updateMed(med.id, 'morning', e.target.checked)} className="w-4 h-4 text-sky-500 rounded border-gray-300 focus:ring-sky-500" /> Morning
                                </label>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={med.afternoon || false} onChange={(e) => updateMed(med.id, 'afternoon', e.target.checked)} className="w-4 h-4 text-sky-500 rounded border-gray-300 focus:ring-sky-500" /> Afternoon
                                </label>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                                  <input type="checkbox" checked={med.evening || false} onChange={(e) => updateMed(med.id, 'evening', e.target.checked)} className="w-4 h-4 text-sky-500 rounded border-gray-300 focus:ring-sky-500" /> Evening
                                </label>
                              </div>
                              <input
                                placeholder="Or enter text (e.g. Twice a day)"
                                value={med.frequency}
                                onChange={(e) => updateMed(med.id, 'frequency', e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900 placeholder:text-gray-400 mt-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">How many days to take</label>
                              <input
                                required
                                placeholder="e.g. 30 days"
                                value={med.duration}
                                onChange={(e) => updateMed(med.id, 'duration', e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900 placeholder:text-gray-400"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMedicines(prev => [...prev, emptyMed()])}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-sky-500 hover:text-sky-500 hover:bg-blue-50/30 text-sm font-semibold transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add another medicine
                    </button>

                    {manualError && (
                      <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                        <AlertCircle className="w-4 h-4" />
                        {manualError}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-sky-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] text-lg disabled:opacity-70 disabled:hover:scale-100"
                      >
                        {uploading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                        ) : (
                          <>Preview Medicines <ArrowRight className="w-5 h-5" /></>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Your Medicines</h2>
                    <button onClick={resetManual} className="text-sky-500 text-sm font-semibold hover:text-blue-700 flex items-center gap-1">
                      <PenLine className="w-4 h-4" /> Edit Manual Entry
                    </button>
                  </div>
                  {renderCombinedResults()}
                  <div className="mt-8">
                    <button
                      onClick={handleActivate}
                      className="w-full group flex items-center justify-between bg-gradient-to-r from-sky-500 to-brandBlue hover:from-sky-600 hover:to-blue-700 text-white font-bold py-5 px-8 rounded-2xl shadow-xl shadow-sky-500/20 transition-all hover:-translate-y-1"
                    >
                      <span className="text-lg">Activate Agent Tracker</span>
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
