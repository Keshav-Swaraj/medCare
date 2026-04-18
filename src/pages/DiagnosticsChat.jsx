import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ScanLine, ChevronRight, Bell, Search,
  Send, Bot, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';



const BASE_API_URL = 'http://127.0.0.1:8000';

export default function DiagnosticsChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeCtx = location.state?.reportContext || null;
  const storedCtx = (() => {
    try { const r = sessionStorage.getItem('latestReportContext'); return r ? JSON.parse(r) : null; } catch { return null; }
  })();
  const reportContext = routeCtx || storedCtx;

  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm your diagnostic report assistant. Ask me anything about your diagnosis, findings, or next steps." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const res = await axios.post(`${BASE_API_URL}/chat_with_report/`, {
        message: input, report_context: reportContext, chat_history: history,
      });
      const reply = res.data.response || 'Sorry, I could not understand that.';
      setMessages(p => [...p, { role: 'ai', text: reply }]);
    } catch {
      setMessages(p => [...p, { role: 'ai', text: 'There was an error fetching a response. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar activeTab="diagnostics" />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <ScanLine className="w-4 h-4 text-sky-500" />
            <button onClick={() => navigate('/diagnostics')} className="hover:text-gray-700">Diagnostics</button>
            <ChevronRight className="w-3 h-3 opacity-50" />
            <button onClick={() => navigate(-1)} className="hover:text-gray-700">Report</button>
            <ChevronRight className="w-3 h-3 opacity-50" />
            <span className="text-gray-900 font-semibold">Chat with Report</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-8 py-6 min-h-0">
          {/* Context Warning */}
          {!reportContext && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
              <span className="text-amber-600 text-sm font-medium">⚠️ No report context found. Open this chat from a results page for best answers.</span>
            </div>
          )}

          {/* Report context summary */}
          {reportContext?.diagnosis && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-4 mb-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Discussing Report</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{reportContext.diagnosis}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] p-5 space-y-4 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-600'}`}>
                  {msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-blue-50 text-blue-900 rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tr-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-500"><Bot className="w-4 h-4" /></div>
                <div className="bg-blue-50 text-blue-400 px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex items-center gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            className="mt-4 flex gap-3"
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          >
            <input
              id="diagnostics-chat-input"
              className="flex-1 bg-white border border-gray-200 rounded-2xl px-5 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all shadow-sm"
              placeholder="Ask about your diagnosis, symptoms, or next steps…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center shadow-md shadow-blue-500/20 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
