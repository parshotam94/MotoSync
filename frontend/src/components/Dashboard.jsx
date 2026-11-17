import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Dashboard = ({ userId, username, onJoinTrip, onLogout, globalSocket }) => {
  const [tripId, setTripId] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showInvitesDropdown, setShowInvitesDropdown] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');

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
  useEffect(() => {
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
    
    fetchRequests();
    fetchHistory();
    const interval = setInterval(() => {
      fetchRequests();
    }, 8000);
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
      onJoinTrip(data.trip_id); // Route to map
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

  const resolveInvite = (requestId, action) => {
    if (globalSocket) {
      globalSocket.emit('resolve_invite', {
        request_id: requestId,
        action: action,
        user_id: userId
      });
    }
    // Remove from UI immediately
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

  return (
    <div className="min-h-screen w-full bg-[#000000] text-white p-4 md:p-8 overflow-y-auto font-sans relative">
      
      {/* Ambient background glows — mono aqua */}
      <div className="fixed top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.05)_0%,transparent_70%)] blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)] blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER BAR */}
        <header className="glass-panel p-6 rounded-3xl border border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shadow-[0_0_18px_rgba(0,229,255,0.4)] border border-[#00e5ff]/30">
              <span className="text-2xl">🏍️</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  Rider <span className="text-[#00e5ff]">Dashboard</span>
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/60 border border-white/10">
                  Active Session
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/40 mt-0.5">
                Logged in as <span className="font-mono text-[#00e5ff] font-bold">{username}</span> (ID: #{userId})
              </p>
              <div className="mt-2 flex items-center space-x-4 text-xs">
                <button onClick={() => setShowSettings(true)} className="text-[#00e5ff] hover:text-white font-semibold underline">
                  Account Settings
                </button>
                <span className="text-white/20">•</span>
                <button onClick={onLogout} className="text-red-400 hover:text-red-300 font-semibold underline">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
          
          {/* Inbox / Invites Dropdown Pill */}
          <div className="relative self-end sm:self-auto">
            <button 
              onClick={() => setShowInvitesDropdown(!showInvitesDropdown)}
              className="glass-card hover:bg-white/8 px-4 py-2.5 rounded-2xl flex items-center space-x-2.5 transition border border-white/10 shadow-lg"
            >
              <span className="text-base">📬</span>
              <span className="text-sm font-semibold text-white">Ride Invites</span>
              {pendingRequests.length > 0 ? (
                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse shadow-md">
                  {pendingRequests.length}
                </span>
              ) : (
                <span className="text-[11px] text-white/30 font-mono">(0)</span>
              )}
            </button>
            
            {/* Dropdown Menu */}
            {showInvitesDropdown && (
              <div className="absolute right-0 mt-3 w-84 bg-black/95 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.9)] p-4 z-50">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/8">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Pending Convoy Invites</h3>
                  <button onClick={() => setShowInvitesDropdown(false)} className="text-white/30 hover:text-white text-xs font-bold">✕</button>
                </div>
                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-white/30 py-4 text-center">No pending invitations.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {pendingRequests.map(req => (
                      <div key={req.request_id} className="glass-card p-3 rounded-xl border border-white/8 text-xs space-y-2">
                        <p className="text-white/70">
                          <span className="font-bold text-[#00e5ff]">{req.sender_username}</span> invited you to join trip{' '}
                          <span className="font-mono text-white font-bold underline">{req.trip_id}</span>
                        </p>
                        <div className="flex space-x-2 pt-1">
                          <button 
                            onClick={() => resolveInvite(req.request_id, 'accept')}
                            className="flex-1 bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-1.5 rounded-lg transition shadow text-[11px]"
                          >
                            Accept &amp; Enter Map
                          </button>
                          <button 
                            onClick={() => resolveInvite(req.request_id, 'reject')}
                            className="px-3 bg-white/8 hover:bg-white/12 text-white/50 font-semibold py-1.5 rounded-lg transition text-[11px]"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* HOST A NEW RIDE PANEL (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/10 text-[#00e5ff] flex items-center justify-center text-xl border border-[#00e5ff]/20">
                  🗺️
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Host a New Convoy</h2>
                  <p className="text-xs text-white/40">Spawn a real-time room to invite other riders</p>
                </div>
              </div>

              <p className="text-xs text-white/40 leading-relaxed">
                Choose a unique trip room identifier (e.g. <span className="text-[#00e5ff] font-mono">valhalla-tour</span>).
                Once launched, your GPS coordinates stream in real time and you can push instant invites to companions.
              </p>

              <form onSubmit={handleCreateGroup} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
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
              <div className="glass-card p-4 rounded-2xl border border-[#00e5ff]/12 space-y-2 text-xs">
                <div className="font-semibold text-[#00e5ff] flex items-center space-x-1.5">
                  <span>⚡</span>
                  <span>Convoy Telemetry Active</span>
                </div>
                <p className="text-white/40 text-[11px] leading-relaxed">
                  Calculates true geodesic distances with the spherical Haversine formula on client hardware. All location records are cached with Redis in-memory speed.
                </p>
              </div>
            </div>
          </div>

          {/* ANALYTICS & RIDE HISTORY (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-6 rounded-3xl border border-[#00e5ff]/15 shadow-lg relative overflow-hidden glass-card-hover">
                <div className="text-xs font-bold text-[#00e5ff] uppercase tracking-wider">Total Convoys Joined</div>
                <div className="text-4xl font-black text-white font-mono mt-2">{history.length}</div>
                <div className="text-xs text-white/40 mt-1">Lifetime Ride History</div>
                <div className="absolute top-4 right-4 text-4xl opacity-10">🏁</div>
              </div>

              <div className="glass-card p-6 rounded-3xl border border-white/8 shadow-lg relative overflow-hidden glass-card-hover">
                <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Rides This Week</div>
                <div className="text-4xl font-black text-white font-mono mt-2">{getWeeklyRidesCount()}</div>
                <div className="text-xs text-white/40 mt-1">Recent Active Operations</div>
                <div className="absolute top-4 right-4 text-4xl opacity-10">📈</div>
              </div>
            </div>

            {/* Ride History List Panel */}
            <div className="glass-panel rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/8 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Ride History Log</h2>
                  <p className="text-xs text-white/40">Completed expeditions you hosted or rode in</p>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full glass-badge text-[#00e5ff]">
                  {history.length} Completed
                </span>
              </div>

              <div className="flex-1 max-h-[380px] overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-10 text-center text-white/30 text-sm space-y-2">
                    <div className="text-4xl">🏍️</div>
                    <p>No completed rides in your log yet.</p>
                    <p className="text-xs text-white/20">Host a trip room on the left to record your first convoy!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {history.map(trip => (
                      <div key={trip.group_id} className="p-5 hover:bg-white/3 transition space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-base font-bold text-white font-mono flex items-center space-x-2">
                              <span>{trip.trip_id}</span>
                              {trip.creator_username === username && (
                                <span className="text-[10px] bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded-full border border-[#00e5ff]/20">
                                  Host
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-white/40 mt-0.5">
                              Host: <span className={trip.creator_username === username ? "text-[#00e5ff] font-semibold" : "text-white/60"}>
                                {trip.creator_username === username ? "You" : trip.creator_username}
                              </span>
                            </p>
                          </div>
                          <span className="text-[11px] font-mono text-white/30 glass-badge px-2.5 py-1 rounded-lg">
                            {new Date(trip.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Participants list */}
                        <div className="flex flex-wrap gap-1.5 items-center pt-1">
                          <span className="text-[10px] text-white/20 uppercase tracking-wider font-semibold">Convoy:</span>
                          {trip.participants.map(p => (
                            <span key={`${trip.group_id}-${p}`} className="text-[11px] font-mono bg-white/5 text-white/50 px-2 py-0.5 rounded-md border border-white/8">
                              {p}
                            </span>
                          ))}
                          {trip.participants.length === 0 && <span className="text-xs italic text-white/20">Solo Ride</span>}
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-black/95 max-w-md w-full p-6 sm:p-8 rounded-3xl border border-white/12 shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-white/30 hover:text-white text-lg">✕</button>
            <h2 className="text-2xl font-black mb-1 text-white">Profile <span className="text-[#00e5ff]">Settings</span></h2>
            <p className="text-xs text-white/40 mb-6">Modify your rider handle or security credentials</p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Username</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">New Password (Optional, Min 4)</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-3 rounded-xl transition shadow-lg text-sm">
                Save Changes
              </button>
            </form>
            
            <hr className="border-white/8 my-6" />
            
            <div className="border border-red-500/25 bg-red-950/20 rounded-2xl p-4 text-xs space-y-3">
              <h3 className="text-red-400 font-bold uppercase tracking-wider">Danger Zone</h3>
              <p className="text-white/40">Deleting your account permanently purges all profile records and historical rides you created.</p>
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
