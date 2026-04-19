import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import FloatingElements from './FloatingElements';

function Hero({ activeIndex }) {
  const navigate = useNavigate();
  const [caregiverCode, setCaregiverCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const code = caregiverCode.trim().toUpperCase();
    if (!code) {
      setCodeError('Please enter a share code');
      return;
    }
    setCodeError('');
    navigate(`/shared/journey/${code}`);
  };

  return (
    <main className="flex-1 w-full flex flex-col items-center justify-center relative pt-8 pb-16 px-4 z-10">
      
      {/* Central Floating Icon */}
      <div className="mb-4 z-20 group">
        <div className="grid grid-cols-2 gap-1.5 bg-white p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transform -rotate-3 transition-all duration-500 group-hover:rotate-[177deg] group-hover:scale-110">
          <div className="w-4 h-4 rounded-full bg-brandBlue transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
        </div>
      </div>

      <h1 className="relative z-30 text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-center max-w-4xl leading-[1.1] mb-4">
        <span className="text-gray-900">Your autonomous health companion</span><br className="hidden sm:block" />
        <span className="text-gray-400">after every doctor visit.</span>
      </h1>
      
      <p className="relative z-30 text-lg md:text-xl text-gray-500 text-center max-w-3xl mb-6 font-medium">
        Understand your prescription, scans, and reports in simple words. Get a clear medicine schedule, smart reminders, progress tracking, plain-language explanations, and AI support.
      </p>
      
      <motion.div
        initial={false}
        animate={{
          scale: activeIndex === 6 ? 1.4 : 1,
          zIndex: activeIndex === 6 ? 50 : 30,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-30"
      >
        <Link to="/signup" className="inline-block bg-brandBlue hover:bg-blue-600 text-white font-medium px-8 py-3.5 rounded-xl text-base shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95">
          Get Started
        </Link>
      </motion.div>

      {/* Caregiver Code Entry */}
      <motion.div 
        initial={false}
        animate={{
          scale: activeIndex === 5 ? 1.15 : 1,
          zIndex: activeIndex === 5 ? 50 : 20,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="z-20 mt-8 w-full max-w-sm"
      >
        <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 transition-shadow duration-300 ${activeIndex === 5 ? 'shadow-[0_30px_60px_rgb(0,0,0,0.15)]' : 'shadow-[0_8px_30px_rgb(0,0,0,0.06)]'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Caregiver Access</p>
              <p className="text-[11px] text-gray-400">Enter a share code to view a patient's progress</p>
            </div>
          </div>
          <form onSubmit={handleCodeSubmit} className="flex gap-2">
            <input
              type="text"
              value={caregiverCode}
              onChange={(e) => { setCaregiverCode(e.target.value); setCodeError(''); }}
              placeholder="e.g. MED-AX72K"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent tracking-wider text-center uppercase"
            />
            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-95 text-sm whitespace-nowrap"
            >
              View
            </button>
          </form>
          {codeError && <p className="text-xs text-rose-500 mt-2 text-center">{codeError}</p>}
        </div>
      </motion.div>

      <FloatingElements activeIndex={activeIndex} />
      
    </main>
  );
}

export default Hero;
