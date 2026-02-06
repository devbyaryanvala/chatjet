import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import Aurora from './Aurora';

export default function ChatScreen({ socket, user, room, setRoom, sessionTimeLeft }) {
    const [messages, setMessages] = useState([]); // Array of { type: 'message'|'system', ... }
    const [users, setUsers] = useState([]);
    const [typingUser, setTypingUser] = useState(null);

    const [inviteRequests, setInviteRequests] = useState([]);

    // Initial load: Restore history and request user list
    useEffect(() => {
        // Restore history from localStorage
        const key = `chatjet_hist_${room}`;
        try {
            const history = JSON.parse(localStorage.getItem(key) || '[]');
            setMessages(history.map(item => item.data || item));
        } catch (e) {
            console.error(e);
        }

        // Request current user list from server
        socket.emit('request users');
    }, [room, socket]);

    // Socket listeners
    useEffect(() => {
        socket.on('chat message', (msg) => {
            addMessage({ ...msg, type: 'message' });
        });

        socket.on('system message', (text) => {
            const content = typeof text === 'string' ? text : text.text;
            addMessage({ text: content, type: 'system', id: Date.now() });
        });

        socket.on('new poll', (poll) => {
            addMessage({ ...poll, type: 'poll' });
        });

        socket.on('update poll', (updatedPoll) => {
            setMessages(prev => prev.map(m => {
                if (m.id === updatedPoll.pollId) {
                    return { ...m, ...updatedPoll };
                }
                return m;
            }));
        });

        socket.on('room users', (userList) => {
            setUsers(userList);
        });

        socket.on('user typing', ({ name }) => {
            setTypingUser(name);
        });

        socket.on('user stop typing', () => {
            setTypingUser(null);
        });

        socket.on('error', (err) => alert(err));

        // DM Request Received
        socket.on('dm request received', ({ fromId, fromName }) => {
            setInviteRequests(prev => {
                // Avoid duplicates
                if (prev.find(req => req.fromId === fromId)) return prev;
                return [...prev, { fromId, fromName, id: Date.now() }];
            });
        });

        // Join DM Room (instructed by server)
        socket.on('join dm room', ({ roomId }) => {
            socket.emit('join dm', { roomId, name: user });
            setRoom(roomId);
            localStorage.setItem('chatjet_room', roomId);
            // Clear invites on join
            setInviteRequests([]);
        });

        // Message Deleted
        socket.on('message deleted', (deletedMsgId) => {
            setMessages(prev => {
                const newHistory = prev.filter(msg => msg.id !== deletedMsgId);
                localStorage.setItem(`chatjet_hist_${room}`, JSON.stringify(newHistory));
                return newHistory;
            });
        });

        // Handle reconnections - re-request user list
        socket.on('connect', () => {
            setTimeout(() => {
                socket.emit('request users');
            }, 500);
        });

        return () => {
            socket.off('chat message');
            socket.off('system message');
            socket.off('new poll');
            socket.off('update poll');
            socket.off('room users');
            socket.off('user typing');
            socket.off('user stop typing');
            socket.off('error');
            socket.off('connect');
            socket.off('dm request received');
            socket.off('join dm room');
            socket.off('message deleted');
        };
    }, [room, socket, user]);


    const addMessage = (msg) => {
        setMessages(prev => {
            const newHistory = [...prev, msg];
            // Save to localStorage immediately
            if (msg.type !== 'system' || msg.text.includes('joined')) {
                localStorage.setItem(`chatjet_hist_${room}`, JSON.stringify(newHistory));
            }
            return newHistory;
        });
    };

    const handleDeleteMessage = (msgId) => {
        socket.emit('delete message', { msgId, roomId: room });
    };

    const handleSendMessage = ({ text, attachment }) => {
        if (text.startsWith('/')) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);

            switch (command) {
                case '/clear':
                    setMessages([]);
                    localStorage.removeItem(`chatjet_hist_${room}`);
                    return;
                case '/roll':
                    const max = args[0] ? parseInt(args[0]) : 100;
                    const roll = Math.floor(Math.random() * max) + 1;
                    socket.emit('chat message', { text: `🎲 I rolled a **${roll}** (1-${max})` });
                    return;
                case '/shrug':
                    socket.emit('chat message', { text: `¯\\_(ツ)_/¯` });
                    return;
                case '/burn':
                    const secretMsg = args.join(' ');
                    if (!secretMsg) {
                        addMessage({ text: 'Usage: /burn <message>', type: 'system', id: Date.now() });
                        return;
                    }
                    socket.emit('chat message', { text: `🔥 [Self-destructing] ${secretMsg} ||ephemeral|10000||` });
                    return;
                case '/poll':
                    // Format: /poll Question | Opt1 | Opt2
                    const wholeLine = args.join(' ');
                    const pollParts = wholeLine.split('|').map(s => s.trim()).filter(s => s.length > 0);

                    if (pollParts.length < 3) {
                        addMessage({ text: 'Usage: /poll Question | Option 1 | Option 2 ...', type: 'system', id: Date.now() });
                        return;
                    }
                    socket.emit('create poll', {
                        question: pollParts[0],
                        options: pollParts.slice(1),
                        roomId: room,
                        creator: user
                    });
                    return;
                case '/help':
                default:
                    addMessage({ text: 'Commands: /clear, /roll [max], /shrug, /burn <msg>, /poll Q|A|B', type: 'system', id: Date.now() });
                    return;
            }
        }

        socket.emit('chat message', { text, attachment });
    };

    const handleStartDM = (targetUser) => {
        if (confirm(`Send DM request to ${targetUser.name}?`)) {
            socket.emit('send dm request', {
                targetId: targetUser.id,
                fromName: user
            });
            alert('Request sent!');
        }
    };

    const handleLeave = () => {
        // Clear all ChatJet session data
        localStorage.removeItem('chatjet_name');
        localStorage.removeItem('chatjet_room');
        localStorage.removeItem('chatjet_last_active');
        // Also clear message history for this room
        localStorage.removeItem(`chatjet_hist_${room}`);
        window.location.reload();
    };

    const handleAcceptInvite = (req) => {
        socket.emit('dm accepted', {
            fromId: req.fromId,
            toId: socket.id
        });
        setInviteRequests(prev => prev.filter(r => r.id !== req.id));
    };

    const handleDeclineInvite = (req) => {
        setInviteRequests(prev => prev.filter(r => r.id !== req.id));
    };

    return (
        <div id="chatScreen" className="active" style={{ position: 'relative' }}>
            <Aurora colorStops={['#00d2ff', '#3a7bd5', '#00d2ff']} blend={0.6} amplitude={1.1} speed={0.5} />
            <div className="chat-main" style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.45)' }}>

                <header className="chat-header">
                    <div>
                        <h2>{room === 'Public' ? 'Public Chat' : 'Private Room'}</h2>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '4px' }}>
                            <div className="status-indicator">
                                <span className="status-dot"></span>
                                {room === 'Public' ? 'Live' : 'Secure'}
                            </div>
                            {sessionTimeLeft !== undefined && (
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    color: sessionTimeLeft < 30000 ? '#ef4444' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <span>⏱</span>
                                    {Math.floor(sessionTimeLeft / 60000)}:{Math.floor((sessionTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            className="btn-leave"
                            onClick={(e) => {
                                document.getElementById('sidebar').classList.toggle('open');
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                        >
                            👥
                        </button>
                        <button className="btn-leave" onClick={handleLeave}>Leave</button>
                    </div>
                </header>

                <MessageList
                    messages={messages}
                    userName={user}
                    socket={socket}
                    onDeleteMessage={handleDeleteMessage}
                />

                <div style={{ position: 'relative' }}>
                    {typingUser && (
                        <div className="typing-indicator active">{typingUser} is typing...</div>
                    )}
                    <MessageInput
                        socket={socket}
                        currentRoom={room}
                        userName={user}
                        onSendMessage={handleSendMessage}
                    />
                </div>
            </div>

            <Sidebar
                socket={socket}
                users={users}
                userName={user}
                onStartDM={handleStartDM}
                inviteRequests={inviteRequests}
                onAcceptInvite={handleAcceptInvite}
                onDeclineInvite={handleDeclineInvite}
            />
        </div>
    );
}
