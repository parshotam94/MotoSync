import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Dashboard = ({ userId, username, onJoinTrip, onLogout, globalSocket, theme = 'dark', onToggleTheme }) => {
  const [tripId, setTripId] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvitesDropdown, setShowInvitesDropdown] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  // Create your own group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const cleanTripId = tripId.trim();
    if (!cleanTripId) return;
    
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: cleanTripId, creator_id: userId })
      });
      const data = await res.json();
      
      if (res.ok) {
        onJoinTrip(cleanTripId);
      } else {
        alert(data.error || "Failed to create group. Trip ID might already exist.");
      }
    } catch (err) {
      alert("Failed to create group. Please check backend connection.");
    }
  };

  // Fetch API Logic
  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/requests?user_id=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setPendingRequests(data);
    } catch (err) {}
  };
  
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/history/${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchRequests();
    fetchHistory();
    const interval = setInterval(() => {
      fetchRequests();
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  // Listen for realtime push invite
  useEffect(() => {
    if (!globalSocket) return;

    const handleReceiveInvite = (data) => {
      setPendingRequests(prev => {
        if (prev.some(r => r.request_id === data.request_id)) return prev;
        return [...prev, data];
      });
      setShowInvitesDropdown(true);
    };

    globalSocket.on('receive_invite', handleReceiveInvite);

    globalSocket.on('invite_cancelled', (data) => {
      setPendingRequests(prev => prev.filter(r => r.request_id !== data.request_id));
    });

    globalSocket.on('invite_accepted', (data) => {
      if (data && data.trip_id) {
        onJoinTrip(data.trip_id); // Route to map
      }
    });

    globalSocket.on('invite_error', (data) => alert(data.message));
    globalSocket.on('invite_success', (data) => alert(data.message));

    return () => {
      globalSocket.off('receive_invite', handleReceiveInvite);
      globalSocket.off('invite_cancelled');
      globalSocket.off('invite_accepted');
      globalSocket.off('invite_error');
      globalSocket.off('invite_success');
    };
  }, [globalSocket, onJoinTrip]);

  // Reliable Dual-Path Invite Resolution (WebSocket + REST Fallback)
  const resolveInvite = async (requestId, action, tripIdTarget) => {
    setResolvingId(requestId);

    // 1. Send via WebSocket if socket is connected
    if (globalSocket) {
      globalSocket.emit('resolve_invite', {
        request_id: requestId,
        action: action,
        user_id: userId
      });
    }

    // 2. Guaranteed REST call
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: userId })
      });
      const data = await res.json();

      if (action === 'accept') {
        const destTrip = data.trip_id || tripIdTarget;
        if (destTrip) {
          onJoinTrip(destTrip);
          return;
        }
      }
    } catch (err) {
      console.warn("REST resolution note:", err);
      if (action === 'accept' && tripIdTarget) {
        onJoinTrip(tripIdTarget);
        return;
      }
    } finally {
      setResolvingId(null);
    }

    // Remove from local UI immediately
    setPendingRequests(prev => prev.filter(r => r.request_id !== requestId));
  };
  
  // Profile Handlers
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Profile updated successfully!");
        try {
          localStorage.setItem('motosync_user', JSON.stringify({ id: userId, username: newUsername }));
        } catch (e) {}
        setShowSettings(false);
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Error connecting to server");
    }
  };

  const handleDeleteProfile = async () => {
    if (!window.confirm("Are you SURE you want to delete your account? All trips and history will be permanently deleted.")) return;
    try {
      await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
      onLogout();
    } catch (err) {}
  };
  
  const getWeeklyRidesCount = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return history.filter(h => new Date(h.created_at) >= oneWeekAgo).length;
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen w-full p-3 sm:p-6 md:p-8 overflow-y-auto font-sans relative ${isLight ? 'light-theme bg-[#f8fafc] text-slate-900' : 'bg-[#000000] text-white'}`}>
      
      {/* Ambient background glows */}
      <div className={`fixed top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] pointer-events-none -z-10 ${isLight ? 'bg-cyan-500/10' : 'bg-[radial-gradient(circle,rgba(0,229,255,0.05)_0%,transparent_70%)]'}`} />
      <div className={`fixed bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] pointer-events-none -z-10 ${isLight ? 'bg-slate-300/40' : 'bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)]'}`} />

      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8">
        
        {/* HEADER BAR */}
        <header className="glass-panel relative z-40 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-[0_0_18px_rgba(0,229,255,0.4)] border border-[#00e5ff]/30 ${isLight ? 'bg-white' : 'bg-black'}`}>
              <span className="text-xl sm:text-2xl">🏍️</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-3xl font-black">
                  Rider <span className="text-[#00e5ff]">Dashboard</span>
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/25">
                  Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/50 dark:text-white/50 light:text-slate-500 mt-0.5">
                Logged in as <span className="font-mono text-[#00e5ff] font-bold">{username}</span> (ID: #{userId})
              </p>
              <div className="mt-1.5 flex items-center space-x-3 text-xs">
                <button onClick={() => setShowSettings(true)} className="text-[#00e5ff] hover:underline font-semibold">
                  Settings
                </button>
                <span className="opacity-30">•</span>
                <button onClick={onLogout} className="text-red-400 hover:text-red-300 font-semibold underline">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
          
          {/* Header Action Controls */}
          <div className="flex items-center space-x-2.5 self-end sm:self-auto">
            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
                className="glass-card hover:bg-[#00e5ff]/10 px-3 py-2 rounded-2xl flex items-center space-x-1.5 transition border border-white/10 dark:border-white/10 light:border-black/10 text-xs font-semibold"
              >
                <span>{isLight ? '🌙' : '☀️'}</span>
                <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
              </button>
            )}

            {/* Inbox / Invites Dropdown Pill */}
            <div className="relative">
              <button 
                onClick={() => setShowInvitesDropdown(!showInvitesDropdown)}
                className={`glass-card px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl flex items-center space-x-2 transition border border-white/10 dark:border-white/10 light:border-black/10 shadow-lg ${pendingRequests.length > 0 ? 'border-[#00e5ff]/50 bg-[#00e5ff]/10' : ''}`}
              >
                <span className="text-sm sm:text-base">📬</span>
                <span className="text-xs sm:text-sm font-semibold">Ride Invites</span>
                {pendingRequests.length > 0 ? (
                  <span className="bg-red-500 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-md">
                    {pendingRequests.length}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-40 font-mono">(0)</span>
                )}
              </button>
              
              {/* Dropdown Menu */}
              {showInvitesDropdown && (
                <>
                  {/* Click-away backdrop */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowInvitesDropdown(false)} 
                  />
                  <div className={`absolute right-0 mt-3 w-80 sm:w-96 max-w-[92vw] backdrop-blur-3xl border rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] p-4 z-50 ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f1117] border-white/20 text-white'}`}>
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10 light:border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">📬</span>
                        <h3 className="text-xs font-bold uppercase tracking-wider">Ride Invites</h3>
                        {pendingRequests.length > 0 && (
                          <span className="bg-[#00e5ff]/20 text-[#00e5ff] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#00e5ff]/30">
                            {pendingRequests.length}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => setShowInvitesDropdown(false)} 
                        className="opacity-50 hover:opacity-100 text-xs font-bold p-1 rounded hover:bg-white/10"
                      >
                        ✕
                      </button>
                    </div>

                    {pendingRequests.length === 0 ? (
                      <div className="py-6 text-center space-y-1">
                        <p className="text-xs opacity-50">No pending invitations.</p>
                        <p className="text-[11px] opacity-30">When friends invite you, they will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {pendingRequests.map(req => (
                          <div 
                            key={req.request_id} 
                            className={`p-3 rounded-xl border text-xs space-y-2.5 shadow-md ${
                              isLight 
                                ? 'bg-slate-50 border-slate-200' 
                                : 'bg-black/80 border-white/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="opacity-90">
                                  <span className="font-bold text-[#00e5ff]">{req.sender_username}</span> invited you to join:
                                </p>
                                <span className="font-mono font-bold text-xs bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded border border-[#00e5ff]/25 inline-block mt-1">
                                  {req.trip_id}
                                </span>
                              </div>
                            </div>
                            <div className="flex space-x-2 pt-1">
                              <button 
                                onClick={() => resolveInvite(req.request_id, 'accept', req.trip_id)}
                                disabled={resolvingId === req.request_id}
                                className="flex-1 bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-2 rounded-lg transition shadow text-xs flex items-center justify-center space-x-1 disabled:opacity-50"
                              >
                                <span>{resolvingId === req.request_id ? 'Joining...' : 'Accept & Enter Map'}</span>
                                <span>→</span>
                              </button>
                              <button 
                                onClick={() => resolveInvite(req.request_id, 'reject', req.trip_id)}
                                disabled={resolvingId === req.request_id}
                                className="px-3 border border-white/15 light:border-slate-300 opacity-60 hover:opacity-100 hover:text-red-400 font-semibold py-2 rounded-lg transition text-xs"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* PROMINENT PENDING RIDE REQUESTS BANNER (Shown whenever there are invites) */}
        {pendingRequests.length > 0 && (
          <div className="glass-card p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#00e5ff]/40 bg-[#00e5ff]/5 shadow-xl space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl animate-bounce">📬</span>
                <h3 className="text-sm sm:text-base font-bold">
                  Pending Convoy Invitations ({pendingRequests.length})
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingRequests.map(req => (
                <div key={`banner-${req.request_id}`} className="glass-card p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-slate-200 flex flex-col justify-between gap-3 shadow-sm">
                  <div>
                    <p className="text-xs sm:text-sm">
                      <span className="font-bold text-[#00e5ff]">{req.sender_username}</span> invited you to join:
                    </p>
                    <div className="text-sm font-mono font-bold mt-1 px-2.5 py-1 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/25 inline-block">
                      {req.trip_id}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => resolveInvite(req.request_id, 'accept', req.trip_id)}
                      disabled={resolvingId === req.request_id}
                      className="flex-1 bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-2 px-3 rounded-lg transition shadow text-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <span>{resolvingId === req.request_id ? 'Joining...' : 'Accept & Enter Map'}</span>
                      <span>→</span>
                    </button>
                    <button
                      onClick={() => resolveInvite(req.request_id, 'reject', req.trip_id)}
                      disabled={resolvingId === req.request_id}
                      className="px-3 border border-white/15 dark:border-white/15 light:border-slate-300 opacity-70 hover:opacity-100 hover:text-red-400 font-semibold py-2 rounded-lg transition text-xs"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
          
          {/* HOST A NEW RIDE PANEL (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="glass-panel p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 shadow-2xl space-y-4 sm:space-y-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/10 text-[#00e5ff] flex items-center justify-center text-xl border border-[#00e5ff]/20">
                  🗺️
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Host a New Convoy</h2>
                  <p className="text-xs opacity-60">Spawn a real-time room to invite other riders</p>
                </div>
              </div>

              <p className="text-xs opacity-60 leading-relaxed">
                Choose a unique trip room identifier (e.g. <span className="text-[#00e5ff] font-mono">valhalla-tour</span>).
                Once launched, your GPS coordinates stream in real time and you can push instant invites to companions.
              </p>

              <form onSubmit={handleCreateGroup} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold opacity-70 uppercase tracking-wider mb-1.5">
                    Unique Trip ID / Room Name
                  </label>
                  <input 
                    type="text" 
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                    className="w-full glass-input px-4 py-3 rounded-xl text-sm focus:outline-none transition font-mono"
                    placeholder="e.g. ladakh-expedition-2026"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-3.5 px-4 rounded-xl shadow-[0_0_22px_rgba(0,229,255,0.35)] transition transform hover:-translate-y-0.5 border border-[#00e5ff]/30 flex items-center justify-center space-x-2 text-sm"
                >
                  <span>Launch Live Cockpit</span>
                  <span>→</span>
                </button>
              </form>

              {/* Quick Info Feature Box */}
              <div className="glass-card p-4 rounded-2xl border border-[#00e5ff]/15 space-y-2 text-xs">
                <div className="font-semibold text-[#00e5ff] flex items-center space-x-1.5">
                  <span>⚡</span>
                  <span>Convoy Telemetry Active</span>
                </div>
                <p className="opacity-60 text-[11px] leading-relaxed">
                  Calculates true geodesic distances with the spherical Haversine formula on client hardware. All location records are cached with Redis in-memory speed.
                </p>
              </div>
            </div>
          </div>

          {/* ANALYTICS & RIDE HISTORY (7 Cols) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#00e5ff]/15 shadow-lg relative overflow-hidden glass-card-hover">
                <div className="text-[10px] sm:text-xs font-bold text-[#00e5ff] uppercase tracking-wider">Total Convoys Joined</div>
                <div className="text-3xl sm:text-4xl font-black font-mono mt-1 sm:mt-2">{history.length}</div>
                <div className="text-[10px] sm:text-xs opacity-50 mt-1">Lifetime Ride History</div>
                <div className="absolute top-3 right-3 text-3xl opacity-10">🏁</div>
              </div>

              <div className="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/8 dark:border-white/8 light:border-black/10 shadow-lg relative overflow-hidden glass-card-hover">
                <div className="text-[10px] sm:text-xs font-bold opacity-60 uppercase tracking-wider">Rides This Week</div>
                <div className="text-3xl sm:text-4xl font-black font-mono mt-1 sm:mt-2">{getWeeklyRidesCount()}</div>
                <div className="text-[10px] sm:text-xs opacity-50 mt-1">Recent Active Operations</div>
                <div className="absolute top-3 right-3 text-3xl opacity-10">📈</div>
              </div>
            </div>

            {/* Ride History List Panel */}
            <div className="glass-panel rounded-2xl sm:rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 shadow-xl overflow-hidden flex flex-col">
              <div className="p-4 sm:p-6 border-b border-white/8 dark:border-white/8 light:border-black/10 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold">Ride History Log</h2>
                  <p className="text-xs opacity-50">Completed expeditions you hosted or rode in</p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full glass-badge text-[#00e5ff]">
                  {history.length} Done
                </span>
              </div>

              <div className="flex-1 max-h-[380px] overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-8 sm:p-10 text-center opacity-40 text-sm space-y-2">
                    <div className="text-3xl sm:text-4xl">🏍️</div>
                    <p>No completed rides in your log yet.</p>
                    <p className="text-xs opacity-60">Host a trip room on the left to record your first convoy!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 dark:divide-white/5 light:divide-slate-200">
                    {history.map(trip => (
                      <div key={trip.group_id} className="p-4 sm:p-5 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 transition space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm sm:text-base font-bold font-mono flex items-center space-x-2">
                              <span>{trip.trip_id}</span>
                              {trip.creator_username === username && (
                                <span className="text-[10px] bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded-full border border-[#00e5ff]/20">
                                  Host
                                </span>
                              )}
                            </h4>
                            <p className="text-xs opacity-60 mt-0.5">
                              Host: <span className={trip.creator_username === username ? "text-[#00e5ff] font-semibold" : "opacity-80"}>
                                {trip.creator_username === username ? "You" : trip.creator_username}
                              </span>
                            </p>
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-mono opacity-50 glass-badge px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">
                            {new Date(trip.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Participants list */}
                        <div className="flex flex-wrap gap-1.5 items-center pt-1">
                          <span className="text-[10px] opacity-40 uppercase tracking-wider font-semibold">Convoy:</span>
                          {trip.participants.map(p => (
                            <span key={`${trip.group_id}-${p}`} className="text-[11px] font-mono bg-white/5 dark:bg-white/5 light:bg-slate-200 opacity-80 px-2 py-0.5 rounded-md border border-white/8 dark:border-white/8 light:border-slate-300">
                              {p}
                            </span>
                          ))}
                          {trip.participants.length === 0 && <span className="text-xs italic opacity-40">Solo Ride</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className={`glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border shadow-2xl relative ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/95 border-white/12 text-white'}`}>
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 opacity-40 hover:opacity-100 text-lg">✕</button>
            <h2 className="text-2xl font-black mb-1">Profile <span className="text-[#00e5ff]">Settings</span></h2>
            <p className="text-xs opacity-50 mb-6">Modify your rider handle or security credentials</p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">Username</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">New Password (Optional, Min 4)</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-3 rounded-xl transition shadow-lg text-sm">
                Save Changes
              </button>
            </form>
            
            <hr className="border-white/10 dark:border-white/10 light:border-slate-200 my-6" />
            
            <div className="border border-red-500/25 bg-red-950/20 rounded-2xl p-4 text-xs space-y-3">
              <h3 className="text-red-400 font-bold uppercase tracking-wider">Danger Zone</h3>
              <p className="opacity-60">Deleting your account permanently purges all profile records and historical rides you created.</p>
              <button onClick={handleDeleteProfile} className="w-full bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white py-2 rounded-xl font-bold transition">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
