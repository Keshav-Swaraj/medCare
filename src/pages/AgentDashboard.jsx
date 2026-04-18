import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Inbox, Bell, Search, ChevronRight, Sun, Sunset, Moon, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CHECKIN_KEY = 'medcare_checkins';
const COLORS = ['sky', 'emerald', 'amber', 'violet', 'rose', 'indigo'];

function parseDays(str) {
  if (!str) return 30;
  const m = String(str).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getNextDoseHour(meds) {
  const h = new Date().getHours();
  if (meds.some(m => m.morning) && h < 8) return 8;
  if (meds.some(m => m.afternoon) && h < 13) return 13;
  if (meds.some(m => m.evening) && h < 20) return 20;
  return 8;
}

function calcCountdown(targetHour) {
  const now = new Date();
  const target = new Date();
  target.setHours(targetHour, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  const diff = target - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function colorClasses(color) {
  const map = {
    sky:    { bg: 'bg-sky-100 text-sky-600',    bar: 'bg-sky-400' },
    emerald:{ bg: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-400' },
    amber:  { bg: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500' },
    violet: { bg: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500' },
    rose:   { bg: 'bg-rose-100 text-rose-600',   bar: 'bg-rose-400' },
    indigo: { bg: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-400' },
  };
  return map[color] || map.sky;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [meds, setMeds] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('U');
  // Load checkins from localStorage
  const [checkins, setCheckins] = useState(() => {
    try {
      const stored = localStorage.getItem(CHECKIN_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [countdown, setCountdown] = useState('--:--:--');
  const [now, setNow] = useState(new Date());

  // Fetch user + journeys
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const meta = user.user_metadata || {};
      const fullName = meta.full_name || user.email?.split('@')[0] || 'User';
      setUserName(fullName.split(' ')[0]);
      setUserInitials(fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U');

      const { data, error } = await supabase
        .from('journeys').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data && !error) {
        setJourneys(data);
        let all = [];
        data.forEach(j => { if (j.extracted_data) all = [...all, ...j.extracted_data]; });
        const unique = Array.from(
          new Map(all.map(m => [m.medicine_name || m.name, m])).values()
        ).map(m => ({ ...m, name: m.medicine_name || m.name }));
        setMeds(unique);
      }
      setLoading(false);
    })();
  }, []);

  // Tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Countdown
  useEffect(() => {
    if (!meds.length) return;
    const update = () => setCountdown(calcCountdown(getNextDoseHour(meds)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [meds]);

  const toggleCheckin = useCallback((medName, slot) => {
    const key = `${now.toISOString().split('T')[0]}|${medName}|${slot}`;
    setCheckins(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(CHECKIN_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [now]);

  // Derived
  const todayStr = now.toISOString().split('T')[0];
  const firstJourney = journeys[0];
  const journeyDay = firstJourney
    ? Math.max(1, Math.floor((now - new Date(firstJourney.created_at)) / 86400000) + 1)
    : 1;
  const journeyDuration = meds.length
    ? Math.max(...meds.map(m => parseDays(m.duration)))
    : 30;

  const morningMeds = meds.filter(m => m.morning);
  const afternoonMeds = meds.filter(m => m.afternoon);
  const eveningMeds = meds.filter(m => m.evening);

  const buildKeys = (list, slot) => list.map(m => `${todayStr}|${m.name}|${slot}`);
  const allTodayKeys = [
    ...buildKeys(morningMeds, 'morning'),
    ...buildKeys(afternoonMeds, 'afternoon'),
    ...buildKeys(eveningMeds, 'evening'),
  ];
  const todayTotal = allTodayKeys.length;
  const todayChecked = allTodayKeys.filter(k => checkins[k]).length;
  const todayPct = todayTotal > 0 ? Math.round((todayChecked / todayTotal) * 100) : 0;

  // Weekly bar data (last 5 days)
  const weeklyData = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (4 - i));
    const dStr = d.toISOString().split('T')[0];
    const slots = meds.reduce((acc, m) => {
      if (m.morning) acc.push(`${dStr}|${m.name}|morning`);
      if (m.afternoon) acc.push(`${dStr}|${m.name}|afternoon`);
      if (m.evening) acc.push(`${dStr}|${m.name}|evening`);
      return acc;
    }, []);
    const taken = slots.filter(k => checkins[k]).length;
    const pct = slots.length > 0 ? Math.round((taken / slots.length) * 100) : 0;
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      taken: pct,
      isToday: dStr === todayStr,
    };
  });

  const weeklyAvg = Math.round(weeklyData.reduce((a, d) => a + d.taken, 0) / weeklyData.length);
  const journeyPct = Math.min(100, Math.round((journeyDay / journeyDuration) * 100));

  const radialData = [
    { name: 'Today', value: Math.max(4, todayPct), fill: '#38bdf8' },
    { name: 'Weekly', value: Math.max(4, weeklyAvg), fill: '#10b981' },
    { name: 'Journey', value: Math.max(4, journeyPct), fill: '#f59e0b' },
  ];

  const getMedProgress = (med) => {
    if (!firstJourney) return 0;
    const days = Math.floor((now - new Date(firstJourney.created_at)) / 86400000);
    return Math.min(100, Math.round((days / parseDays(med.duration)) * 100));
  };

  const nextDoseLabel = () => {
    const h = now.getHours();
    if (meds.some(m => m.morning) && h < 8) return '8:00 AM — Morning Dose';
    if (meds.some(m => m.afternoon) && h < 13) return '1:00 PM — Afternoon Dose';
    if (meds.some(m => m.evening) && h < 20) return '8:00 PM — Evening Dose';
    return '8:00 AM — Tomorrow Morning';
  };

  const noData = !loading && meds.length === 0;

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
              <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
                <div className="flex items-center gap-3"><LayoutDashboard className="w-4 h-4 text-gray-500" /> Home</div>
              </button>
              <button onClick={() => navigate('/chatbot')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><Inbox className="w-4 h-4" /> Agent Chat</div>
              </button>
            </nav>
          </div>

          {meds.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">My Medicines</p>
              <nav className="space-y-1">
                {meds.map((med, idx) => (
                  <div key={idx} className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm truncate">
                    <span>💊</span>
                    <span className="truncate">{med.name}</span>
                  </div>
                ))}
              </nav>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <CalendarIcon />
            <span className="opacity-80">{formatDate(now)}</span>
            {firstJourney && (<>
              <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
              <span className="text-gray-900 font-semibold">Journey Day {journeyDay}</span>
            </>)}
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">{userInitials}</div>
          </div>
        </header>

        <div className="px-8 py-6 w-full max-w-7xl mx-auto space-y-6">
          <h1 className="text-3xl font-medium text-gray-800 tracking-tight">
            {getGreeting()}, <span className="font-bold text-gray-900">{userName || '...'}</span>
            {todayTotal > 0 && (
              <span className="ml-3 text-base font-medium text-gray-400">
                {todayChecked}/{todayTotal} doses logged today
              </span>
            )}
          </h1>

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
            </div>
          ) : noData ? (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-sky-50 rounded-[1.5rem] flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-sky-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No prescriptions yet</h2>
              <p className="text-gray-500 mb-6 max-w-sm">Upload your first prescription to start tracking your medicine schedule, adherence, and progress.</p>
              <button onClick={() => navigate('/upload')} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg shadow-sky-500/30 transition-all hover:scale-[1.02]">
                Upload Prescription
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5">

              {/* Today's Schedule */}
              <div className="col-span-5 bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col max-h-[520px] overflow-y-auto">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
                  <span className="text-xl">📋</span>
                  <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
                  <span className="ml-auto text-xs font-semibold bg-sky-50 text-sky-600 px-2 py-1 rounded-full">{todayPct}% done</span>
                </div>

                {[
                  { slot: 'morning', label: 'Morning', icon: Sun, time: '8:00 AM', list: morningMeds, color: 'text-amber-500' },
                  { slot: 'afternoon', label: 'Afternoon', icon: Sunset, time: '1:00 PM', list: afternoonMeds, color: 'text-orange-400' },
                  { slot: 'evening', label: 'Evening', icon: Moon, time: '8:00 PM', list: eveningMeds, color: 'text-indigo-500' },
                ].map(({ slot, label, time, list, color }) => list.length > 0 && (
                  <div key={slot} className="mb-5">
                    <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider ${color}`}>
                      {label} · {time}
                    </div>
                    <div className="space-y-2.5">
                      {list.map((med, idx) => {
                        const key = `${todayStr}|${med.name}|${slot}`;
                        const done = !!checkins[key];
                        return (
                          <label key={idx} onClick={() => toggleCheckin(med.name, slot)} className="flex items-center gap-3 cursor-pointer group p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 group-hover:border-sky-400'}`}>
                              {done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate transition-colors ${done ? 'line-through text-gray-400' : 'text-gray-800 group-hover:text-gray-900'}`}>
                                {med.name}
                              </p>
                              <p className="text-xs text-gray-400">{med.frequency || time}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Middle: Countdown + Weekly Chart */}
              <div className="col-span-3 flex flex-col gap-5">
                <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Next Dose In</p>
                  <h3 className="text-4xl font-bold text-gray-900 tracking-tight font-mono mb-1">{countdown}</h3>
                  <p className="text-xs text-gray-400 font-medium">{nextDoseLabel()}</p>
                </div>

                <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Weekly Adherence</h3>
                    <span className="text-sky-500 text-xs font-bold">{weeklyAvg}% avg</span>
                  </div>
                  <div className="flex items-end justify-between gap-1.5 flex-1" style={{ minHeight: 90 }}>
                    {weeklyData.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                        <span className="text-[10px] font-bold text-gray-400">{d.taken > 0 ? `${d.taken}%` : ''}</span>
                        <div className="w-full rounded-t-md relative overflow-hidden bg-sky-50 flex items-end" style={{ height: 72 }}>
                          <div
                            className={`w-full rounded-t-md transition-all duration-700 ${d.isToday ? 'bg-sky-500' : 'bg-sky-300'}`}
                            style={{ height: `${Math.max(d.taken, 2)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold ${d.isToday ? 'text-sky-600' : 'text-gray-400'}`}>{d.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Activity + Progress */}
              <div className="col-span-4 flex flex-col gap-5">
                <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Adherence Overview</h3>
                  <div className="flex items-center">
                    <div className="flex-1 space-y-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Journey Progress</p>
                        <p className="text-xl font-bold text-gray-900">Day {journeyDay}<span className="text-sm text-gray-400 font-medium"> / {journeyDuration}</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Today's Doses</p>
                        <p className="text-xl font-bold text-gray-900">{todayChecked}/{todayTotal}
                          <span className={`text-sm font-semibold ml-1.5 ${todayPct >= 80 ? 'text-emerald-500' : todayPct >= 40 ? 'text-amber-500' : 'text-rose-400'}`}>
                            {todayPct >= 80 ? 'On Track' : todayPct >= 40 ? 'In Progress' : 'Start Now'}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2 text-[10px] font-bold">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block"/>Today {todayPct}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Weekly {weeklyAvg}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Journey {journeyPct}%</span>
                      </div>
                    </div>
                    <div className="w-36 h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="28%" outerRadius="100%" barSize={8} data={radialData} startAngle={90} endAngle={-270}>
                          <RadialBar minAngle={8} background={{ fill: '#f1f5f9' }} clockWise dataKey="value" cornerRadius={10} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Course Progress</h3>
                  <div className="space-y-4">
                    {meds.map((med, idx) => {
                      const progress = getMedProgress(med);
                      const color = COLORS[idx % COLORS.length];
                      const { bg, bar } = colorClasses(color);
                      const letter = med.name.charAt(0).toUpperCase();
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${bg}`}>{letter}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-gray-800 truncate">{med.name}</p>
                              <span className="text-[11px] font-bold text-gray-400 ml-2 flex-shrink-0">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{med.duration || '30 days'} course · {med.frequency || ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
