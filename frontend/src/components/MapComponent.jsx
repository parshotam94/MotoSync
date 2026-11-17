import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const selfIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const friendIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MapComponent = ({ userId, username, tripId, globalSocket, onLeaveTrip }) => {
  const [selfLocation, setSelfLocation] = useState(null);
  const [friends, setFriends] = useState({}); 
  const [selectedFriend, setSelectedFriend] = useState(null);
  const mapRef = useRef();

  // Invite state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteStatus, setInviteStatus] = useState({});
  const [groupInfo, setGroupInfo] = useState({ members: [], pending_requests: [] });
  const [showEndModal, setShowEndModal] = useState(false);
  const [sosAlert, setSosAlert] = useState(null);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's mean radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c;
    return d.toFixed(2);
  };

  const fetchGroupInfo = async () => {
      try {
          const res = await fetch(`${API_URL}/api/groups/${tripId}/info`);
          const data = await res.json();
          if (!data.error) setGroupInfo(data);
      } catch(err) {}
  };

  useEffect(() => {
     fetchGroupInfo();
     const interval = setInterval(fetchGroupInfo, 5000); // refresh every 5s
     return () => clearInterval(interval);
  }, [tripId]);

  useEffect(() => {
    if (!globalSocket) return;

    // Join room with username
    globalSocket.emit('join_trip', { user_id: username, trip_id: tripId });

    // Handle friend movement
    const handleFriendMoved = (data) => {
      setFriends((prevFriends) => ({
        ...prevFriends,
        [data.user_id]: data
      }));
    };

    // Receive initial locations of riders already in trip
    const handleInitialLocations = (locations) => {
      const otherFriends = { ...locations };
      delete otherFriends[username];
      setFriends(otherFriends);
    };

    // Remove rider who left
    const handleUserLeft = (data) => {
      setFriends((prevFriends) => {
        const updated = { ...prevFriends };
        delete updated[data.user_id];
        return updated;
      });
      fetchGroupInfo();
    };

    // Handle incoming Emergency SOS alert
    const handleSosBroadcast = (alertData) => {
      setSosAlert(alertData);
    };

    globalSocket.on('friend_location_update', handleFriendMoved);
    globalSocket.on('initial_convoy_locations', handleInitialLocations);
    globalSocket.on('user_left', handleUserLeft);
    globalSocket.on('emergency_sos_broadcast', handleSosBroadcast);
    
    // Invite listeners
    const onInviteError = (data) => {
      alert(data.message);
      setInviteStatus(prev => ({...prev, [data.receiver_username]: null}));
    };
    const onInviteSuccess = (data) => {};
    const onInviteResponse = (data) => {
      setInviteStatus(prev => ({...prev, [data.receiver_username]: data.status}));
    };
      
    globalSocket.on('invite_error', onInviteError);
    globalSocket.on('invite_success', onInviteSuccess);
    globalSocket.on('invite_response', onInviteResponse);
    globalSocket.on('invite_cancelled_success', (data) => {
        setInviteStatus(prev => ({...prev, [data.receiver_username]: null}));
        fetchGroupInfo();
    });
    globalSocket.on('remove_success', () => fetchGroupInfo());
    globalSocket.on('kicked_from_trip', (data) => {
        alert(data.message);
        if (onLeaveTrip) onLeaveTrip();
    });
    globalSocket.on('trip_ended', (data) => {
        alert(data.message);
        if (onLeaveTrip) onLeaveTrip();
    });

    return () => {
      globalSocket.emit('leave_trip', { user_id: username, trip_id: tripId });
      globalSocket.off('friend_location_update', handleFriendMoved);
      globalSocket.off('initial_convoy_locations', handleInitialLocations);
      globalSocket.off('user_left', handleUserLeft);
      globalSocket.off('emergency_sos_broadcast', handleSosBroadcast);
      globalSocket.off('invite_error', onInviteError);
      globalSocket.off('invite_success', onInviteSuccess);
      globalSocket.off('invite_response', onInviteResponse);
      globalSocket.off('invite_cancelled_success');
      globalSocket.off('remove_success');
      globalSocket.off('kicked_from_trip');
      globalSocket.off('trip_ended');
    };
  }, [globalSocket, username, tripId]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
        console.error('Geolocation is not supported by this browser');
        return;
    }

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const now = Date.now();
        
        const locData = {
            user_id: username,
            trip_id: tripId,
            lat: latitude,
            lng: longitude,
            speed: (speed || 0) * 3.6, // convert m/s to km/h
            timestamp: now
        };

        setSelfLocation(locData);

        // Throttle updates to 5-second intervals to save bandwidth and battery
        if (globalSocket && (now - lastSent > 5000)) {
            globalSocket.emit('location_update', locData);
            lastSent = now;
        }
        
        // Initial map centering
        if (mapRef.current && !selfLocation) {
             mapRef.current.setView([latitude, longitude], 14);
        }
      },
      (error) => {
        console.warn('Geolocation sensor warning:', error.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [globalSocket, tripId, username, selfLocation]);

  // Search effect
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}&user_id=${userId}`);
        const data = await res.json();
        const filtered = data.filter(u => u.username !== username);
        setSearchResults(filtered);
      } catch (err) {}
    };
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, username, userId]);

  const sendInvite = (receiverUsername) => {
      setInviteStatus(prev => ({...prev, [receiverUsername]: 'waiting'}));
      globalSocket.emit('send_invite', {
          sender_id: userId,
          sender_username: username,
          receiver_username: receiverUsername,
          trip_id: tripId
      });
  };

  const cancelInvite = (requestId) => {
      globalSocket.emit('cancel_invite', { request_id: requestId, user_id: userId });
  };
  
  const removeMember = (targetUserId) => {
      globalSocket.emit('remove_member', { target_user_id: targetUserId, user_id: userId, trip_id: tripId });
  };

  const handleSos = () => {
      if (!globalSocket) return;
      const sosPayload = {
          user_id: username,
          trip_id: tripId,
          lat: selfLocation?.lat || null,
          lng: selfLocation?.lng || null,
          speed: selfLocation?.speed || 0,
          timestamp: Date.now()
      };
      globalSocket.emit('sos_alert', sosPayload);
      alert("🚨 Emergency SOS signal has been broadcasted to all riders in this trip!");
  };

  const handleFocusOnAlert = () => {
      if (sosAlert && sosAlert.lat && sosAlert.lng && mapRef.current) {
          mapRef.current.setView([sosAlert.lat, sosAlert.lng], 16);
      }
      setSosAlert(null);
  };

  const handleLeaveClick = () => {
      if (groupInfo.creator_id === userId) {
          setShowEndModal(true);
      } else {
          onLeaveTrip();
      }
  };

  const closeOrSaveTrip = (action) => {
      globalSocket.emit('close_or_save_trip', { action, trip_id: tripId, user_id: userId });
      setShowEndModal(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#000000] text-white font-sans overflow-hidden">
      
      {/* SIDEBAR COCKPIT (Frosted Glass Panel) */}
      <div className="w-full md:w-84 glass-panel border-r border-white/8 flex flex-col z-20 shadow-2xl relative h-full">
        
        {/* Cockpit Header */}
        <div className="p-5 border-b border-white/8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2.5">
              <span className="text-xl">🏍️</span>
              <h1 className="text-xl font-black text-white">
                Moto<span className="text-[#00e5ff]">Sync</span>
              </h1>
            </div>
            <button 
              onClick={handleLeaveClick} 
              className="text-xs text-white/40 hover:text-red-400 font-semibold px-2.5 py-1 rounded-lg glass-badge transition"
            >
              Exit Ride
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-white/40">Trip ID:</span>
            <span className="font-mono text-[#00e5ff] font-bold bg-black/60 px-2 py-0.5 rounded-md border border-[#00e5ff]/20">
              {tripId}
            </span>
          </div>
        </div>
        
        {/* Invite Friend Section */}
        <div className="p-4 border-b border-white/8 bg-black/20">
          <button 
            onClick={() => setShowInvitePanel(!showInvitePanel)}
            className="w-full bg-[#00e5ff]/10 hover:bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/20 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center space-x-2 shadow-lg"
          >
            <span>➕ Invite Companions</span>
          </button>
          
          {showInvitePanel && (
            <div className="mt-3 space-y-2">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none transition"
                placeholder="Search by rider handle..."
              />
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {searchResults.length === 0 && searchQuery.length >= 2 && (
                  <p className="text-[11px] text-white/30 text-center py-2">No matching riders found</p>
                )}
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between glass-card p-2 rounded-lg border border-white/8 text-xs">
                    <span className="font-semibold text-white truncate max-w-[120px]">{u.username}</span>
                    <button 
                      onClick={() => !inviteStatus[u.username] && sendInvite(u.username)}
                      disabled={!!inviteStatus[u.username]}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition shadow ${
                        inviteStatus[u.username] === 'waiting' ? 'bg-white/20 text-white/50' : 
                        inviteStatus[u.username] === 'accepted' ? 'bg-[#00e5ff]/20 text-[#00e5ff]' :
                        inviteStatus[u.username] === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-[#00e5ff] hover:bg-[#33ecff] text-black'
                      }`}
                    >
                      {inviteStatus[u.username] === 'waiting' ? 'Sent...' : 
                       inviteStatus[u.username] === 'accepted' ? 'Accepted' :
                       inviteStatus[u.username] === 'rejected' ? 'Declined' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Group Convoy Roster */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-[11px] font-bold uppercase text-white/40 tracking-wider">Convoy Roster</h2>
            <span className="text-[10px] font-mono text-[#00e5ff] glass-badge px-2 py-0.5 rounded-full">
              {groupInfo.members.length} Registered
            </span>
          </div>
          
          {/* Pending Invites sent by Me */}
          {groupInfo.pending_requests.filter(req => req.sender_id === userId).map(req => (
            <div key={`req-${req.request_id}`} className="glass-card bg-white/3 p-2.5 rounded-xl border border-white/8 flex justify-between items-center text-xs">
              <span className="text-white/50 truncate max-w-[150px]">⏳ {req.receiver_username} (Pending)</span>
              <button onClick={() => cancelInvite(req.request_id)} className="text-[11px] text-red-400 hover:text-red-300 font-bold underline">Cancel</button>
            </div>
          ))}

          {/* Official Members Cards */}
          {groupInfo.members.map(member => {
            const isActive = friends[member.username] || (member.username === username && selfLocation);
            const locData = member.username === username ? selfLocation : friends[member.username];
            const isSelected = selectedFriend?.user_id === member.username;

            return (
              <div 
                key={`mem-${member.id}`} 
                className={`glass-card p-3 rounded-2xl transition duration-200 border transform ${
                  isSelected
                    ? 'border-[#00e5ff]/50 bg-[#00e5ff]/5 shadow-[0_0_20px_rgba(0,229,255,0.15)] ring-1 ring-[#00e5ff]/20'
                    : 'border-white/8 hover:border-white/15'
                } ${!isActive ? 'opacity-30 grayscale' : 'hover:scale-[1.02] cursor-pointer'}`}
                onClick={() => {
                  if (isActive && member.username !== username) setSelectedFriend(locData);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      isActive 
                        ? (member.username === username ? 'bg-[#00e5ff] animate-pulse' : 'bg-white/60')
                        : 'bg-white/15'
                    }`} />
                    <div className="truncate max-w-[120px]">
                      <div className="text-xs font-bold text-white flex items-center space-x-1">
                        <span className="truncate">{member.username}</span>
                        {member.role === 'creator' && <span className="text-[#00e5ff] text-[10px]">★</span>}
                        {member.username === username && <span className="text-white/40 text-[10px]">(You)</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isActive && locData?.speed !== undefined && (
                      <span className="text-[11px] font-mono bg-black/40 px-2 py-0.5 rounded-md text-[#00e5ff] border border-[#00e5ff]/15">
                        {locData.speed.toFixed(1)} km/h
                      </span>
                    )}
                    {member.username !== username && (groupInfo.creator_id === userId || member.inviter_id === userId) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeMember(member.id); }} 
                        className="text-[10px] font-bold text-red-400 bg-red-950/30 border border-red-500/20 px-2 py-0.5 rounded hover:bg-red-900/50 transition"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Distance Metric */}
                {isActive && selfLocation && member.username !== username && locData && (
                  <div className="mt-2 text-[11px] text-white/40 flex justify-between items-center bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                    <span>Haversine Gap:</span>
                    <span className="font-mono font-bold text-[#00e5ff]">
                      {calculateDistance(selfLocation.lat, selfLocation.lng, locData.lat, locData.lng)} km
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Emergency SOS Button in Sidebar */}
        <div className="p-4 border-t border-white/8 bg-black/40 mt-auto">
          <button 
            onClick={handleSos}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 px-4 rounded-2xl shadow-[0_0_28px_rgba(255,68,68,0.45)] transition transform hover:-translate-y-0.5 border border-red-400/25 flex items-center justify-center space-x-2 text-sm"
          >
            <span className="text-lg animate-ping">🚨</span>
            <span className="tracking-wide">EMERGENCY SOS</span>
          </button>
        </div>
      </div>

      {/* MAP AREA */}
      <div className="flex-1 relative z-10 w-full h-[55vh] md:h-full">
        <MapContainer 
          center={selfLocation ? [selfLocation.lat, selfLocation.lng] : [26.9124, 75.7873]} 
          zoom={13} 
          className="w-full h-full"
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Self Location Marker */}
          {selfLocation && (
            <Marker position={[selfLocation.lat, selfLocation.lng]} icon={selfIcon}>
              <Popup>
                <div className="font-bold text-cyan-400">You ({username})</div>
                <div className="text-xs text-slate-300">Speed: {selfLocation.speed.toFixed(1)} km/h</div>
              </Popup>
            </Marker>
          )}

          {/* Companion Markers */}
          {Object.values(friends).map(friend => (
            <Marker key={friend.user_id} position={[friend.lat, friend.lng]} icon={friendIcon}>
              <Popup>
                <div className="font-bold text-rose-400">{friend.user_id}</div>
                <div className="text-xs text-slate-300">Speed: {friend.speed.toFixed(1)} km/h</div>
                {selfLocation && (
                  <div className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                    Distance: {calculateDistance(selfLocation.lat, selfLocation.lng, friend.lat, friend.lng)} km
                  </div>
                )}
              </Popup>
            </Marker>
          ))}

          {/* Dynamic Glowing Polyline connecting You and Selected Companion */}
          {selfLocation && selectedFriend && (
            <Polyline 
              positions={[
                [selfLocation.lat, selfLocation.lng],
                [selectedFriend.lat, selectedFriend.lng]
              ]} 
              color="#00e5ff" 
              dashArray="8, 8" 
              weight={3}
              opacity={0.9}
            />
          )}
        </MapContainer>

        {/* Floating Telemetry HUD on Top of Map */}
        <div className="absolute top-4 left-4 z-[500] flex flex-wrap gap-2 pointer-events-none">
          <div className="glass-badge px-3.5 py-1.5 rounded-xl text-xs font-mono text-white/70 border border-white/12 shadow-lg pointer-events-auto flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
            <span>Telemetry: Streaming</span>
          </div>

          {selfLocation && (
            <div className="glass-badge px-3.5 py-1.5 rounded-xl text-xs font-mono text-[#00e5ff] border border-[#00e5ff]/20 shadow-lg pointer-events-auto">
              Your Speed: {selfLocation.speed.toFixed(1)} km/h
            </div>
          )}

          {selectedFriend && selfLocation && (
            <div className="glass-badge px-3.5 py-1.5 rounded-xl text-xs font-mono text-white/70 border border-white/12 shadow-lg pointer-events-auto">
              Distance to {selectedFriend.user_id}: {calculateDistance(selfLocation.lat, selfLocation.lng, selectedFriend.lat, selectedFriend.lng)} km
            </div>
          )}
        </div>
      </div>

      {/* EMERGENCY SOS POPUP MODAL */}
      {sosAlert && (
        <div className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-black/98 border-2 border-red-500 max-w-md w-full p-6 sm:p-8 rounded-3xl shadow-[0_0_60px_rgba(255,68,68,0.5)] text-center space-y-4">
            <div className="text-5xl animate-bounce">🚨</div>
            <h2 className="text-2xl font-black text-red-500 tracking-tight">EMERGENCY SOS DISTRESS</h2>
            <p className="text-base text-white font-semibold">
              Rider <span className="text-red-400 font-bold underline">{sosAlert.user_id}</span> has requested emergency assistance!
            </p>
            <p className="text-xs text-white/40">
              {sosAlert.speed ? `Velocity: ${sosAlert.speed.toFixed(1)} km/h • ` : ''}Roadside distress signal broadcasted across convoy.
            </p>
            <div className="pt-2 space-y-2.5">
              <button 
                onClick={handleFocusOnAlert}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg transition"
              >
                Locate Companion on Map
              </button>
              <button 
                onClick={() => setSosAlert(null)}
                className="w-full glass-card hover:bg-white/8 text-white/40 font-semibold py-2 rounded-xl transition text-xs"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END TRIP MODAL FOR CREATORS */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-black/95 max-w-sm w-full p-6 rounded-3xl border border-white/12 shadow-2xl text-center space-y-4">
            <h2 className="text-xl font-bold text-white">End This <span className="text-[#00e5ff]">Convoy</span>?</h2>
            <p className="text-white/40 text-xs leading-relaxed">
              As the trip host, ending this ride releases all riders from the room. What would you like to do with the ride data?
            </p>
            <div className="space-y-2.5 pt-2">
              <button 
                onClick={() => closeOrSaveTrip('save')}
                className="w-full bg-[#00e5ff] hover:bg-[#33ecff] text-black font-bold py-3 rounded-xl shadow-lg transition text-xs"
              >
                End &amp; Save to History
              </button>
              <button 
                onClick={() => closeOrSaveTrip('delete')}
                className="w-full border border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white font-bold py-2.5 rounded-xl transition text-xs"
              >
                End &amp; Delete Permanently
              </button>
              <button 
                onClick={() => setShowEndModal(false)}
                className="w-full text-white/30 hover:text-white font-semibold py-2 transition text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MapComponent;
