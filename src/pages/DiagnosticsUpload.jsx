import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Upload, X, Check, AlertCircle, Image, ScanLine,
  Brain, Heart, Activity, FileText, ChevronRight,
  LayoutDashboard, Inbox, Bell, Search, Pill, LogOut, UserSearch
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const BASE_API_URL = 'http://127.0.0.1:8000';

const IMAGE_TYPES = [
  { id: 'xray',       label: 'Chest X-Ray',        icon: Activity, desc: 'Lung & chest conditions',  color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'ct_2d',      label: 'CT Scan (2D)',        icon: ScanLine,  desc: '2D cross-sectional slice', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { id: 'ct_3d',      label: 'CT Scan (3D)',        icon: Brain,     desc: '3D volumetric / tumor',    color: 'bg-violet-50 text-violet-600 border-violet-200' },
  { id: 'mri_3d',     label: 'MRI Tumor Scan',      icon: Brain,     desc: 'Brain tumor detection',    color: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200' },
  { id: 'ultrasound', label: 'Ultrasound',           icon: Heart,     desc: 'Organ & tissue imaging',   color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { id: 'lab_report', label: 'Lab Report',           icon: FileText,  desc: 'Blood tests & pathology',  color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
];

const isSupportedFileForType = (f, type) => {
  if (!f || !type) return false;
  if (type === 'lab_report') return f.type.startsWith('image/') || f.type === 'application/pdf';
  return f.type.startsWith('image/');
};

const extractConfidence = (data) => {
  const v = Number(data?.confidence);
  if (Number.isFinite(v) && v >= 0) return Number(v.toFixed(2));
  return null; // graceful fallback – let result page handle missing confidence
};


export default function DiagnosticsUpload() {
  const navigate = useNavigate();
  const [selectedImageType, setSelectedImageType] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!selectedImageType) { setError('Please select an image type first.'); return; }
    if (!isSupportedFileForType(f, selectedImageType)) { setError('Please upload a valid image file (JPEG, PNG, BMP).'); return; }
    setError(null);
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else { setPreview(null); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!selectedImageType) { setError('Please select an image type first.'); return; }
    if (!isSupportedFileForType(f, selectedImageType)) { setError('Please upload a valid image file.'); return; }
    setFile(f); setError(null);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    } else { setPreview(null); }
  };

  const handleUpload = async () => {
    if (!file) return setError('Please select a file first.');
    if (!selectedImageType) return setError('Please select an image type first.');

    const endpoints = {
      xray:       { pred: `${BASE_API_URL}/predict/xray/`,        report: `${BASE_API_URL}/generate-report/xray/` },
      ct_2d:      { pred: `${BASE_API_URL}/predict/ct/2d/`,       report: `${BASE_API_URL}/predict/ct/2d/` },
      ct_3d:      { pred: `${BASE_API_URL}/predict/ct/3d/`,       report: `${BASE_API_URL}/predict/ct/3d/` },
      mri_3d:     { pred: `${BASE_API_URL}/predict/mri/3d/`,      report: `${BASE_API_URL}/predict/mri/3d/` },
      ultrasound: { pred: `${BASE_API_URL}/predict/ultrasound/`,  report: `${BASE_API_URL}/predict/ultrasound/` },
      lab_report: { pred: `${BASE_API_URL}/predict/lab-report/`,  report: `${BASE_API_URL}/predict/lab-report/` },
    };
    const ep = endpoints[selectedImageType];
    if (!ep) return setError('Unsupported image type selected.');

    try {
      setUploading(true); setError(null); setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);

      const predRes = await axios.post(ep.pred, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        validateStatus: () => true, timeout: 60000,
        onUploadProgress: (pe) => {
          const total = pe.total || pe.loaded || 1;
          setUploadProgress(Math.round((pe.loaded * 100) / total));
        },
      });
      if (predRes.status < 200 || predRes.status >= 300)
        throw new Error(predRes.data?.detail || 'Upload blocked');

      let reportData = {};
      if (selectedImageType === 'xray' && ep.report) {
        const repRes = await axios.post(ep.report, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          validateStatus: () => true, timeout: 60000,
        });
        if (repRes.status < 200 || repRes.status >= 300)
          throw new Error(repRes.data?.detail || 'Report generation failed.');
        reportData = repRes.data;
      } else {
        reportData = predRes.data;
      }

      const hideConfidence = selectedImageType === 'lab_report' || reportData?.hideConfidence === true;
      const confidence = hideConfidence ? null : extractConfidence(reportData);
      const processedData = {
        predictions: predRes.data.predictions || null,
        report: reportData.report,
        disease: reportData.disease,
        symptoms: reportData.symptoms || reportData.findings || [],
        recommendations: reportData.recommendations || [],
        suggested_tests: reportData.suggested_tests || [],
        specialty: reportData.specialty,
        hideConfidence,
        ...(hideConfidence ? {} : { confidence, groqConfidence: confidence }),
        imagePreview: preview,
        imageType: selectedImageType,
      };

      navigate('/diagnostics/results', {
        state: { selectedImageType, processedData },
      });
    } catch (err) {
      if (err?.code === 'ECONNABORTED') {
        setError('Request timed out. Server took too long. Please try again.');
      } else {
        setError(err?.message || 'An error occurred during upload. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const selectedType = IMAGE_TYPES.find(t => t.id === selectedImageType);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar navigate={navigate} active="diagnostics" />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <ScanLine className="w-4 h-4 text-sky-500" />
            <span>Diagnostics</span>
            <ChevronRight className="w-3 h-3 opacity-50" />
            <span className="text-gray-900 font-semibold">Upload Medical Image</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="px-8 py-8 max-w-6xl mx-auto w-full space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Medical Diagnostics</h1>
            <p className="text-gray-500 mt-2 text-base font-medium">Upload a medical image and receive an AI-powered diagnostic report.</p>
          </div>

          {/* Image Type Selection */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 sm:p-10">
            <h2 className="text-xl font-bold text-gray-900 mb-8">Select Scan Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {IMAGE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedImageType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => { setSelectedImageType(type.id); setFile(null); setPreview(null); setError(null); }}
                    className={`group flex items-start gap-5 p-6 rounded-[1.5rem] text-left transition-all duration-300 ${
                      isSelected
                        ? 'border-2 border-sky-500 bg-sky-50/50 shadow-[0_8px_30px_rgba(56,189,248,0.2)]'
                        : 'border-2 border-transparent bg-gray-50/50 hover:bg-white hover:border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]'
                    }`}
                  >
                    <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                      isSelected ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-white text-gray-400 shadow-sm border border-gray-100 group-hover:text-sky-500 group-hover:border-sky-100'
                    }`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="mt-0.5">
                      <p className={`text-base font-bold tracking-tight mb-1 transition-colors ${isSelected ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'}`}>{type.label}</p>
                      <p className="text-sm font-medium text-gray-500 leading-relaxed">{type.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Area */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 sm:p-10 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Upload {selectedType ? selectedType.label : 'Image'}
            </h2>

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-[1.5rem] p-12 transition-all duration-300 cursor-pointer ${
                preview ? 'border-sky-400 bg-sky-50/40' : 'border-gray-200 hover:border-sky-400 hover:bg-sky-50/20'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={selectedImageType === 'lab_report' ? 'image/*,application/pdf' : 'image/*'}
                className="hidden"
              />
              {preview ? (
                <div className="flex flex-col items-center">
                  <div className="relative w-full max-w-sm mx-auto">
                    <div className="relative w-full rounded-xl overflow-hidden shadow-md">
                      <img src={preview} alt="Preview" className="object-cover w-full max-h-64" />
                      
                      {/* Scanning Animation */}
                      {uploading && (
                        <div className="absolute inset-0 z-10 pointer-events-none bg-sky-900/10 backdrop-blur-[1px]">
                          <div className="absolute w-full h-[4px] bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_25px_8px_rgba(56,189,248,0.6)] animate-scan" />
                        </div>
                      )}
                    </div>
                    
                    {!uploading && (
                      <button
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-20"
                        onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-4 text-base text-gray-500 font-medium">{file?.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-sky-100">
                    <Upload className="w-7 h-7 text-sky-500" />
                  </div>
                  <p className="text-base font-bold text-gray-700 mb-1.5">
                    {selectedImageType === 'lab_report' ? 'Drag & drop your lab report here' : 'Drag & drop your medical image here'}
                  </p>
                  <p className="text-xs text-gray-400 mb-2">or click to browse files</p>
                  <p className="text-xs text-gray-400">
                    {selectedImageType === 'lab_report' ? 'Supported: JPEG, PNG, BMP, PDF' : 'Supported: JPEG, PNG, BMP'}
                  </p>
                  {!selectedImageType && (
                    <p className="mt-3 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                      ↑ Select a scan type above first
                    </p>
                  )}
                </div>
              )}
            </div>

            {uploading && (
              <div className="mt-5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Uploading & analysing…</span>
                  <span className="text-sm font-semibold text-blue-600">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="flex justify-end">
            <button
              id="diagnostics-analyze-btn"
              onClick={handleUpload}
              disabled={!file || uploading || !selectedImageType}
              className="flex items-center gap-2 px-7 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] text-sm"
            >
              {uploading ? (
                <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Processing…</>
              ) : (
                <><Check className="w-4 h-4" /> Analyse Scan</>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ navigate, active }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navItems = [
    { label: 'Home', icon: LayoutDashboard, path: '/home', id: 'home' },
    { label: 'Agent Chat', icon: Inbox, path: '/chatbot', id: 'chat' },
    { label: 'My Medicine', icon: Pill, path: '/my-medicines', id: 'medicines' },
    { label: 'Diagnostics', icon: ScanLine, path: '/diagnostics', id: 'diagnostics' },
    { label: 'Find Doctor', icon: UserSearch, path: '/search-doctor', id: 'doctor' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-2">
        <div className="grid grid-cols-2 gap-[3px] p-1.5 rounded-lg border border-gray-100">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <div className="w-2 h-2 rounded-full bg-sky-400" />
        </div>
        <span className="font-semibold text-lg text-gray-900 tracking-tight">MedCare</span>
      </div>

      <div className="px-4 pb-2">
        <button
          onClick={() => navigate('/upload')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-xs">+</span>
          Upload New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">General</p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, path, id }) => (
              <button
                key={id}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  active === id ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active === id ? 'text-sky-500' : ''}`} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl font-medium text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}
