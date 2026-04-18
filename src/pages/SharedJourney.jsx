import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Sun, Sunset, Moon, ShieldCheck, AlertTriangle, AlertOctagon, Clock, ArrowLeft, Pill, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_OCR_API_URL || 'http://localhost:8000';
const COLORS = ['sky', 'emerald', 'amber', 'violet', 'rose', 'indigo'];

function colorClasses(color) {
  const map = {
    sky:     { bg: 'bg-sky-100 text-sky-600',     bar: 'bg-sky-400' },
    emerald: { bg: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-400' },
    amber:   { bg: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500' },
    violet:  { bg: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500' },
    rose:    { bg: 'bg-rose-100 text-rose-600',    bar: 'bg-rose-400' },
    indigo:  { bg: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-400' },
  };
  return map[color] || map.sky;
}

function CircularRing({ percentage, color, label }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] h-[72px] flex items-center justify-center mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            className={`${color} transition-all duration-1000 ease-out`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-[15px] font-bold text-gray-900">{safePct}%</span>
      </div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

const STATUS_CONFIG = {
  good:     { label: 'On Track',       icon: ShieldCheck,   bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700', dotClass: 'bg-emerald-500' },
  warning:  { label: 'Needs Attention', icon: AlertTriangle, bgClass: 'bg-amber-50 border-amber-200',    textClass: 'text-amber-700',   dotClass: 'bg-amber-500' },
  critical: { label: 'Critical',       icon: AlertOctagon,  bgClass: 'bg-rose-50 border-rose-200',      textClass: 'text-rose-700',    dotClass: 'bg-rose-500' },
};

export default function SharedJourney() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_URL}/api/v1/shared/${code}`);
        if (resp.status === 404) { setError('Invalid share code. Please check the link.'); return; }
        if (resp.status === 410) { setError('This share link has expired.'); return; }
        if (!resp.ok) { setError('Something went wrong. Please try again.'); return; }
        setData(await resp.json());
      } catch {
        setError('Could not connect to the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
          <p className="text-gray-500 text-sm font-medium">Loading shared journey…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg p-12 max-w-md text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertOctagon className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all">
            <ArrowLeft className="w-4 h-4" /> Go to MedCare
          </Link>
        </div>
      </div>
    );
  }

  const {
    patient_name, journey_day, journey_duration,
    today_schedule, adherence_today, weekly_adherence,
    missed_doses, next_dose, status,
    medicines, course_progress, weekly_bars,
    doses_today_taken, doses_today_total,
  } = data;

  const journeyPct = Math.min(100, Math.round((journey_day / journey_duration) * 100));
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.good;
  const StatusIcon = statusCfg.icon;

  const morningItems  = today_schedule.filter(s => s.slot === 'morning');
  const afternoonItems = today_schedule.filter(s => s.slot === 'afternoon');
  const eveningItems  = today_schedule.filter(s => s.slot === 'evening');

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Top banner */}
      <div className={`border-b ${statusCfg.bgClass} px-6 py-3`}>
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className={`w-5 h-5 ${statusCfg.textClass}`} />
            <span className={`text-sm font-semibold ${statusCfg.textClass}`}>Caregiver View (Read Only)</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 font-medium">Code: {code}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusCfg.bgClass}`}>
            <div className={`w-2 h-2 rounded-full ${statusCfg.dotClass} animate-pulse`} />
            <span className={`text-xs font-bold ${statusCfg.textClass}`}>{statusCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="px-6 py-5 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 gap-[3px] p-1.5 rounded-lg border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <div className="w-2 h-2 rounded-full bg-sky-400" />
              <div className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
            <span className="font-semibold text-lg text-gray-900 tracking-tight">MedCare</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-sm text-gray-500 font-medium">Shared Journey</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-sm border border-sky-200">
              {patient_name?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{patient_name}'s Journey</p>
              <p className="text-xs text-gray-400">Day {journey_day} of {journey_duration}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Status alert for critical/warning */}
        {status === 'critical' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-700">Low Adherence Alert</p>
              <p className="text-xs text-rose-500">Weekly adherence is below 60%. The patient may need additional support or reminders.</p>
            </div>
          </div>
        )}
        {status === 'warning' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-700">Attention Needed</p>
              <p className="text-xs text-amber-600">Adherence is between 60–80%. Consider checking in with the patient.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-5">
          {/* Today's Schedule */}
          <div className="col-span-12 lg:col-span-5 bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col max-h-[520px] overflow-y-auto">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              <span className="ml-auto text-xs font-semibold bg-sky-50 text-sky-600 px-2 py-1 rounded-full">{adherence_today}% done</span>
            </div>

            {[
              { slot: 'morning', label: 'Morning', icon: Sun, time: '8:00 AM', list: morningItems, color: 'text-amber-500' },
              { slot: 'afternoon', label: 'Afternoon', icon: Sunset, time: '1:00 PM', list: afternoonItems, color: 'text-orange-400' },
              { slot: 'evening', label: 'Evening', icon: Moon, time: '8:00 PM', list: eveningItems, color: 'text-indigo-500' },
            ].map(({ slot, label, time, list, color }) => list.length > 0 && (
              <div key={slot} className="mb-5">
                <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider ${color}`}>
                  {label} · {time}
                </div>
                <div className="space-y-2.5">
                  {list.map((item, idx) => {
                    const isTaken = item.status === 'taken';
                    const isNotTaken = item.status === 'not_taken';
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/50">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isTaken ? 'bg-emerald-500 border-emerald-500' :
                          isNotTaken ? 'bg-rose-400 border-rose-400' :
                          'border-gray-300'
                        }`}>
                          {isTaken && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          {isNotTaken && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            isTaken ? 'line-through text-gray-400' :
                            isNotTaken ? 'text-rose-400' :
                            'text-gray-800'
                          }`}>
                            {item.medicine}
                            {isNotTaken && <span className="ml-2 text-[10px] font-bold bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded-full">Missed</span>}
                            {isTaken && <span className="ml-2 text-[10px] font-bold bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded-full">Taken</span>}
                          </p>
                          <p className="text-xs text-gray-400">{item.description || time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {today_schedule.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">No medicines scheduled for today.</div>
            )}
          </div>

          {/* Middle: Next Dose + Weekly Chart */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Next Dose</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-5 h-5 text-sky-400" />
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{next_dose}</h3>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Pill className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{doses_today_taken}/{doses_today_total} doses taken today</span>
              </div>
            </div>

            <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Weekly Adherence</h3>
                <span className="text-sky-500 text-xs font-bold">{weekly_adherence}% avg</span>
              </div>
              <div className="flex items-end justify-between gap-1.5 flex-1" style={{ minHeight: 90 }}>
                {(weekly_bars || []).map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-bold text-gray-400">{d.pct > 0 ? `${d.pct}%` : ''}</span>
                    <div className="w-full rounded-t-md relative overflow-hidden bg-sky-50 flex items-end" style={{ height: 72 }}>
                      <div
                        className={`w-full rounded-t-md transition-all duration-700 ${d.is_today ? 'bg-sky-500' : 'bg-sky-300'}`}
                        style={{ height: `${Math.max(d.pct, 2)}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-semibold ${d.is_today ? 'text-sky-600' : 'text-gray-400'}`}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Adherence Overview + Course Progress */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
            <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-gray-900">Adherence Overview</h3>
                <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md border ${
                  adherence_today >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  adherence_today >= 40 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                  'bg-rose-50 text-rose-500 border-rose-100'
                }`}>
                  {adherence_today >= 80 ? 'On Track' : adherence_today >= 40 ? 'In Progress' : 'Action Needed'}
                </span>
              </div>
              <div className="flex justify-between items-center px-4">
                <CircularRing percentage={adherence_today} color="text-blue-500" label="Today" />
                <CircularRing percentage={weekly_adherence} color="text-emerald-500" label="Weekly" />
                <CircularRing percentage={journeyPct} color="text-amber-500" label="Journey" />
              </div>
              <div className="mt-6 flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Doses Today</p>
                  <p className="text-lg font-bold text-gray-900">{doses_today_taken} <span className="text-sm font-medium text-gray-400">/ {doses_today_total}</span></p>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Journey Day</p>
                  <p className="text-lg font-bold text-gray-900">{journey_day} <span className="text-sm font-medium text-gray-400">/ {journey_duration}</span></p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Course Progress</h3>
              <div className="space-y-4">
                {(course_progress || []).map((med, idx) => {
                  const color = COLORS[idx % COLORS.length];
                  const { bg, bar } = colorClasses(color);
                  const letter = med.medicine.charAt(0).toUpperCase();
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${bg}`}>{letter}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">{med.medicine}</p>
                          <span className="text-[11px] font-bold text-gray-400 ml-2 flex-shrink-0">{med.progress_pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${med.progress_pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{med.duration} course · {med.frequency}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Missed doses detail */}
        {missed_doses && missed_doses.length > 0 && (
          <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-rose-100">
            <h3 className="text-base font-semibold text-rose-600 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Missed Doses Today
            </h3>
            <div className="flex flex-wrap gap-3">
              {missed_doses.map((d, i) => (
                <div key={i} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-sm font-medium border border-rose-100">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  {d.medicine} — {d.time}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-8 py-6 px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <p className="text-xs text-gray-400">
            This is a read-only view shared by the patient. No data can be modified from this page.
          </p>
          <p className="text-xs text-gray-400">MedCare Agent • Caregiver Sharing</p>
        </div>
      </footer>
    </div>
  );
}
