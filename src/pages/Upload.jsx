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

const fetchRealPrices = async (meds) => {
  try {
    const promises = meds.map(async (med) => {
      const res = await fetch(`${OCR_API_URL}/api/v1/search-medicine?q=${encodeURIComponent(med.name)}`);
      if (!res.ok) throw new Error('Failed to fetch prices');
      const data = await res.json();
      return {
        medicineName: med.name,
        options: data.results || []
      };
    });
    return await Promise.all(promises);
  } catch (err) {
    console.error(err);
    return [];
  }
};

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
  const [priceData, setPriceData] = useState(null);
  const [ocrError, setOcrError] = useState(null);

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
    setPriceData(null);
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
    setPriceData(null);
    setOcrError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Image Upload Flow ---
  const handleExtract = async () => {
    if (!file) return;
    setUploading(true);
    setOcrResult(null);
    setPriceData(null);
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
      const realPrices = await fetchRealPrices(results);
      setPriceData(realPrices);
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
    
    const realPrices = await fetchRealPrices(filled);
    setPriceData(realPrices);
    
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
        extracted_data: ocrResult,
        price_comparison: priceData
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
    setPriceData(null);
  };

  // --- Render Helpers ---
  const renderMedicineCards = () => (
    <div className="space-y-4 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        Extracted Medicines
      </h3>
      <div className="space-y-3">
        {ocrResult.map((med, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex gap-4 items-start hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-sky-500 flex items-center justify-center font-bold text-lg shrink-0">
              {i + 1}
            </div>
            <div className="space-y-2 w-full">
              <div>
                <h4 className="font-semibold text-gray-900 text-base">{med.name}</h4>
                {med.description && <p className="text-sm text-gray-500 mt-0.5">{med.description}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${med.morning ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-400'}`}>Morning</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${med.afternoon ? 'bg-sky-100 text-sky-700' : 'bg-gray-200 text-gray-400'}`}>Afternoon</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${med.evening ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-400'}`}>Evening</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Calendar className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="font-medium truncate">{med.duration}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPriceComparison = () => {
    const totalSavings = priceData?.reduce((acc, curr) => {
      const maxSaving = curr.options.length > 0 ? Math.max(...curr.options.map(o => o.savings)) : 0;
      return acc + maxSaving;
    }, 0) || 0;

    return (
      <div className="space-y-4 mb-8 bg-blue-50/50 rounded-2xl p-5 sm:p-6 border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-sky-500" />
          Real-Time Price Comparison
        </h3>
        <div className="space-y-5">
          {priceData?.map((data, i) => (
            <div key={i} className="space-y-3">
              <h4 className="font-semibold text-gray-700 text-sm border-b border-blue-100 pb-1">{data.medicineName}</h4>
              {data.options.length === 0 ? (
                <p className="text-sm text-gray-500 italic bg-white p-3 rounded-xl border border-gray-100">No prices found online.</p>
              ) : (
                data.options.map((opt, j) => (
                  <div key={j} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm mb-1">{opt.medicineName}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-500 line-through">MRP: ₹{opt.brandedPrice}</span>
                        <span className="font-semibold text-sky-500">Sale Price: ₹{opt.janAushadhiPrice}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Savings</p>
                        <p className="font-bold text-emerald-500 flex items-center justify-end">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {opt.savings}
                        </p>
                      </div>
                      <a href={opt.buyLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Buy Now
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
        <div className="bg-emerald-50 text-emerald-700 text-sm font-semibold p-4 rounded-xl border border-emerald-100 flex items-center justify-between mt-4">
          <span>Max Est. Savings:</span>
          <span className="text-lg font-bold">₹{totalSavings.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-dotted overflow-hidden flex flex-col">
      {/* Navbar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-5 px-4 z-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
            <div className="w-2.5 h-2.5 rounded-full bg-brandBlue" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
          </div>
          <span className="font-semibold text-xl tracking-tight text-gray-900">MedCare</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center py-6 sm:py-10 px-4">
        <div className="w-full max-w-6xl">
          
          {/* Header Texts */}
          <div className="text-center mb-8 max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-4">
              Upload your prescription
            </h1>
            <p className="text-gray-500 text-base sm:text-lg font-medium leading-relaxed">
              Take a photo of your prescription, discharge summary or lab report — or enter medicines manually. Our AI will extract the details.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-1.5 flex flex-wrap sm:flex-nowrap gap-1 w-full max-w-md">
              <button
                onClick={() => { setActiveTab('image'); clearFile(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'image' ? 'bg-brandBlue text-white shadow-md shadow-sky-500/20' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                📸 Upload Image
              </button>
              <button
                onClick={() => { setActiveTab('manual'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'manual' ? 'bg-brandBlue text-white shadow-md shadow-sky-500/20' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >
                ✏️ Manual Entry
              </button>
            </div>
          </div>

          {/* ----- IMAGE TAB CONTENT ----- */}
          {activeTab === 'image' && (
            <div className="w-full">
              {!file ? (
                // State 1: Upload Zone
                <div className="max-w-2xl mx-auto bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 sm:p-10">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center gap-5 cursor-pointer transition-all py-20 px-6 text-center ${dragging ? 'border-sky-500 bg-blue-50/60 scale-[1.01]' : 'border-gray-200 hover:border-sky-500 hover:bg-blue-50/30'}`}
                  >
                    <div className="w-20 h-20 rounded-[1.5rem] bg-white shadow-md flex items-center justify-center border border-gray-100">
                      <Camera className="w-8 h-8 text-sky-500" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-semibold text-lg mb-1">
                        {dragging ? 'Drop prescription here' : 'Click or drag & drop to upload'}
                      </p>
                      <p className="text-gray-400 text-sm font-medium">
                        Accepts .jpg, .png, .pdf up to 10MB
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
              ) : (
                // State 2: 2-Column Split View (Preview + Extraction/Results)
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Image Preview */}
                  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 lg:sticky lg:top-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileImage className="w-5 h-5 text-sky-500" />
                        Uploaded Document
                      </h3>
                      <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-50 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="rounded-[1.5rem] overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center relative group h-[400px] sm:h-[500px]">
                      {preview === 'pdf' ? (
                        <div className="text-center">
                          <FileImage className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">PDF Document</p>
                          <p className="text-gray-400 text-sm">{file.name}</p>
                        </div>
                      ) : (
                        <img src={preview} alt="Prescription" className="w-full h-full object-contain" />
                      )}
                    </div>
                  </div>

                  {/* Right Column: Loading / Results */}
                  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_rgb(0,0,0,0.06)] p-6 sm:p-8 min-h-[400px] sm:min-h-[550px] flex flex-col">
                    {!ocrResult ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                        {ocrError ? (
                          <>
                            <div className="w-20 h-20 bg-red-50 rounded-[1.5rem] flex items-center justify-center mb-6">
                              <AlertCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Extraction Failed</h3>
                            <p className="text-red-500 text-sm font-medium mb-1 px-4">{ocrError}</p>
                            <p className="text-gray-400 text-xs mb-6">Check browser console (F12) for details.</p>
                            <button
                              onClick={handleExtract}
                              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-2xl shadow-lg shadow-sky-500/30 transition-all"
                            >
                              <Pill className="w-5 h-5" /> Try Again
                            </button>
                          </>
                        ) : !uploading ? (
                          <>
                            <div className="w-20 h-20 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mb-6">
                              <UploadIcon className="w-8 h-8 text-sky-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to extract</h3>
                            <p className="text-gray-500 mb-8 max-w-sm">Our AI will read the medicines, dosages, and schedules from your uploaded file.</p>
                            <button
                              onClick={handleExtract}
                              className="w-full max-w-xs flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-sky-500/30 transition-all hover:scale-[1.02] active:scale-95"
                            >
                              <Pill className="w-5 h-5" />
                              Extract Medicines
                            </button>
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-6" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Extracting medicines...</h3>
                            <p className="text-gray-500">Scanning document for names, frequency, and duration.</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {renderMedicineCards()}
                        {renderPriceComparison()}
                        <div className="mt-auto pt-4">
                          <button
                            onClick={handleActivate}
                            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-4 rounded-2xl shadow-[0_10px_25px_rgba(46,116,255,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] text-lg"
                          >
                            Continue to Activate MedCare Agent
                            <ArrowRight className="w-5 h-5" />
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
                          <><Loader2 className="w-5 h-5 animate-spin" /> Fetching Prices...</>
                        ) : (
                          <>Preview & Compare Prices <ArrowRight className="w-5 h-5" /></>
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
                  {renderMedicineCards()}
                  {renderPriceComparison()}
                  <div className="mt-8">
                    <button
                      onClick={handleActivate}
                      className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-4 rounded-2xl shadow-[0_10px_25px_rgba(46,116,255,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] text-lg"
                    >
                      Continue to Activate MedCare Agent
                      <ArrowRight className="w-5 h-5" />
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
