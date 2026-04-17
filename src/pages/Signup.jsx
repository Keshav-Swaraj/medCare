import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock } from 'lucide-react';

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Typically Supabase requires email verification, but for this hackathon/flow
      // we assume we can proceed to upload or they are auto-logged in.
      navigate('/upload');
    }
  };

  return (
    <div className="min-h-screen w-full bg-dotted relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-gray-100 max-w-md w-full relative z-10">
        
        {/* Logo Mock */}
        <div className="flex justify-center mb-6">
          <div className="grid grid-cols-2 gap-1 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            <div className="w-3 h-3 rounded-full bg-brandBlue"></div>
            <div className="w-3 h-3 rounded-full bg-gray-800"></div>
            <div className="w-3 h-3 rounded-full bg-gray-800"></div>
            <div className="w-3 h-3 rounded-full bg-gray-800"></div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-center text-gray-900 mb-2">Create an account</h2>
        <p className="text-center text-gray-500 text-sm mb-8 font-medium">Start your 30-day health journey today.</p>

        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-xl mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brandBlue/20 focus:border-brandBlue transition-all text-gray-900"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brandBlue/20 focus:border-brandBlue transition-all text-gray-900"
                placeholder="Create a password"
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brandBlue hover:bg-blue-600 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 flex justify-center items-center mt-2 disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8 font-medium">
          Already have an account? <Link to="/login" className="text-brandBlue hover:text-blue-700 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
