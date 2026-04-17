import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-6 px-4 z-10">
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-2 gap-1 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
          <div className="w-2.5 h-2.5 rounded-full bg-brandBlue"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-800"></div>
        </div>
        <span className="font-semibold text-xl tracking-tight text-gray-900">MedCare</span>
      </div>

      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
        <a href="#" className="hover:text-gray-900 transition-colors">Features</a>
        <a href="#" className="hover:text-gray-900 transition-colors">Solutions</a>
        <a href="#" className="hover:text-gray-900 transition-colors">Resources</a>
        <a href="#" className="hover:text-gray-900 transition-colors">Pricing</a>
      </nav>

      <div className="flex items-center gap-4">
        <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 hidden sm:block">Sign in</Link>
        <Link to="/signup" className="text-sm font-medium border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors text-gray-900 shadow-sm bg-white">Get Started</Link>
      </div>
    </header>
  );
}

export default Navbar;
