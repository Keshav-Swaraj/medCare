import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Calendar, Activity, ChevronRight, ChevronLeft } from 'lucide-react';

function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 State
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      setError('Please provide a valid email and a password of at least 6 characters.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!fullName || !age || !gender) {
      setError('Please fill in the required fields (Name, Age, Gender).');
      return;
    }
    
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          age: parseInt(age, 10),
          gender: gender,
          conditions: conditions,
          allergies: allergies
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="min-h-screen w-full bg-dotted relative overflow-hidden flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_50px_rgb(0,0,0,0.06)] border border-gray-100 max-w-md w-full relative z-10 transition-all">
        
        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-sky-500' : 'bg-gray-100'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-sky-500' : 'bg-gray-100'}`} />
        </div>

        <h2 className="text-2xl font-semibold text-center text-gray-900 mb-2">
          {step === 1 ? 'Create an account' : 'Tell us about yourself'}
        </h2>
        <p className="text-center text-gray-500 text-sm mb-8 font-medium">
          {step === 1 ? 'Start your 30-day health journey today.' : 'This helps MedCare Agent personalize your advice.'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-xl mb-6 border border-red-100 animate-in fade-in">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-5 animate-in slide-in-from-left-4 duration-300">
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
                  placeholder="Create a password"
                  minLength={6}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 flex justify-center items-center mt-4 gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Age</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input 
                    type="number" 
                    required
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
                    placeholder="e.g. 45"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Gender</label>
                <select 
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
                >
                  <option value="" disabled>Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Pre-existing Conditions <span className="text-gray-400 font-normal">(Optional)</span></label>
              <div className="relative">
                <div className="absolute top-3 left-3 flex items-center pointer-events-none text-gray-400">
                  <Activity className="w-4 h-4" />
                </div>
                <textarea 
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900 min-h-[80px]"
                  placeholder="e.g. Hypertension, Type 2 Diabetes"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Allergies <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input 
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-gray-900"
                placeholder="e.g. Penicillin, Peanuts"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="w-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95 flex justify-center items-center disabled:opacity-70 disabled:hover:scale-100"
              >
                {loading ? 'Creating account...' : 'Complete Sign Up'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-8 font-medium">
          Already have an account? <Link to="/login" className="text-sky-500 hover:text-blue-700 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
