import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, Pill, Search, Bell, ChevronRight, Clock, Calendar, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

const OCR_API_URL = import.meta.env.VITE_OCR_API_URL || 'http://localhost:8000';

export default function MyMedicines() {
  const navigate = useNavigate();
  const [userInitials, setUserInitials] = useState('U');
  const [meds, setMeds] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const meta = user.user_metadata || {};
      const fullName = meta.full_name || user.email?.split('@')[0] || 'User';
      setUserInitials(fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U');

      const { data: journeys } = await supabase
        .from('journeys')
        .select('extracted_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      let allMeds = [];
      if (journeys) {
        journeys.forEach(j => {
          if (j.extracted_data) allMeds = [...allMeds, ...j.extracted_data];
        });
      }
      const uniqueMeds = Array.from(
        new Map(allMeds.map(m => [m.medicine_name || m.name, m])).values()
      ).map(m => ({ ...m, name: m.medicine_name || m.name }));

      setMeds(uniqueMeds);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (meds.length === 0) return;

    const fetchMissingPrices = async () => {
      const newPrices = { ...prices };
      let updated = false;

      await Promise.all(meds.map(async (med) => {
        if (newPrices[med.name]) return;
        try {
          const res = await fetch(`${OCR_API_URL}/api/v1/search-medicine?q=${encodeURIComponent(med.name)}`);
          if (res.ok) {
            const data = await res.json();
            newPrices[med.name] = data.results || [];
            updated = true;
          }
        } catch (e) {
          console.error(e);
        }
      }));

      if (updated) {
        setPrices(newPrices);
      }
    };

    fetchMissingPrices();
  }, [meds]);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      {/* Sidebar */}
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
          <button onClick={() => navigate('/upload')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-xs">+</span>
            Upload New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">General</p>
            <nav className="space-y-1">
              <button onClick={() => navigate('/home')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><LayoutDashboard className="w-4 h-4" /> Home</div>
              </button>
              <button onClick={() => navigate('/chatbot')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><Inbox className="w-4 h-4" /> Agent Chat</div>
              </button>
              <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
                <div className="flex items-center gap-3"><Pill className="w-4 h-4 text-sky-500" /> My Medicine</div>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <span className="opacity-80">MedCare</span>
            <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
            <span className="text-gray-900 font-semibold">My Medicines</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">{userInitials}</div>
          </div>
        </header>

        <div className="px-8 py-6 w-full max-w-5xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Pill className="w-6 h-6" />
            </div>
            My Medicines & Alternatives
          </h1>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : meds.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
              <Pill className="w-12 h-12 text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No medicines found</h2>
              <p className="text-gray-500">You haven't uploaded any prescriptions yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {meds.map((med, i) => {
                const pDataOptions = prices[med.name];

                return (
                  <div key={i} className="group relative bg-white rounded-[2rem] border border-gray-100/50 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300">
                    <div className="bg-gray-50/50 rounded-[1.8rem] p-5 sm:p-6 mb-1">
                      <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30 shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 text-lg">{med.name}</h4>
                          {med.description && <p className="text-sm text-gray-500 mt-1">{med.description}</p>}
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <div className="flex gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${med.morning ? 'bg-emerald-500' : 'bg-gray-200'}`} title="Morning" />
                              <span className={`w-2 h-2 rounded-full ${med.afternoon ? 'bg-blue-500' : 'bg-gray-200'}`} title="Afternoon" />
                              <span className={`w-2 h-2 rounded-full ${med.evening ? 'bg-indigo-500' : 'bg-gray-200'}`} title="Evening" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="font-semibold text-gray-700 text-sm">{med.duration}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {pDataOptions ? (
                      pDataOptions.length > 0 ? (
                        <div className="px-2 pb-2">
                          <h5 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3 ml-3 mt-2">Compare Prices</h5>
                          <div className="flex overflow-x-auto gap-4 pb-4 pt-5 snap-x px-2" style={{ scrollbarWidth: 'none' }}>
                            {pDataOptions.map((opt, j) => {
                              const isCheapest = j === 0;
                              return (
                                <div key={j} className={`snap-start shrink-0 w-[240px] relative bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all h-full ${isCheapest ? 'border-emerald-200 shadow-[0_8px_30px_rgba(16,185,129,0.12)]' : 'border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]'}`}>
                                  {isCheapest && (
                                    <div className="absolute -top-3 -right-2 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-lg flex items-center gap-1.5 z-10">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      Best
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-100 mb-3 inline-block">
                                      {opt.source || "Pharmacy"}
                                    </span>
                                    <div className="flex items-baseline gap-2 mb-1.5">
                                      <span className="text-2xl font-bold text-gray-900">₹{opt.janAushadhiPrice}</span>
                                      <span className="text-sm font-medium text-gray-400 line-through">₹{opt.brandedPrice}</span>
                                    </div>
                                    <p className="text-xs font-semibold text-emerald-500">Save ₹{opt.savings}</p>
                                  </div>
                                  <a href={opt.buyLink} target="_blank" rel="noopener noreferrer" className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${isCheapest ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}>
                                    Buy Now <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="px-6 pb-6 pt-2">
                          <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">No alternate prices found online for this item.</p>
                        </div>
                      )
                    ) : (
                       <div className="px-6 pb-6 pt-4">
                         <div className="flex items-center justify-center gap-3 text-sm font-medium text-blue-600 bg-blue-50 p-6 rounded-2xl border border-blue-100">
                           <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                           Searching alternatives across pharmacies...
                         </div>
                       </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
