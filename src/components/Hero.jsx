import React from 'react';
import { Link } from 'react-router-dom';
import FloatingElements from './FloatingElements';

function Hero() {
  return (
    <main className="flex-1 w-full flex flex-col items-center justify-center relative pt-20 pb-32 px-4 z-10">
      
      {/* Central Floating Icon */}
      <div className="mb-8 z-20">
        <div className="grid grid-cols-2 gap-1.5 bg-white p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
          <div className="w-4 h-4 rounded-full bg-brandBlue"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800"></div>
          <div className="w-4 h-4 rounded-full bg-gray-800"></div>
        </div>
      </div>

      <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-center max-w-4xl leading-[1.1] z-20 mb-6">
        <span className="text-gray-900">Turn any prescription</span><br className="hidden sm:block" />
        <span className="text-gray-400">into a 30-day health journey</span>
      </h1>
      
      <p className="text-lg md:text-xl text-gray-500 text-center max-w-2xl z-20 mb-10 font-medium">
        Upload your prescription, let the AI extract your medicines, and activate a personalized 30-day adherence dashboard.
      </p>
      
      <Link to="/signup" className="bg-brandBlue hover:bg-blue-600 text-white font-medium px-8 py-3.5 rounded-xl text-base shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 z-20">
        Get Started
      </Link>

      <FloatingElements />
      
    </main>
  );
}

export default Hero;
