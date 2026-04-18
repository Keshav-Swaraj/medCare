import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, Pill, ScanLine, UserSearch, LogOut, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Sidebar({ activeTab }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const NavItem = ({ id, label, icon: Icon, path }) => {
    const isActive = activeTab === id;
    
    if (isActive) {
      return (
        <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
          <div className="flex items-center gap-3"><Icon className="w-4 h-4 text-sky-500" /> {label}</div>
        </button>
      );
    }

    return (
      <button onClick={() => navigate(path)} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
        <div className="flex items-center gap-3"><Icon className="w-4 h-4" /> {label}</div>
      </button>
    );
  };

  return (
    <aside className="no-print w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/')}>
        <div className="grid grid-cols-2 gap-[3px] p-1.5 rounded-lg border border-gray-100 transition-transform duration-500 group-hover:rotate-180">
          <div className="w-2 h-2 rounded-full bg-brandBlue transition-transform duration-300 group-hover:scale-110" />
          <div className="w-2 h-2 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110" />
          <div className="w-2 h-2 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110" />
          <div className="w-2 h-2 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110" />
        </div>
        <span className="font-semibold text-lg text-gray-900 tracking-tight group-hover:text-brandBlue transition-colors duration-300">MedCare</span>
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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">MedCare</p>
          <nav className="space-y-1">
            <NavItem id="home" label="Home" icon={LayoutDashboard} path="/home" />
            <NavItem id="chat" label="Agent Chat" icon={Inbox} path="/chatbot" />
            <NavItem id="medicine" label="My Medicine" icon={Pill} path="/my-medicines" />
          </nav>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">MedVision</p>
          <nav className="space-y-1">
            <NavItem id="diagnostics" label="Diagnostics" icon={ScanLine} path="/diagnostics" />
            <NavItem id="find-doctor" label="Find Doctor" icon={UserSearch} path="/search-doctor" />
          </nav>
        </div>

        <CaregiverCodeEntry navigate={navigate} />

        <div className="pt-4 mt-4 border-t border-gray-100">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl font-medium text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}

function CaregiverCodeEntry({ navigate }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  const handleGo = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    navigate(`/shared/journey/${c}`);
  };

  return (
    <div className="pt-4 mt-4 border-t border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">Sharing</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors"
        >
          <Users className="w-4 h-4" /> Caregiver View
        </button>
      ) : (
        <form onSubmit={handleGo} className="px-3 space-y-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            autoFocus
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 tracking-wider text-center uppercase"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setCode(''); }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 font-semibold rounded-lg text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
