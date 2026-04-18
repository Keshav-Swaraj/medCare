import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Inbox, FileText, Target, 
  Send, User, Bot, Clock,
  Search, Bell, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Chatbot() {
  const navigate = useNavigate();
  const [userInitials, setUserInitials] = useState('U');
  const [messages, setMessages] = useState([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchUserContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingContext(false);
        return;
      }
      
      const meta = user.user_metadata || {};
      const fullName = meta.full_name || 'User';
      const firstName = fullName.split(' ')[0];
      
      const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      setUserInitials(initials || 'U');

      let greeting = `Hello ${firstName}! I am your MedCare Agent. `;
      if (meta.conditions) {
        greeting += `I have noted your history of ${meta.conditions}. `;
      }
      if (meta.allergies) {
        greeting += `I'm keeping track of your allergies: ${meta.allergies}. `;
      }
      greeting += "I'm here to help you stay on track. How are you feeling today?";

      setMessages([{ role: 'bot', content: greeting }]);
      setLoadingContext(false);
    };

    fetchUserContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      let botResponse = "I'm here to help. Make sure to take your Metformin after dinner as prescribed.";
      
      if (userMsg.content.toLowerCase().includes('eat') || userMsg.content.toLowerCase().includes('food')) {
        botResponse = "For your Metformin, it is best to take it right after your meal to prevent stomach upset. Your Atorvastatin can be taken with or without food.";
      } else if (userMsg.content.toLowerCase().includes('missed') || userMsg.content.toLowerCase().includes('forgot')) {
        botResponse = "If you missed a dose, take it as soon as you remember. But if it's almost time for your next dose, skip the missed one. Do not take double doses.";
      } else if (userMsg.content.toLowerCase().includes('headache') || userMsg.content.toLowerCase().includes('pain')) {
        botResponse = "I've noted that you're feeling unwell. If the headache is severe or persists, please consult your doctor immediately.";
      }

      setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      
      {/* Sidebar - Matching AgentDashboard */}
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
              <button onClick={() => navigate('/agent/1')} className="w-full flex items-center justify-between px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4" /> Home
                </div>
              </button>
              <button className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 rounded-xl text-gray-900 font-medium text-sm">
                <div className="flex items-center gap-3">
                  <Inbox className="w-4 h-4 text-sky-500" /> Agent Chat
                </div>
                <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">3</span>
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
              <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <span>💊</span> Atorvastatin
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <span className="opacity-70">🔴</span> Metformin
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:bg-gray-50 rounded-xl font-medium text-sm transition-colors">
                <span className="opacity-70">⚡</span> Vitamins
              </button>
            </nav>
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMykiLz48L3N2Zz4=')]">
        
        {/* Topbar */}
        <header className="px-8 py-6 flex items-center justify-between sticky top-0 bg-transparent z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
            <span className="opacity-80">MedCare</span>
            <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
            <span className="text-gray-900 font-semibold">Agent Chat</span>
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

        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto pb-6 px-8">
          
          <div className="bg-white flex-1 rounded-[1.5rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col overflow-hidden relative">
            
            {loadingContext ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="text-center pb-4">
                <span className="inline-block px-3 py-1 bg-gray-50 text-gray-500 text-xs font-semibold rounded-md border border-gray-100">
                  Today
                </span>
              </div>
              
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 border border-sky-200">
                      <Bot className="w-5 h-5 text-sky-600" />
                    </div>
                  )}
                  
                  <div className={`max-w-[75%] px-5 py-3.5 text-sm md:text-base leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-sky-500 text-white rounded-2xl rounded-tr-sm shadow-sm' 
                      : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            )}

            <div className="p-4 bg-white border-t border-gray-100">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your medicines, side effects, or schedule..."
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-gray-400"
                />
                <button 
                  type="submit"
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
            
          </div>
        </div>

      </main>
    </div>
  );
}
