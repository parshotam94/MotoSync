import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Auth from './Auth';

// Self-contained high-contrast SVG divIcons (No external PNG dependency that can fail)
const selfIcon = L.divIcon({
  className: 'motosync-self-marker',
  html: `
    <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(0, 229, 255, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 22px; height: 22px; border-radius: 50%; background: #00e5ff; border: 2.5px solid #000000; box-shadow: 0 0 14px rgba(0,229,255,0.9); display: flex; align-items: center; justify-content: center; font-size: 11px;">
        🏍️
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18]
});

const friendIcon = L.divIcon({
  className: 'motosync-friend-marker',
  html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
      <div style="width: 18px; height: 18px; border-radius: 50%; background: #ff4444; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(255,68,68,0.8); display: flex; align-items: center; justify-content: center; font-size: 9px;">
        🔴
      </div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -16]
});

// Map resize and recentering controller component
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (center && center[0] && center[1]) {
      map.setView(center, 13);
    }
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

const PRESET_ROUTES = {
  ladakh: {
    name: "Ladakh Mountain Pass",
    region: "Himalayas, India",
    center: [34.1526, 77.5771],
    riders: [
      { id: "You", username: "Convoy_Host (You)", role: "Host", lat: 34.1526, lng: 77.5771, speed: 58.4, offsetLat: 0, offsetLng: 0 },
      { id: "r1", username: "Tanushk_Lead", role: "Pacesetter", lat: 34.1612, lng: 77.5855, speed: 64.0, offsetLat: 0.0086, offsetLng: 0.0084 },
      { id: "r2", username: "Jatin_Cruiser", role: "Rider", lat: 34.1450, lng: 77.5680, speed: 56.8, offsetLat: -0.0076, offsetLng: -0.0091 },
      { id: "r3", username: "Hariom_Sweep", role: "Convoy Tail", lat: 34.1380, lng: 77.5590, speed: 52.0, offsetLat: -0.0146, offsetLng: -0.0181 }
    ]
  },
  goa: {
    name: "Goa Coastal Highway",
    region: "Konkan Coast",
    center: [15.2993, 74.1240],
    riders: [
      { id: "You", username: "Convoy_Host (You)", role: "Host", lat: 15.2993, lng: 74.1240, speed: 72.0, offsetLat: 0, offsetLng: 0 },
      { id: "r1", username: "Divija_Rider", role: "Navigator", lat: 15.3080, lng: 74.1320, speed: 75.5, offsetLat: 0.0087, offsetLng: 0.0080 },
      { id: "r2", username: "Priyanshi_Scout", role: "Rider", lat: 15.2910, lng: 74.1160, speed: 70.2, offsetLat: -0.0083, offsetLng: -0.0080 },
      { id: "r3", username: "Rider_Echo", role: "Convoy Tail", lat: 15.2830, lng: 74.1080, speed: 68.0, offsetLat: -0.0163, offsetLng: -0.0160 }
    ]
  },
  jaipur: {
    name: "Jaipur Highway Expressway",
    region: "Rajasthan Express Corridor",
    center: [26.9124, 75.7873],
    riders: [
      { id: "You", username: "Convoy_Host (You)", role: "Host", lat: 26.9124, lng: 75.7873, speed: 82.5, offsetLat: 0, offsetLng: 0 },
      { id: "r1", username: "Alpha_Leader", role: "Pacesetter", lat: 26.9210, lng: 75.7960, speed: 85.0, offsetLat: 0.0086, offsetLng: 0.0087 },
      { id: "r2", username: "Bravo_Rider", role: "Rider", lat: 26.9040, lng: 75.7790, speed: 80.0, offsetLat: -0.0084, offsetLng: -0.0083 },
      { id: "r3", username: "Charlie_Sweep", role: "Convoy Tail", lat: 26.8960, lng: 75.7710, speed: 76.4, offsetLat: -0.0164, offsetLng: -0.0163 }
    ]
  }
};

const PublicInteractiveDashboard = ({ onLoginSuccess, onStartDemoRide, theme = 'dark', onToggleTheme }) => {
  const [selectedRouteKey, setSelectedRouteKey] = useState('ladakh');
  const [simulatedSpeed, setSimulatedSpeed] = useState(65);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [sosDemoActive, setSosDemoActive] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  // Animation ticker for simulated movements
  const [tick, setTick] = useState(0);
  const mapRef = useRef();

  const currentRoute = PRESET_ROUTES[selectedRouteKey];

  // Spherical Haversine calculation
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's mean radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return (R * c).toFixed(2);
  };

  // Subtle real-time simulation movement loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Compute live simulated coordinates for each rider
  const simulatedRiders = currentRoute.riders.map((r, index) => {
    const drift = Math.sin((tick + index * 2) * 0.4) * 0.0003;
    const speedVariation = (Math.sin((tick + index) * 0.5) * 3).toFixed(1);
    const speed = Math.max(20, Math.round(simulatedSpeed + parseFloat(speedVariation)));
    return {
      ...r,
      lat: r.lat + drift,
      lng: r.lng + drift * 0.8,
      speed: index === 0 ? simulatedSpeed : speed
    };
  });

  const hostRider = simulatedRiders[0];
  const friendRiders = simulatedRiders.slice(1);

  // Auto center map when route changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(currentRoute.center, 13);
    }
    setSelectedFriend(null);
  }, [selectedRouteKey]);

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleTriggerSosDemo = () => {
    setSosDemoActive(true);
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen w-full font-sans relative overflow-x-hidden ${isLight ? 'light-theme bg-[#f8fafc] text-slate-900' : 'bg-[#000000] text-white'}`}>
      
      {/* AMBIENT BACKGROUND GLOW ORBS */}
      <div className={`fixed top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse ${isLight ? 'bg-cyan-500/10' : 'bg-[radial-gradient(circle,rgba(0,229,255,0.07)_0%,transparent_70%)]'}`} />
      <div className={`fixed bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[130px] pointer-events-none -z-10 ${isLight ? 'bg-slate-300/30' : 'bg-[radial-gradient(circle,rgba(0,229,255,0.04)_0%,transparent_70%)]'}`} />
      <div className={`fixed top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[100px] pointer-events-none -z-10 ${isLight ? 'bg-cyan-600/5' : 'bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)]'}`} />

      {/* TOP GLASS NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/8 px-3 sm:px-8 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-xl bg-black flex items-center justify-center shadow-[0_0_18px_rgba(0,229,255,0.4)] border border-[#00e5ff]/30">
            <span className="text-lg sm:text-xl">🏍️</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">
                Moto<span className="text-[#00e5ff] text-glow-cyan">Sync</span>
              </span>
              <span className="hidden xs:inline text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/25 whitespace-nowrap">
                Fleet 2.0
              </span>
            </div>
            <p className="text-[10px] text-white/40 hidden md:block">Real-Time Fleet Telemetry &amp; Ride Synchronization</p>
          </div>
        </div>

        {/* Status Pulse Pill — hidden on small screens */}
        <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-full glass-badge text-xs flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
          <span className="text-[#00e5ff] font-semibold">Convoy Mesh Online</span>
          <span className="text-white/30">•</span>
          <span className="text-white/50 font-mono">1,482 Streams Active</span>
        </div>

        {/* Nav Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {onToggleTheme && (
            <button 
              onClick={onToggleTheme}
              title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
              className="glass-card hover:bg-[#00e5ff]/10 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition border border-white/10 dark:border-white/10 light:border-black/10"
            >
              <span>{isLight ? '🌙' : '☀️'}</span>
              <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
            </button>
          )}

          <button 
            onClick={() => handleOpenAuth('login')}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold opacity-70 hover:opacity-100 hover:bg-white/5 transition border border-transparent hover:border-white/10 whitespace-nowrap"
          >
            Sign In
          </button>
          <button 
            onClick={() => handleOpenAuth('register')}
            className="px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#00e5ff] hover:bg-[#33ecff] text-black shadow-[0_0_22px_rgba(0,229,255,0.35)] transition transform hover:-translate-y-0.5 border border-[#00e5ff]/30 flex items-center space-x-1 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Join Convoy</span>
            <span className="sm:hidden">Join</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative px-4 sm:px-8 pt-8 pb-6 max-w-7xl mx-auto text-center space-y-5">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full glass-badge text-[11px] sm:text-xs text-[#00e5ff] font-medium border border-[#00e5ff]/20">
          <span>⚡</span>
          <span className="hidden sm:inline">Zero HTTP Polling — Pure Full-Duplex WebSocket Engine</span>
          <span className="sm:hidden">Pure WebSocket Engine</span>
        </div>

        <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto text-white px-2">
          Synchronized Convoy Telemetry{' '}
          <span className="text-[#00e5ff] text-glow-cyan">
            At Highway Velocity
          </span>
        </h1>

        <p className="text-xs sm:text-base lg:text-lg text-white/50 max-w-3xl mx-auto leading-relaxed px-2">
          Real-time mutual spatial awareness for motorcycle groups. Live GPS coordinate streaming,
          Haversine distance tracking, sub-2ms Redis telemetry, and instant Emergency SOS alerts.
        </p>

        {/* Live KPI Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 max-w-4xl mx-auto pt-1">
          <div className="glass-card p-3 sm:p-4 rounded-2xl text-center glass-card-hover border border-[#00e5ff]/20">
            <div className="text-[10px] sm:text-xs font-semibold text-[#00e5ff] uppercase tracking-wider">WebSocket</div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono mt-1">8.5 ms</div>
            <div className="text-[10px] text-white/40 mt-0.5 hidden sm:block">Peer Distribution</div>
          </div>

          <div className="glass-card p-3 sm:p-4 rounded-2xl text-center glass-card-hover border border-white/10">
            <div className="text-[10px] sm:text-xs font-semibold text-white/70 uppercase tracking-wider">Redis Cache</div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono mt-1">1.2 ms</div>
            <div className="text-[10px] text-white/40 mt-0.5 hidden sm:block">O(1) Memory Writes</div>
          </div>

          <div className="glass-card p-3 sm:p-4 rounded-2xl text-center glass-card-hover border border-white/10">
            <div className="text-[10px] sm:text-xs font-semibold text-white/70 uppercase tracking-wider">Accuracy</div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono mt-1">±10 m</div>
            <div className="text-[10px] text-white/40 mt-0.5 hidden sm:block">Pure Haversine Math</div>
          </div>

          <div className="glass-card p-3 sm:p-4 rounded-2xl text-center glass-card-hover border border-[#00e5ff]/15">
            <div className="text-[10px] sm:text-xs font-semibold text-[#00e5ff]/80 uppercase tracking-wider">Battery</div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono mt-1">+62%</div>
            <div className="text-[10px] text-white/40 mt-0.5 hidden sm:block">Over HTTP Polling</div>
          </div>
        </div>
      </section>

      {/* LIVE INTERACTIVE RADAR PLAYGROUND (BEFORE LOGIN) */}
      <section className="px-3 sm:px-8 pb-12 max-w-7xl mx-auto">
        <div className="glass-panel p-4 sm:p-7 rounded-3xl border border-white/10 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          
          {/* Section Sub-header & Route Selector */}
          <div className="flex flex-col gap-3 pb-4 border-b border-white/8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] animate-pulse flex-shrink-0" />
                  <h2 className="text-base sm:text-2xl font-bold text-white">Live Convoy Radar</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/25 whitespace-nowrap">
                    Interactive Preview
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-1 hidden sm:block">
                  Switch routes, adjust velocity, click riders to draw Haversine distance lines.
                </p>
              </div>

              {/* Route Selector Tabs — scrollable on mobile */}
              <div className="flex items-center space-x-1.5 bg-black/60 p-1 rounded-xl border border-white/8 overflow-x-auto flex-shrink-0 max-w-full">
                {Object.entries(PRESET_ROUTES).map(([key, route]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedRouteKey(key)}
                    className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition whitespace-nowrap ${
                      selectedRouteKey === key
                        ? 'bg-[#00e5ff] text-black shadow-lg'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {route.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN RADAR GRID — stacked on mobile, side-by-side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mt-4 sm:mt-6">
            
            {/* Interactive Sidebar Cockpit — full width on mobile, 4 cols on desktop */}
            <div className="lg:col-span-4 space-y-3 sm:space-y-5">
              
              {/* Telemetry Controller Box */}
              <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Convoy Velocity</span>
                  <span className="text-[11px] font-mono font-bold bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded-md border border-[#00e5ff]/25">
                    {simulatedSpeed} km/h
                  </span>
                </div>

                {/* Speed Slider */}
                <div>
                  <input
                    type="range"
                    min="30"
                    max="130"
                    value={simulatedSpeed}
                    onChange={(e) => setSimulatedSpeed(Number(e.target.value))}
                    className="w-full cursor-pointer h-1.5 rounded-lg appearance-none"
                    style={{ touchAction: 'none' }}
                  />
                  <div className="flex justify-between text-[9px] sm:text-[10px] text-white/30 font-mono mt-1">
                    <span>30 (City)</span>
                    <span>80 (Cruise)</span>
                    <span>130 (Hwy)</span>
                  </div>
                </div>

                {/* Route Meta — compact on mobile */}
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-1 text-[11px]">
                  <div className="flex justify-between text-white/40">
                    <span>Route:</span>
                    <span className="font-semibold text-white text-right truncate max-w-[55%]">{currentRoute.name}</span>
                  </div>
                  <div className="flex justify-between text-white/40">
                    <span>Region:</span>
                    <span className="text-[#00e5ff] text-right truncate max-w-[55%]">{currentRoute.region}</span>
                  </div>
                  <div className="flex justify-between text-white/40">
                    <span>Fleet:</span>
                    <span className="text-white font-bold">4 Riders</span>
                  </div>
                </div>
              </div>

              {/* Convoy Roster — hidden label on mobile, visible on desktop */}
              <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Convoy Roster</h3>
                  <span className="text-[10px] text-white/30">Tap to link</span>
                </div>

                {/* On mobile: horizontal chips. On desktop: vertical list */}
                <div className="lg:hidden flex flex-wrap gap-2">
                  {simulatedRiders.map((rider, idx) => {
                    const isHost = idx === 0;
                    const isSelected = selectedFriend?.id === rider.id;
                    return (
                      <button
                        key={rider.id}
                        onClick={() => { if (!isHost) setSelectedFriend(rider); }}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                          isHost
                            ? 'bg-[#00e5ff]/10 border-[#00e5ff]/25 text-[#00e5ff]'
                            : isSelected
                            ? 'bg-white/10 border-white/30 text-white ring-1 ring-white/20'
                            : 'bg-white/3 border-white/8 text-white/60 hover:bg-white/8'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isHost ? 'bg-[#00e5ff] animate-pulse' : 'bg-white/40'}`} />
                        <span className="truncate max-w-[80px]">{rider.username.split('_')[0]}</span>
                        <span className="text-[9px] opacity-70">{rider.speed}km/h</span>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden lg:block space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {simulatedRiders.map((rider, idx) => {
                    const isHost = idx === 0;
                    const isSelected = selectedFriend?.id === rider.id;
                    const distanceToHost = calculateDistance(hostRider.lat, hostRider.lng, rider.lat, rider.lng);
                    return (
                      <div
                        key={rider.id}
                        onClick={() => { if (!isHost) setSelectedFriend(rider); }}
                        className={`p-3 rounded-xl transition duration-200 border cursor-pointer ${
                          isHost ? 'bg-[#00e5ff]/5 border-[#00e5ff]/20'
                          : isSelected ? 'bg-white/8 border-white/30 ring-1 ring-white/20'
                          : 'bg-white/3 border-white/5 hover:bg-white/8'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${isHost ? 'bg-[#00e5ff] animate-pulse' : 'bg-white/50'}`} />
                            <div>
                              <div className="text-xs font-bold text-white flex items-center space-x-1">
                                <span>{rider.username}</span>
                                {isHost && <span className="text-[10px] text-[#00e5ff]">★</span>}
                              </div>
                              <div className="text-[10px] text-white/40">{rider.role}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-semibold text-white/70">{rider.speed} km/h</span>
                            {!isHost && (
                              <div className="text-[10px] font-semibold text-[#00e5ff] font-mono">{distanceToHost} km</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                <button
                  onClick={handleTriggerSosDemo}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-xl shadow-[0_0_22px_rgba(255,68,68,0.35)] transition border border-red-400/30 flex items-center justify-center space-x-2 text-xs sm:text-sm"
                >
                  <span className="animate-ping">🚨</span>
                  <span>Test Emergency SOS</span>
                </button>

                <button
                  onClick={() => handleOpenAuth('register')}
                  className="glass-card hover:bg-[#00e5ff]/5 text-[#00e5ff] font-semibold py-3 px-4 rounded-xl border border-[#00e5ff]/25 transition text-xs flex items-center justify-center space-x-1.5"
                >
                  <span>Sign Up to Host Real Convoy</span>
                  <span>→</span>
                </button>
              </div>

            </div>

            {/* Interactive Leaflet Map — taller on mobile since sidebar is above */}
            <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-white/10 h-[320px] sm:h-[420px] lg:h-[520px] relative shadow-inner">
              <MapContainer
                center={currentRoute.center}
                zoom={13}
                className="w-full h-full"
                style={{ height: '100%', width: '100%', minHeight: '300px' }}
                ref={mapRef}
                zoomControl={true}
              >
                <MapController center={currentRoute.center} />

                <TileLayer
                  url={isLight
                    ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"}
                  subdomains={['a', 'b', 'c', 'd']}
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                <Marker position={[hostRider.lat, hostRider.lng]} icon={selfIcon}>
                  <Popup>
                    <div className="font-bold text-cyan-400">{hostRider.username}</div>
                    <div className="text-xs text-slate-300">Role: Convoy Host</div>
                    <div className="text-xs font-mono text-emerald-400">Velocity: {hostRider.speed} km/h</div>
                  </Popup>
                </Marker>

                {friendRiders.map((friend) => (
                  <Marker key={friend.id} position={[friend.lat, friend.lng]} icon={friendIcon}>
                    <Popup>
                      <div className="font-bold text-red-400">{friend.username}</div>
                      <div className="text-xs text-slate-300">Role: {friend.role}</div>
                      <div className="text-xs font-mono text-cyan-300">Velocity: {friend.speed} km/h</div>
                      <div className="text-xs font-mono text-emerald-400 mt-1">
                        Haversine Gap: {calculateDistance(hostRider.lat, hostRider.lng, friend.lat, friend.lng)} km
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {selectedFriend && (
                  <Polyline
                    positions={[
                      [hostRider.lat, hostRider.lng],
                      [selectedFriend.lat, selectedFriend.lng]
                    ]}
                    color="#00e5ff"
                    dashArray="8, 8"
                    weight={3}
                    opacity={0.9}
                  />
                )}
              </MapContainer>

              {/* Map HUD pill */}
              <div className="absolute top-3 left-3 z-[500] glass-badge px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono text-white/80 border border-white/15 shadow-lg flex items-center space-x-2 max-w-[90%] overflow-hidden">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping flex-shrink-0" />
                <span className="truncate">GPS Fix: ±3m</span>
                {selectedFriend && (
                  <span className="text-[#00e5ff] font-bold border-l border-white/20 pl-2 truncate">
                    Gap: {calculateDistance(hostRider.lat, hostRider.lng, selectedFriend.lat, selectedFriend.lng)} km
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* THREE PILLARS ARCHITECTURAL SECTION */}
      <section className="px-4 sm:px-8 pb-20 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-4xl font-black text-white">Engineered for <span className="text-[#00e5ff]">Harsh Road Environments</span></h2>
          <p className="text-sm text-white/40 max-w-2xl mx-auto">
            Decoupled full-stack architecture built specifically for two-wheeled convoy operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-3xl border border-[#00e5ff]/15 space-y-3 glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-[#00e5ff]/10 text-[#00e5ff] flex items-center justify-center text-2xl border border-[#00e5ff]/20">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-white">Full-Duplex WebSockets</h3>
            <p className="text-xs text-white/40 leading-relaxed">
              Flask-SocketIO room multiplexing connects riders into isolated channels. Emits location updates only to peers in that trip room with sub-15ms broadcast latency.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-3 glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-white/8 text-white/60 flex items-center justify-center text-2xl border border-white/10">
              💾
            </div>
            <h3 className="text-lg font-bold text-white">In-Memory Redis Cache</h3>
            <p className="text-xs text-white/40 leading-relaxed">
              Coordinates write directly to Redis key <code className="text-[#00e5ff]">trip:&lt;id&gt;:user:&lt;name&gt;</code> with 3,600s TTL. Protects transactional MySQL from disk saturation under continuous convoy streaming.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-red-500/15 space-y-3 glass-card-hover">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center text-2xl border border-red-500/20">
              🚨
            </div>
            <h3 className="text-lg font-bold text-white">Emergency SOS Channel</h3>
            <p className="text-xs text-white/40 leading-relaxed">
              One-touch roadside distress triggers an urgent sonic/visual alert across the entire group, broadcasting coordinates and letting companions immediately locate the stranded rider.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full glass-panel border-t border-white/8 px-6 sm:px-8 py-8 text-center text-xs text-white/30">
        <p className="font-medium text-white/50">
          MotoSync — Real-Time Fleet Telemetry &amp; Collaborative Ride Synchronization Platform
        </p>
        <p className="mt-1">
          Developed during Industrial Training 2026 at <span className="text-[#00e5ff]">Celebal Technologies</span> &amp; SKIT Jaipur • Parshotam Singh (23ESKCS162)
        </p>
      </footer>

      {/* SOS DEMO MODAL POPUP */}
      {sosDemoActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="glass-card bg-black/95 border-2 border-red-500 max-w-md w-full p-6 sm:p-8 rounded-3xl shadow-[0_0_60px_rgba(255,68,68,0.5)] text-center space-y-4">
            <div className="text-5xl animate-bounce">🚨</div>
            <h2 className="text-2xl font-black text-red-500 tracking-tight">EMERGENCY SOS DISTRESS</h2>
            <p className="text-sm text-white/80">
              Simulated Emergency Distress Alert received from <span className="font-bold text-white underline">Tanushk_Lead</span> in <span className="font-mono text-[#00e5ff]">{currentRoute.name}</span>!
            </p>
            <p className="text-xs text-white/40">
              Coordinates: <span className="font-mono text-white">34.1612° N, 77.5855° E</span> • Speed: <span className="font-mono text-white">64 km/h</span>
            </p>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setSelectedFriend(friendRiders[0]);
                  if (mapRef.current) mapRef.current.setView([friendRiders[0].lat, friendRiders[0].lng], 15);
                  setSosDemoActive(false);
                }}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg transition"
              >
                Focus Camera on Distressed Rider
              </button>
              <button
                onClick={() => setSosDemoActive(false)}
                className="w-full glass-card hover:bg-white/8 text-white/50 font-semibold py-2 rounded-xl transition text-xs"
              >
                Dismiss Simulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLASSMORPHISM AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-3 -right-3 z-50 w-9 h-9 rounded-full bg-black border border-white/15 text-white/50 hover:text-white flex items-center justify-center shadow-lg transition"
            >
              ✕
            </button>
            
            <Auth 
              initialMode={authMode}
              onLoginSuccess={(id, uname) => {
                setShowAuthModal(false);
                onLoginSuccess(id, uname);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default PublicInteractiveDashboard;
