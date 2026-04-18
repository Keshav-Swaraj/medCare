import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, Send, User, Bot, Bell, Search, ChevronRight, Loader2, Pill } from 'lucide-react';
import { supabase } from '../lib/supabase';

const OCR_API = import.meta.env.VITE_OCR_API_URL || 'http://localhost:8000';

export default function Chatbot() {
  const navigate = useNavigate();
  const [userInitials, setUserInitials] = useState('U');
  const [userContext, setUserContext] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load user profile + medicines from Supabase
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingContext(false); return; }

      const meta = user.user_metadata || {};
      const fullName = meta.full_name || user.email?.split('@')[0] || 'User';
      const firstName = fullName.split(' ')[0];
      setUserInitials(fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U');

      // Fetch medicines
      const { data: journeys } = await supabase
        .from('journeys')
        .select('extracted_data, created_at')
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

      setMedicines(uniqueMeds);

      const ctx = {
        name: fullName,
        age: meta.age || '',
        gender: meta.gender || '',
        conditions: meta.conditions || '',
        allergies: meta.allergies || '',
        medicines: uniqueMeds,
      };
      setUserContext(ctx);

      // Build greeting
      let greeting = `Hello ${firstName}! I'm your MedCare Agent powered by AI. `;
      if (uniqueMeds.length > 0) {
        greeting += `I can see you're currently on ${uniqueMeds.length} medicine${uniqueMeds.length > 1 ? 's' : ''}: ${uniqueMeds.slice(0, 3).map(m => m.name).join(', ')}${uniqueMeds.length > 3 ? ' and more' : ''}. `;
      }
      if (meta.conditions) {
        greeting += `I've noted your history of ${meta.conditions}. `;
      }
      greeting += `Ask me anything about your medicines, side effects, timings, or general health guidance!`;

      setMessages([{ role: 'bot', content: greeting }]);
      setLoadingContext(false);
    })();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setSending(true);

    try {
      // Build conversation history (skip the initial bot greeting for context window efficiency)
      const history = updatedMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const res = await fetch(`${OCR_API}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          user_context: userContext || {},
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `⚠️ Sorry, I couldn't process that. ${err.message}`,
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-2">
          <div className="grid grid-cols-2 gap-[3px] p-1.5 rounded-lg border border-gray-100">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <div className="w-2 h-2 rounded-full bg-blue-400" />
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
              <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
                <div className="flex items-center gap-3"><Inbox className="w-4 h-4 text-blue-600" /> Agent Chat</div>
              </button>
              <button onClick={() => navigate('/my-medicines')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3"><Pill className="w-4 h-4" /> My Medicine</div>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <span className="opacity-80">MedCare</span>
            <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
            <span className="text-gray-900 font-semibold">Agent Chat</span>
            {userContext && (
              <span className="ml-2 text-[11px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                AI Powered · Groq
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <button className="text-gray-400 hover:text-gray-600"><Search className="w-5 h-5" /></button>
            <button className="text-gray-400 hover:text-gray-600"><Bell className="w-5 h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">{userInitials}</div>
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto pb-6 px-8 min-h-0">
          <div className="bg-white flex-1 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden mt-4">

            {loadingContext ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Loading your medical context...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="text-center pb-2">
                  <span className="inline-block px-3 py-1 bg-gray-50 text-gray-400 text-xs font-semibold rounded-full border border-gray-100">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'bot' && (
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-sm'
                        : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div className="flex items-end gap-3 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            <div className="p-4 bg-white border-t border-gray-100">
              {/* Quick prompts */}
              {messages.length <= 1 && !loadingContext && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {['What are the side effects?', 'When should I take my medicines?', 'Can I eat before taking my pills?', 'I missed a dose, what should I do?'].map((q, i) => (
                    <button key={i} onClick={() => setInput(q)}
                      className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about your medicines, side effects, or schedule..."
                  disabled={loadingContext || sending}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400 disabled:opacity-60"
                />
                <button type="submit" disabled={!input.trim() || sending || loadingContext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
