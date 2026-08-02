import { useState, useEffect } from 'react';
import { Users, LogOut, Clock, Globe, Lock, PanelRight, PanelRightClose } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatScreen({ socket, user, room, setRoom, sessionTimeLeft }) {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [typingUser, setTypingUser] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [inviteRequests, setInviteRequests] = useState([]);

    // Helper to safely serialize history without large base64 payloads crashing localStorage
    const safeSaveHistory = (roomId, historyList) => {
        if (!roomId) return;
        try {
            const sanitized = historyList.map(msg => {
                if (msg.attachment && msg.attachment.data) {
                    // Do not store large binary blobs in localStorage to prevent QuotaExceededError
                    return {
                        ...msg,
                        attachment: {
                            name: msg.attachment.name,
                            type: msg.attachment.type,
                            size: msg.attachment.size
                        }
                    };
                }
                return msg;
            });
            localStorage.setItem(`chatjet_hist_${roomId}`, JSON.stringify(sanitized));
        } catch (e) {
            console.warn('Storage quota exceeded, safely pruning history:', e);
            try {
                // Fallback: keep only last 10 text messages
                const minimal = historyList.slice(-10).map(m => {
                    const { attachment, ...rest } = m;
                    return rest;
                });
                localStorage.setItem(`chatjet_hist_${roomId}`, JSON.stringify(minimal));
            } catch (err2) {
                // Ignore gracefully without crashing UI
            }
        }
    };

    // Initial load: Restore history safely and request user list
    useEffect(() => {
        const key = `chatjet_hist_${room}`;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const history = JSON.parse(raw);
                if (Array.isArray(history)) {
                    setMessages(history.map(item => item.data || item));
                }
            }
        } catch (e) {
            console.error('Failed to parse history from localStorage:', e);
            try {
                localStorage.removeItem(key);
            } catch (_) {}
        }

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
                if (prev.find(req => req.fromId === fromId)) return prev;
                return [...prev, { fromId, fromName, id: Date.now() }];
            });
        });

        // Join DM Room
        socket.on('join dm room', ({ roomId }) => {
            socket.emit('join dm', { roomId, name: user });
            setRoom(roomId);
            try {
                localStorage.setItem('chatjet_room', roomId);
            } catch (_) {}
            setInviteRequests([]);
        });

        // Message Deleted
        socket.on('message deleted', (deletedMsgId) => {
            setMessages(prev => {
                const newHistory = prev.filter(msg => msg.id !== deletedMsgId);
                safeSaveHistory(room, newHistory);
                return newHistory;
            });
        });

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

    const MAX_HISTORY_SIZE = 100;

    const addMessage = (msg) => {
        setMessages(prev => {
            let newHistory = [...prev, msg];
            if (newHistory.length > MAX_HISTORY_SIZE) {
                newHistory = newHistory.slice(-MAX_HISTORY_SIZE);
            }
            if (msg.type !== 'system' || (msg.text && msg.text.includes('joined'))) {
                safeSaveHistory(room, newHistory);
            }
            return newHistory;
        });
    };

    const handleDeleteMessage = (msgId) => {
        socket.emit('delete message', { msgId, roomId: room });
    };

    const handleSendMessage = ({ text, attachment }) => {
        if (text && text.startsWith('/')) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);

            switch (command) {
                case '/clear':
                    setMessages([]);
                    try {
                        localStorage.removeItem(`chatjet_hist_${room}`);
                    } catch (_) {}
                    return;
                case '/roll': {
                    const max = args[0] ? parseInt(args[0]) : 100;
                    const roll = Math.floor(Math.random() * max) + 1;
                    socket.emit('chat message', { text: `🎲 I rolled a **${roll}** (1-${max})` });
                    return;
                }
                case '/shrug':
                    socket.emit('chat message', { text: `¯\\_(ツ)_/¯` });
                    return;
                case '/burn': {
                    const secretMsg = args.join(' ');
                    if (!secretMsg) {
                        addMessage({ text: 'Usage: /burn <message>', type: 'system', id: Date.now() });
                        return;
                    }
                    socket.emit('chat message', { text: `🔥 [Self-destructing] ${secretMsg} ||ephemeral|10000||` });
                    return;
                }
                case '/poll': {
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
                }
                case '/help':
                default:
                    addMessage({ text: 'Commands: /clear, /roll [max], /shrug, /burn <msg>, /poll Q|A|B', type: 'system', id: Date.now() });
                    return;
            }
        }

        socket.emit('chat message', { text, attachment });
    };

    const handleStartDM = (targetUser) => {
        if (confirm(`Send direct message request to ${targetUser.name}?`)) {
            socket.emit('send dm request', {
                targetId: targetUser.id,
                fromName: user
            });
            alert('Request sent!');
        }
    };

    const handleLeave = () => {
        localStorage.removeItem('chatjet_name');
        localStorage.removeItem('chatjet_room');
        localStorage.removeItem('chatjet_last_active');
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

    const isPublic = room === 'Public' || !room;

    return (
        <div id="chatScreen">
            <div className="chat-main">
                <header className="chat-header">
                    <div className="header-title-group">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isPublic ? '#3b82f6' : '#10b981' }}>
                            {isPublic ? <Globe size={18} /> : <Lock size={18} />}
                        </span>
                        <div className="room-title">
                            {isPublic ? 'Public Workspace' : `Room: #${room}`}
                        </div>
                        <div className="status-pill">
                            <span className="status-indicator-dot"></span>
                            {isPublic ? 'Live' : 'Encrypted'}
                        </div>
                    </div>

                    <div className="header-actions">
                        {sessionTimeLeft !== undefined && (
                            <div className={`session-timer-pill ${sessionTimeLeft < 60000 ? 'warning' : ''}`} title="Session Time Remaining">
                                <Clock size={13} />
                                {Math.floor(sessionTimeLeft / 60000)}:{Math.floor((sessionTimeLeft % 60000) / 1000).toString().padStart(2, '0')}
                            </div>
                        )}

                        <button
                            type="button"
                            className={`header-btn ${sidebarOpen ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title={sidebarOpen ? "Hide Members Sidebar" : "Show Members Sidebar"}
                        >
                            <Users size={15} />
                            <span>Members</span>
                            <span style={{
                                background: sidebarOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                color: sidebarOpen ? '#93c5fd' : 'inherit',
                                padding: '1px 6px',
                                borderRadius: '99px',
                                fontSize: '0.7rem'
                            }}>
                                {users.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            className="header-btn danger"
                            onClick={handleLeave}
                            title="Leave Workspace"
                        >
                            <LogOut size={14} />
                            <span>Leave</span>
                        </button>
                    </div>
                </header>

                <MessageList
                    messages={messages}
                    userName={user}
                    socket={socket}
                    onDeleteMessage={handleDeleteMessage}
                />

                <div className="input-area">
                    {typingUser && (
                        <div className="typing-indicator">{typingUser} is typing...</div>
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
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
        </div>
    );
}
