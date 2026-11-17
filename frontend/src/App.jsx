import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Dashboard from './components/Dashboard';
import MapComponent from './components/MapComponent';
import PublicInteractiveDashboard from './components/PublicInteractiveDashboard';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('motosync_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTripId, setActiveTripId] = useState(() => {
    try {
      return sessionStorage.getItem('motosync_active_trip') || null;
    } catch (e) {
      return null;
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('motosync_theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  const [globalSocket, setGlobalSocket] = useState(null);

  // Sync theme with HTML root class
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
    try {
      localStorage.setItem('motosync_theme', theme);
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (user_id, username) => {
    const userData = { id: user_id, username };
    setUser(userData);
    try {
      localStorage.setItem('motosync_user', JSON.stringify(userData));
    } catch (e) {}
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTripId(null);
    try {
      localStorage.removeItem('motosync_user');
      sessionStorage.removeItem('motosync_active_trip');
    } catch (e) {}
  };

  const handleJoinTrip = (tripId) => {
    setActiveTripId(tripId);
    try {
      sessionStorage.setItem('motosync_active_trip', tripId);
    } catch (e) {}
  };

  const handleLeaveTrip = () => {
    setActiveTripId(null);
    try {
      sessionStorage.removeItem('motosync_active_trip');
    } catch (e) {}
  };

  useEffect(() => {
    // Connect socket globally once logged in to receive invites and maintain presence
    if (user) {
      const socket = io(SOCKET_SERVER_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
      
      socket.on('connect', () => {
        console.log("Global Push Socket connected:", socket.id);
        socket.emit('register_socket', { username: user.username });
      });

      setGlobalSocket(socket);

      return () => {
        socket.disconnect();
        setGlobalSocket(null);
      };
    }
  }, [user]);

  // PUBLIC INTERACTIVE DASHBOARD (Shown in front before any login or signup!)
  if (!user) {
    return (
      <PublicInteractiveDashboard 
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // Authenticated Member Dashboard Flow (Create trips, pending push invites, history)
  if (user && !activeTripId) {
    return (
      <Dashboard 
        userId={user.id} 
        username={user.username} 
        onJoinTrip={handleJoinTrip} 
        onLogout={handleLogout}
        globalSocket={globalSocket} 
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // Active Convoy Tactical Map Flow
  return (
    <MapComponent 
      userId={user.id}
      username={user.username}
      tripId={activeTripId} 
      globalSocket={globalSocket}
      onLeaveTrip={handleLeaveTrip}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;
