import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Auth = ({ onLoginSuccess, initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsLogin(initialMode === 'login');
    setError(null);
  }, [initialMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!isLogin) {
      if (password.length < 4) {
        setError("Password must be at least 4 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/login' : '/api/register';
    const payload = { username: username.trim(), password };
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        onLoginSuccess(data.user_id, data.username);
      } else {
        setError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setError('Cannot connect to MotoSync backend server. Is it running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="w-full">
      <div className="glass-card bg-black/90 dark:bg-black/90 light:bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-white/12 dark:border-white/12 light:border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.8)] font-sans relative overflow-hidden">
        
        {/* Subtle aqua corner glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#00e5ff]/8 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-[#00e5ff]/5 blur-2xl pointer-events-none" />

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-black dark:bg-black light:bg-slate-100 items-center justify-center shadow-[0_0_18px_rgba(0,229,255,0.4)] border border-[#00e5ff]/30 mb-3">
            <span className="text-2xl">🏍️</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Moto<span className="text-[#00e5ff] text-glow-cyan">Sync</span> Portal
          </h2>
          <p className="text-xs sm:text-sm opacity-50 mt-1">
            {isLogin ? 'Sign in to access your live convoy & telemetry' : 'Create a rider account to start hosting convoys'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-black/60 dark:bg-black/60 light:bg-slate-100 p-1.5 rounded-2xl border border-white/8 dark:border-white/8 light:border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              isLogin
                ? 'bg-[#00e5ff] text-black shadow-md'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              !isLogin
                ? 'bg-[#00e5ff] text-black shadow-md'
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="glass-card bg-red-950/60 border border-red-500/40 text-red-200 px-4 py-3 rounded-2xl mb-5 text-xs flex items-center space-x-2 shadow-inner">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Rider Handle / Username
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none transition"
              placeholder="e.g. Maverick_Rider"
              required
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Password {isLogin ? '' : '(Min 4 chars)'}
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none transition"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none transition"
                placeholder="Repeat your password"
                required
                disabled={loading}
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-3.5 px-4 rounded-xl shadow-[0_0_22px_rgba(0,229,255,0.35)] transition transform hover:-translate-y-0.5 border border-[#00e5ff]/30 mt-2 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin mr-2">🔄</span>
            ) : null}
            <span>{isLogin ? 'Enter Convoy Portal' : 'Create Free Rider Account'}</span>
            <span>→</span>
          </button>
        </form>

        <div className="mt-5 text-center">
          <button 
            type="button"
            onClick={toggleMode}
            className="text-xs text-white/30 hover:text-[#00e5ff] transition underline"
          >
            {isLogin ? "Need a new account? Register here" : "Already registered? Sign in instead"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Auth;
