import React from 'react';
import { Check, Clock, Pill, Stethoscope, Activity, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

function FloatingElements({ activeIndex }) {
  
  // Animation configurations
  const springConfig = { type: "spring", stiffness: 300, damping: 25 };

  return (
    <div className="absolute inset-0 pointer-events-none hidden lg:block overflow-hidden">
      
      {/* Top Left - Yellow Sticky Note (Index 1) */}
      <motion.div 
        initial={false}
        animate={{
          scale: activeIndex === 1 ? 2.2 : 1,
          rotate: activeIndex === 1 ? 0 : -6,
          zIndex: activeIndex === 1 ? 40 : 20,
        }}
        style={{ top: '10%', left: '8%', transformOrigin: 'top left' }}
        transition={springConfig}
        className="absolute w-56"
      >
        <div className="absolute inset-0 bg-black/5 blur-sm translate-y-2 rounded"></div>
        <div className={`relative bg-[#fef08a] p-4 pt-6 rounded-sm transition-shadow duration-300 ${activeIndex === 1 ? 'shadow-[0_30px_60px_rgb(0,0,0,0.15)]' : 'shadow-sm'}`}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-sm"></div>
          <p className="font-['Caveat',cursive] text-gray-800 text-lg leading-tight -rotate-2">
            AI reads your doctor’s handwriting and instantly builds your Today’s Schedule with timings, food instructions & missed-dose alerts.
          </p>
        </div>
      </motion.div>

      {/* Mid Left - Checkbox Button (Static) */}
      <div className="absolute top-[40%] left-[12%] transform rotate-12 transition-opacity duration-300 z-20" style={{ opacity: activeIndex === 0 ? 1 : 0.1 }}>
        <div className="bg-white p-4 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-gray-100 flex items-center justify-center relative">
          <div className="w-12 h-12 bg-brandBlue rounded-xl flex items-center justify-center shadow-inner">
            <Pill className="text-white w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Top Right - Reminders Card (Index 2) */}
      <motion.div 
        initial={false}
        animate={{
          scale: activeIndex === 2 ? 2.0 : 1,
          rotate: activeIndex === 2 ? 0 : 6,
          zIndex: activeIndex === 2 ? 40 : 20,
        }}
        style={{ top: '15%', right: '10%', transformOrigin: 'top right' }}
        transition={springConfig}
        className={`absolute w-64 bg-white/90 backdrop-blur-sm p-4 rounded-3xl border border-gray-100 transition-shadow duration-300 ${activeIndex === 2 ? 'shadow-[0_30px_60px_rgb(0,0,0,0.15)]' : 'shadow-[0_20px_50px_rgb(0,0,0,0.08)]'}`}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">Smart Reminders + Live Countdown</h3>
        </div>
        <div className="bg-gray-50/80 rounded-2xl p-3 border border-gray-100/50">
          <p className="text-sm font-medium text-gray-800 mb-1">Paracetamol 500mg</p>
          <p className="text-xs text-gray-500 mb-3">→ After lunch (with food)</p>
          <div className="flex items-center justify-center gap-1.5 bg-white border border-cyan-100 text-cyan-600 rounded-lg py-1.5 px-2 w-max shadow-sm">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Next dose in 04:23</span>
          </div>
        </div>
        <div className="absolute -left-12 top-10 bg-white p-3 rounded-2xl shadow-xl border border-gray-100">
          <div className="relative w-10 h-10 rounded-full border-[3px] border-gray-800 flex items-center justify-center">
            <div className="w-1 h-3 bg-gray-800 absolute top-1.5 left-[16px] origin-bottom rounded-full"></div>
            <div className="w-2 h-1 bg-red-500 absolute top-[18px] left-[18px] origin-left rounded-full"></div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Left - Today's Schedule (Index 3) */}
      <motion.div 
        initial={false}
        animate={{
          scale: activeIndex === 3 ? 2.0 : 1,
          rotate: activeIndex === 3 ? 0 : -3,
          zIndex: activeIndex === 3 ? 40 : 20,
        }}
        style={{ bottom: '5%', left: '8%', transformOrigin: 'bottom left' }}
        transition={springConfig}
        className={`absolute w-72 bg-white/95 backdrop-blur p-5 rounded-3xl border border-gray-100 transition-shadow duration-300 ${activeIndex === 3 ? 'shadow-[0_30px_60px_rgb(0,0,0,0.15)]' : 'shadow-[0_20px_50px_rgb(0,0,0,0.08)]'}`}
      >
        <h3 className="font-semibold text-gray-900 text-base mb-4">Today's Schedule</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold"><Check className="w-3 h-3 stroke-[3]" /></div>
              <p className="text-sm font-medium text-gray-800 flex-1">Morning Meds</p>
              <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-white -ml-2 z-10 flex items-center justify-center shadow-sm"><Pill className="w-3 h-3 text-brandBlue"/></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">8:00 AM</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[100%] rounded-full"></div>
              </div>
              <span className="text-xs text-emerald-500 font-medium">Taken</span>
            </div>
          </div>

          <div className="h-px bg-gray-100 w-full"></div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold"><Clock className="w-3 h-3 stroke-[3]" /></div>
              <p className="text-sm font-medium text-gray-800 flex-1">Evening Meds</p>
              <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-white -ml-2 z-10 flex items-center justify-center shadow-sm"><Pill className="w-3 h-3 text-brandBlue"/></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">8:00 PM</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 w-[10%] rounded-full"></div>
              </div>
              <span className="text-xs text-orange-500 font-medium">Pending</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Right - AI Features Card (Index 4) */}
      <motion.div 
        initial={false}
        animate={{
          scale: activeIndex === 4 ? 2.0 : 1,
          rotate: activeIndex === 4 ? 0 : 2,
          zIndex: activeIndex === 4 ? 40 : 20,
        }}
        style={{ bottom: '8%', right: '12%', transformOrigin: 'bottom right' }}
        transition={springConfig}
        className={`absolute w-72 bg-white/95 backdrop-blur p-5 rounded-3xl border border-gray-100 transition-shadow duration-300 ${activeIndex === 4 ? 'shadow-[0_30px_60px_rgb(0,0,0,0.15)]' : 'shadow-[0_20px_50px_rgb(0,0,0,0.08)]'}`}
      >
        <h3 className="font-semibold text-gray-900 text-sm mb-2">MedVision + Agent Chat</h3>
        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          Upload scans/reports → Get plain-language explanations + ask your personal AI agent anything about your medicines.
        </p>
        
        <div className="flex gap-2 relative h-16">
          <div className="absolute left-0 z-10 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform -rotate-6">
            <Activity className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="absolute left-14 z-20 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform -translate-y-2">
            <MessageSquare className="w-8 h-8 text-brandBlue" />
          </div>
          <div className="absolute left-28 z-30 bg-white p-3 rounded-2xl shadow-lg border border-gray-100 transform rotate-6">
             <Stethoscope className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </motion.div>

    </div>
  );
}

export default FloatingElements;
