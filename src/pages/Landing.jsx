import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';

function Landing() {
  const [activeIndex, setActiveIndex] = useState(0);
  const totalStages = 6; // 0, 1, 2, 3, 4, 5, 6 (7 total states)
  const isCoolingDown = useRef(false); // hard lock: blocks ALL events during cooldown

  useEffect(() => {
    const COOLDOWN_MS = 800; // time to lock after one step fires

    const handleWheel = (e) => {
      e.preventDefault();
      if (isCoolingDown.current) return; // hard block — one scroll, one step

      const direction = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
      if (direction === 0) return;

      isCoolingDown.current = true;

      setActiveIndex(prev => {
        const next = prev + direction;
        return Math.max(0, Math.min(next, totalStages));
      });

      setTimeout(() => {
        isCoolingDown.current = false;
      }, COOLDOWN_MS);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="h-screen w-full relative overflow-hidden bg-dotted flex flex-col items-center">
      <Navbar />
      <Hero activeIndex={activeIndex} />
      
      {/* Custom Right-Side Scrollbar Indicator */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-50 hidden md:flex">
        <div className="w-1.5 h-40 bg-gray-200/50 rounded-full relative overflow-hidden backdrop-blur-sm shadow-inner">
           <motion.div 
             className="absolute top-0 left-0 w-full bg-brandBlue rounded-full shadow-sm"
             initial={false}
             animate={{ 
               height: `${100 / (totalStages + 1)}%`,
               y: `${activeIndex * 100}%`
             }}
             transition={{ type: "spring", stiffness: 300, damping: 25 }}
           />
        </div>
      </div>
      
    </div>
  );
}

export default Landing;
