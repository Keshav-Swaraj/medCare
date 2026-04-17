import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';

function Landing() {
  return (
    <div className="min-h-screen w-full bg-dotted relative overflow-hidden flex flex-col items-center">
      <Navbar />
      <Hero />
    </div>
  );
}

export default Landing;
