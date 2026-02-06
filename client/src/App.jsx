import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Onboarding from './components/Onboarding';
import ChatScreen from './components/ChatScreen';

// Initialize socket outside component to prevent reconnection on re-renders
// Initialize socket outside component to prevent reconnection on re-renders
const SOCKET_URL = import.meta.env.PROD ? '/' : 'http://localhost:2800';
const socket = io(SOCKET_URL);


// Session timeout (2 minutes of inactivity clears session)
const SESSION_TIMEOUT = 2 * 60 * 1000;

function App() {
  const [userName, setUserName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isLoading, setIsLoading] = useState(true); // Show loading while checking session
  const [timeLeft, setTimeLeft] = useState(SESSION_TIMEOUT);
  const hasAutoJoined = useRef(false);

  // Check for existing session and auto-rejoin
  useEffect(() => {
    // Check inactivity timeout
    const checkTimeout = () => {
      const lastActive = parseInt(localStorage.getItem('chatjet_last_active') || Date.now());
      const elapsed = Date.now() - lastActive;
      const remaining = Math.max(0, SESSION_TIMEOUT - elapsed);

      setTimeLeft(remaining);

      if (remaining === 0) {
        localStorage.removeItem('chatjet_name');
        localStorage.removeItem('chatjet_room');
        localStorage.removeItem('chatjet_last_active');
        window.location.reload();
      }
    };

    // Initial check
    checkTimeout();

    // Track activity
    const activityHandler = () => {
      if (!window.activityThrottled) {
        localStorage.setItem('chatjet_last_active', Date.now().toString());
        window.activityThrottled = true;
        setTimeout(() => window.activityThrottled = false, 1000);
      }
    };
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
      window.addEventListener(event, activityHandler);
    });

    // Active timeout check interval
    const intervalId = setInterval(checkTimeout, 1000);

    // Try to restore session
    const savedName = localStorage.getItem('chatjet_name');
    const savedRoom = localStorage.getItem('chatjet_room');

    if (savedName && savedRoom && !hasAutoJoined.current) {
      setUserName(savedName);
      // Auto-rejoin will happen once socket connects
    }

    setIsLoading(false);

    return () => {
      ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
      clearInterval(intervalId);
    };
  }, []); // Empty dependency since we don't use currentRoom anymore inside


  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);

      // Auto-rejoin if we have saved session
      const savedName = localStorage.getItem('chatjet_name');
      const savedRoom = localStorage.getItem('chatjet_room');

      if (savedName && savedRoom && !hasAutoJoined.current && !currentRoom) {
        hasAutoJoined.current = true;
        setUserName(savedName);

        if (savedRoom === 'Public') {
          socket.emit('join public', { name: savedName });
        } else {
          // For private rooms, we can't auto-rejoin without password
          // So just restore the name and show onboarding
          hasAutoJoined.current = false;
        }
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room joined', ({ roomId, isCreator }) => {
      setCurrentRoom(roomId);
      localStorage.setItem('chatjet_room', roomId);
    });

    socket.on('error', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room joined');
      socket.off('error');
    };
  }, [currentRoom]);

  // Update localStorage when name changes
  useEffect(() => {
    if (userName) localStorage.setItem('chatjet_name', userName);
  }, [userName]);

  // Show loading state briefly while checking session
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      {!currentRoom ? (
        <Onboarding
          socket={socket}
          setUser={setUserName}
          setRoom={setCurrentRoom}
        />
      ) : (
        <ChatScreen
          socket={socket}
          user={userName}
          room={currentRoom}
          setRoom={setCurrentRoom}
          sessionTimeLeft={timeLeft}
        />
      )}
    </>
  );
}

export default App;
