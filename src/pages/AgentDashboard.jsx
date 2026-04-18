import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, Bell, Search, ChevronRight, Sun, Sunset, Moon, Upload, LogOut, FileText, Pill } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useReminders, loadRecentLogs } from '../hooks/useReminders';

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
  const [userId, setUserId] = useState(null);
  const [journeyId, setJourneyId] = useState(null);
  const [userMeta, setUserMeta] = useState({});
  // checkins: { 'YYYY-MM-DD|medName|slot': 'taken'|'not_taken'|true }
  const [checkins, setCheckins] = useState(() => {
    try {
      const stored = localStorage.getItem(CHECKIN_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [countdown, setCountdown] = useState('--:--:--');
  const [now, setNow] = useState(new Date());

  // Called by useReminders when SW sends feedback
  const handleReminderStatus = useCallback((slotKey, status) => {
    // slotKey from SW: 'YYYY-MM-DD|slot' → expand to per-med keys
    setCheckins(prev => {
      const updated = { ...prev };
      // Mark all meds in that slot
      const [dateStr, slot] = slotKey.split('|');
      meds.filter(m => m[slot]).forEach(med => {
        updated[`${dateStr}|${med.name}|${slot}`] = status;
      });
      localStorage.setItem(CHECKIN_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [meds]);

  const { permissionGranted, permissionDenied, markTaken, markNotTaken, resetDose, sendTestNotification } = useReminders({
    meds,
    userId,
    journeyId,
    onStatusChange: handleReminderStatus,
  });

  // Fetch user + journeys + today's dose_logs
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserId(user.id);
      const meta = user.user_metadata || {};
      setUserMeta(meta);
      const fullName = meta.full_name || user.email?.split('@')[0] || 'User';
      setUserName(fullName.split(' ')[0]);
      setUserInitials(fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U');

      const { data, error } = await supabase
        .from('journeys').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data && !error) {
        setJourneys(data);
        if (data[0]) setJourneyId(data[0].id);
        let all = [];
        data.forEach(j => { if (j.extracted_data) all = [...all, ...j.extracted_data]; });
        const unique = Array.from(
          new Map(all.map(m => [m.medicine_name || m.name, m])).values()
        ).map(m => ({ ...m, name: m.medicine_name || m.name }));
        setMeds(unique);

        // Hydrate checkins from Supabase dose_logs (overrides localStorage)
        const dbLogs = await loadRecentLogs(user.id, 7);
        if (Object.keys(dbLogs).length > 0) {
          setCheckins(prev => {
            const merged = { ...prev, ...dbLogs };
            localStorage.setItem(CHECKIN_KEY, JSON.stringify(merged));
            return merged;
          });
        }
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
    const dateStr = now.toISOString().split('T')[0];
    const key = `${dateStr}|${medName}|${slot}`;
    const currentStatus = checkins[key];

    // Cycle: Pending (none/false) -> taken -> not_taken -> Pending
    let newStatus;
    if (currentStatus === 'taken' || currentStatus === true) {
      newStatus = 'not_taken';
    } else if (currentStatus === 'not_taken') {
      newStatus = false;
    } else {
      newStatus = 'taken';
    }

    setCheckins(prev => {
      const updated = { ...prev, [key]: newStatus };
      localStorage.setItem(CHECKIN_KEY, JSON.stringify(updated));
      return updated;
    });

    // Persist to Supabase
    if (newStatus === 'taken') {
      markTaken(medName, slot, dateStr);
    } else if (newStatus === 'not_taken') {
      markNotTaken(medName, slot, dateStr);
    } else {
      resetDose(medName, slot, dateStr);
    }
  }, [now, checkins, markTaken, markNotTaken, resetDose]);

  const handlePrint = () => {
    window.print();
  };


  // Derived
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

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
  const todayChecked = allTodayKeys.filter(k => checkins[k] === 'taken' || checkins[k] === true).length;
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
    const taken = slots.filter(k => checkins[k] === 'taken' || checkins[k] === true).length;
    const pct = slots.length > 0 ? Math.round((taken / slots.length) * 100) : 0;
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      taken: pct,
      isToday: dStr === todayStr,
    };
  });

  const weeklyAvg = Math.round(weeklyData.reduce((a, d) => a + d.taken, 0) / weeklyData.length);
  const journeyPct = Math.min(100, Math.round((journeyDay / journeyDuration) * 100));

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
      <aside className="no-print w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
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
                <div className="flex items-center gap-3"><LayoutDashboard className="w-4 h-4 text-sky-500" /> Home</div>
              </button>
              <button onClick={() => navigate('/chatbot')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><Inbox className="w-4 h-4" /> Agent Chat</div>
              </button>
              <button onClick={() => navigate('/my-medicines')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><Pill className="w-4 h-4" /> My Medicine</div>
              </button>
            </nav>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl font-medium text-sm transition-colors">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="no-print flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <CalendarIcon />
            <span className="opacity-80">{formatDate(now)}</span>
            {firstJourney && (<>
              <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
              <span className="text-gray-900 font-semibold">Journey Day {journeyDay}</span>
            </>)}
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm hover:shadow-md"
            >
              <FileText className="w-4 h-4 text-sky-500" />
              Download PDF Report
            </button>
            <div className="h-6 w-px bg-gray-100 mx-1" />
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">{userInitials}</div>
          </div>
        </header>

        <div className="px-8 py-6 w-full max-w-[1600px] mx-auto space-y-6">
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
                        const status = checkins[key];
                        const isTaken = status === 'taken' || status === true;
                        const isNotTaken = status === 'not_taken';
                        return (
                          <label key={idx} onClick={() => toggleCheckin(med.name, slot)} className="flex items-center gap-3 cursor-pointer group p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isTaken ? 'bg-emerald-500 border-emerald-500' :
                              isNotTaken ? 'bg-rose-400 border-rose-400' :
                              'border-gray-300 group-hover:border-sky-400'
                            }`}>
                              {isTaken && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              {isNotTaken && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate transition-colors ${
                                isTaken ? 'line-through text-gray-400' :
                                isNotTaken ? 'text-rose-400' :
                                'text-gray-800 group-hover:text-gray-900'
                              }`}>
                                {med.name}
                                {isNotTaken && <span className="ml-2 text-[10px] font-bold bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded-full">Missed</span>}
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
                  <div className="mt-3 flex flex-col items-center gap-2">
                    {permissionGranted ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        Reminders Active
                      </span>
                    ) : permissionDenied ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-3 py-1 rounded-full">
                          🚫 Notifications Blocked
                        </span>
                        <p className="text-[9px] text-gray-400 max-w-[150px]">Please reset permission in browser settings to enable reminders.</p>
                      </div>
                    ) : (
                      <button
                        onClick={sendTestNotification}
                        className="text-[11px] font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-full transition-colors"
                      >
                        🔔 Enable Reminders
                      </button>
                    )}
                    {permissionGranted && (
                      <button
                        onClick={sendTestNotification}
                        className="text-[10px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >Test notification</button>
                    )}
                  </div>
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
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-gray-900">Adherence Overview</h3>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md border ${todayPct >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : todayPct >= 40 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                      {todayPct >= 80 ? 'On Track' : todayPct >= 40 ? 'In Progress' : 'Action Needed'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <CircularRing percentage={todayPct} color="text-blue-500" label="Today" />
                    <CircularRing percentage={weeklyAvg} color="text-emerald-500" label="Weekly" />
                    <CircularRing percentage={journeyPct} color="text-amber-500" label="Journey" />
                  </div>
                  <div className="mt-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Doses Today</p>
                      <p className="text-lg font-bold text-gray-900">{todayChecked} <span className="text-sm font-medium text-gray-400">/ {todayTotal}</span></p>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Journey Day</p>
                      <p className="text-lg font-bold text-gray-900">{journeyDay} <span className="text-sm font-medium text-gray-400">/ {journeyDuration}</span></p>
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

      {/* Hidden Printable Report Section */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .print-report-container { display: none; }
        }
        @media print {
          /* Hide EVERYTHING by default */
          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .no-print, aside, main, header, nav, button {
            display: none !important;
          }

          /* Specifically show the report */
          .print-report-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 40px !important;
            background: white !important;
            z-index: 9999 !important;
          }

          .print-report-container * {
            visibility: visible !important;
          }

          /* Fix for tables and colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
      
      <div id="printable-report" className="print-report-container">
        <div className="flex justify-between items-start border-b-2 border-sky-500 pb-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="grid grid-cols-2 gap-[2px] p-1 rounded-md bg-sky-500">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              </div>
              <span className="font-bold text-2xl text-gray-900">MedCare</span>
            </div>
            <p className="text-gray-500 text-sm">Personal Health Adherence Report</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">Date: {now.toLocaleDateString()}</p>
            <p className="text-xs text-gray-500">Ref: MC-{Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-4">Patient Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 text-sm">Full Name</span>
                <span className="text-gray-900 text-sm font-semibold">{userMeta.full_name || userName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500 text-sm">Age / Gender</span>
                <span className="text-gray-900 text-sm font-semibold">{userMeta.age || 'N/A'} • {userMeta.gender || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block mb-1">Pre-existing Conditions</span>
                <span className="text-gray-900 text-sm font-medium">{userMeta.conditions || 'None recorded'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm block mb-1">Known Allergies</span>
                <span className="text-gray-900 text-sm font-medium text-rose-500">{userMeta.allergies || 'None recorded'}</span>
              </div>
            </div>
          </div>

          <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100">
            <h3 className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-4">Adherence Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl text-center shadow-sm">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Today</p>
                <p className="text-2xl font-bold text-sky-600">{todayPct}%</p>
              </div>
              <div className="bg-white p-4 rounded-xl text-center shadow-sm">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Weekly Avg</p>
                <p className="text-2xl font-bold text-emerald-500">{weeklyAvg}%</p>
              </div>
              <div className="bg-white p-4 rounded-xl text-center shadow-sm col-span-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Journey Progress</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${journeyPct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">Day {journeyDay}/{journeyDuration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Current Medication Schedule</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3 text-xs font-bold text-gray-600 rounded-tl-xl">Medicine Name</th>
                <th className="p-3 text-xs font-bold text-gray-600">Timing / Frequency</th>
                <th className="p-3 text-xs font-bold text-gray-600">Duration</th>
                <th className="p-3 text-xs font-bold text-gray-600 rounded-tr-xl">Course Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meds.map((med, i) => (
                <tr key={i}>
                  <td className="p-3 py-4 text-sm font-semibold text-gray-900">{med.name}</td>
                  <td className="p-3 py-4 text-sm text-gray-600">
                    {[med.morning && 'Morning', med.afternoon && 'Afternoon', med.evening && 'Evening'].filter(Boolean).join(', ') || med.frequency}
                  </td>
                  <td className="p-3 py-4 text-sm text-gray-600">{med.duration}</td>
                  <td className="p-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-400" style={{ width: `${getMedProgress(med)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-400">{getMedProgress(med)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-100 flex justify-between items-end">
          <div className="max-w-md">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Medical Disclaimer</p>
            <p className="text-[9px] text-gray-400 leading-relaxed">
              This report is generated by MedCare AI Agent based on user-inputted data and is intended for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-900 uppercase">MedCare Health System</p>
            <p className="text-[9px] text-gray-400">medcare-agent.ai • Support: hello@medcare.ai</p>
          </div>
        </div>
      </div>

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

function CircularRing({ percentage, color, label }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  // Limit to 100 max
  const safePct = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePct / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] h-[72px] flex items-center justify-center mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={`${color} transition-all duration-1000 ease-out`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[15px] font-bold text-gray-900">{safePct}%</span>
      </div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}
