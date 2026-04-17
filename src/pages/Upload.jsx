import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function Upload() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-dotted relative overflow-hidden flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-gray-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brandBlue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Upload Prescription</h2>
        <p className="text-gray-500 mb-8">You have successfully signed in. Upload your prescription to activate the MedCare Agent.</p>
        <button 
          onClick={handleSignOut}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-2.5 rounded-xl transition-colors w-full"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default Upload;
