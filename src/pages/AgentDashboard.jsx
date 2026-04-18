import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RadialBarChart, RadialBar, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  LayoutDashboard, Inbox, FileText, Target, Clock, Activity, 
  Pill, MoreHorizontal, CheckCircle2, ChevronLeft, Bell, Search,
  Play, Square, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const radialData = [
  { name: 'Daily', value: 95, fill: '#38bdf8' },     // Sky Blue
  { name: 'Weekly', value: 82, fill: '#10b981' },    // Emerald
  { name: 'Overall', value: 90, fill: '#f59e0b' },   // Amber
];

const weeklyData = [
  { day: 'Wed', taken: 80, missed: 20 },
  { day: 'Thu', taken: 100, missed: 0 },
  { day: 'Fri', taken: 60, missed: 40 },
  { day: 'Sat', taken: 0, missed: 0 },
  { day: 'Sun', taken: 0, missed: 0 },
];

export default function AgentDashboard() {
  const navigate = useNavigate();

  const [activeMedicines, setActiveMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('U');

  useEffect(() => {
    const fetchJourneys = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Set user profile info
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || 'User';
      setUserName(fullName.split(' ')[0]); // Get first name
      
      const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      setUserInitials(initials || 'U');

      const { data, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id);

      if (data && !error) {
        let allMeds = [];
        data.forEach(j => {
          if (j.extracted_data) {
            allMeds = [...allMeds, ...j.extracted_data];
          }
        });
        const uniqueMeds = Array.from(new Map(allMeds.map(m => [m.name, m])).values());
        setActiveMedicines(uniqueMeds);
      }
      setLoading(false);
    };

    fetchJourneys();
  }, []);

  const displayMeds = activeMedicines.length > 0 ? activeMedicines : [
    { name: 'Atorvastatin 20mg', progress: 60, color: 'amber', letter: 'A' },
    { name: 'Metformin 500mg', progress: 27, color: 'emerald', letter: 'M' },
    { name: 'Vitamin D3', progress: 95, color: 'sky', letter: 'V' }
  ];

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
              <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 text-gray-500" /> Home
                </div>
              </button>
              <button onClick={() => navigate('/chatbot')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3">
                  <Inbox className="w-4 h-4" /> Agent Chat
                </div>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">3</span>
              </button>
              <button className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4" /> Logs
                </div>
              </button>
              <button className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4" /> Goals
                </div>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">2</span>
              </button>
            </nav>
          </div>

          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Medicines</p>
              <button className="text-gray-400 hover:text-gray-600"><span className="w-4 h-4 flex items-center justify-center border border-gray-300 rounded-md text-[10px]">+</span></button>
            </div>
            <nav className="space-y-1">
              {displayMeds.map((med, idx) => (
                <button key={idx} className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors truncate">
                  <span>💊</span> <span className="truncate">{med.name}</span>
                </button>
              ))}
            </nav>
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMykiLz48L3N2Zz4=')]">
        
        {/* Topbar */}
        <header className="px-8 py-6 flex items-center justify-between sticky top-0 bg-transparent z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <CalendarIcon /> <span className="opacity-80">Monday, September 30</span>
            <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
            <span className="text-gray-900 font-semibold">Journey Day 16</span>
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full border-2 border-[#f8fafc]"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">
              {userInitials}
            </div>
          </div>
        </header>

        <div className="px-8 pb-12 w-full max-w-7xl mx-auto space-y-8">
          
          <h1 className="text-4xl font-medium text-gray-800 tracking-tight">
            Good morning, <span className="font-semibold text-gray-900">{userName}</span>
          </h1>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* To Do List */}
            <div className="md:col-span-5 bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                <span className="text-xl">📝</span>
                <h2 className="text-xl font-semibold text-gray-900">Today's schedule</h2>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-1 mb-4">
                + Create new log
              </button>
              
              <div className="space-y-4 flex-1">
                {displayMeds.map((med, idx) => (
                  <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" className="mt-1 w-4 h-4 rounded text-sky-400 focus:ring-sky-400 border-gray-300" />
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">Take {med.name} 💊</p>
                      <p className="text-xs text-gray-400">{med.frequency || 'Scheduled for 8:00 AM'}</p>
                    </div>
                  </label>
                ))}
                
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 rounded text-sky-400 focus:ring-sky-400 border-gray-300" />
                  <div>
                    <p className="text-sm font-medium text-gray-400 line-through">Drink 2 glasses of warm water 💧</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" className="mt-1 w-4 h-4 rounded text-sky-400 focus:ring-sky-400 border-gray-300" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Review symptoms with Agent 🤖</p>
                    <p className="text-xs text-gray-400">Before evening dose</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Middle Column: Next Dose & Bar Chart */}
            <div className="md:col-span-3 flex flex-col gap-6">
              
              {/* Next Dose (Time Tracker Style) */}
              <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col items-center justify-center text-center relative">
                <button className="absolute top-4 right-4 text-gray-400"><MoreHorizontal className="w-5 h-5" /></button>
                <p className="text-sm font-semibold text-gray-500 mb-2">Next Dose In</p>
                <h3 className="text-4xl font-semibold text-gray-900 tracking-tight font-mono mb-6">04:21:58</h3>
                <div className="flex items-center gap-4">
                  <button className="w-12 h-12 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 shadow-sm transition-colors border border-gray-100">
                    <Play className="w-5 h-5 ml-1" />
                  </button>
                  <button className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center hover:bg-amber-100 shadow-sm transition-colors border border-amber-100">
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekly Schedule (Bar Chart Style) */}
              <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Weekly Adherence</h3>
                  <button className="text-sky-500 text-xs font-semibold">daily</button>
                </div>
                <div className="flex-1 flex items-end justify-between px-2 gap-2 h-32">
                  {weeklyData.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 w-full">
                      <div className="text-[10px] font-bold text-gray-400">{d.taken}%</div>
                      <div className="w-full bg-sky-50 rounded-t-md relative flex items-end overflow-hidden" style={{ height: '100%' }}>
                        <div className="w-full bg-sky-400 rounded-t-md transition-all duration-500" style={{ height: `${d.taken}%` }} />
                      </div>
                      <div className="text-xs font-medium text-gray-500">{d.day}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Activity Rings & Progress */}
            <div className="md:col-span-4 flex flex-col gap-6">
              
              {/* Activity Rings */}
              <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100 relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="text-sky-500">weekly</span>
                    <span className="text-gray-400">daily</span>
                  </div>
                </div>
                
                <div className="flex items-center mt-2">
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Overall Status</p>
                      <p className="text-xl font-semibold text-gray-900">29/30 <span className="text-sm text-gray-400 font-medium">Days</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Doses Taken</p>
                      <p className="text-xl font-semibold text-gray-900">8/12 <span className="text-sm text-emerald-500 font-medium tracking-tight">On Track</span></p>
                    </div>
                  </div>
                  
                  <div className="w-40 h-40 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart 
                        cx="50%" cy="50%" 
                        innerRadius="30%" outerRadius="100%" 
                        barSize={8} 
                        data={radialData} 
                        startAngle={90} endAngle={-270}
                      >
                        <RadialBar
                          minAngle={15}
                          background={{ fill: '#f1f5f9' }}
                          clockWise
                          dataKey="value"
                          cornerRadius={10}
                        />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="flex justify-center gap-1 mt-2">
                  <div className="w-3 h-1 rounded-full bg-gray-800"></div>
                  <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                  <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-gray-100 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Medicine Progress</h3>
                  <button className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 border border-gray-100">+</button>
                </div>
                
                <div className="flex gap-4 mb-4 text-xs font-semibold border-b border-gray-100 pb-2">
                  <button className="text-sky-500 border-b-2 border-sky-500 pb-2 -mb-[9px]">Active</button>
                  <button className="text-gray-400 hover:text-gray-600 pb-2">Completed</button>
                </div>

                <div className="space-y-5">
                  {displayMeds.map((med, idx) => {
                    // Assign deterministic properties to new meds if they don't have them
                    const progress = med.progress || ((med.name.length * 7) % 80) + 10;
                    const letter = med.letter || med.name.charAt(0).toUpperCase();
                    const colors = ['sky', 'emerald', 'amber', 'violet'];
                    const color = med.color || colors[idx % colors.length];
                    
                    const bgClass = color === 'sky' ? 'bg-sky-100 text-sky-600' :
                                    color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                                    color === 'amber' ? 'bg-amber-100 text-amber-600' :
                                    'bg-violet-100 text-violet-600';
                                    
                    const barClass = color === 'sky' ? 'bg-sky-400' :
                                     color === 'emerald' ? 'bg-emerald-400' :
                                     color === 'amber' ? 'bg-amber-500' :
                                     'bg-violet-500';

                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${bgClass}`}>
                          {letter}
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-sm font-semibold text-gray-800 mb-1 truncate">{med.name}</p>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-8 text-right">{progress}%</span>
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
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
