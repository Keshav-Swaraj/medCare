import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import FloatingElements from './FloatingElements';

function Hero({ activeIndex }) {
  return (
    <main className="flex-1 w-full flex flex-col items-center justify-center relative pt-20 pb-32 px-4 z-10">
      
      {/* Central Floating Icon */}
      <div className="mb-8 z-20 group">
        <div className="grid grid-cols-2 gap-1.5 bg-white p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transform -rotate-3 transition-all duration-500 group-hover:rotate-[177deg] group-hover:scale-110">
          <div className="w-4 h-4 rounded-full bg-brandBlue transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800 transition-transform duration-300 group-hover:scale-110"></div>
        </div>
      </div>

      <h1 className="relative z-30 text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-center max-w-4xl leading-[1.1] mb-6">
        <span className="text-gray-900">Your autonomous health companion</span><br className="hidden sm:block" />
        <span className="text-gray-400">after every doctor visit.</span>
      </h1>
      
      <p className="relative z-30 text-lg md:text-xl text-gray-500 text-center max-w-3xl mb-10 font-medium">
        Understand your prescription, scans, and reports in simple words. Get a clear medicine schedule, smart reminders, progress tracking, plain-language explanations, and AI support.
      </p>
      
      <motion.div
        initial={false}
        animate={{
          scale: activeIndex === 5 ? 1.4 : 1,
          zIndex: activeIndex === 5 ? 50 : 30,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-30"
      >
        <Link to="/signup" className="inline-block bg-brandBlue hover:bg-blue-600 text-white font-medium px-8 py-3.5 rounded-xl text-base shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95">
          Get Started
        </Link>
      </motion.div>

      <FloatingElements activeIndex={activeIndex} />
      
    </main>
  );
}

export default Hero;
