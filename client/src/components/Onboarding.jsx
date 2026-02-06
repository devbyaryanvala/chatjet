import { useState } from 'react';

export default function Onboarding({ socket, setUser, setRoom }) {
    const [mode, setMode] = useState('public');
    const [name, setName] = useState(localStorage.getItem('chatjet_name') || '');
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleJoin = (isCreating = false) => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }

        setError('');

        // Save name to parent state and localStorage
        localStorage.setItem('chatjet_name', name);
        setUser(name);

        if (mode === 'public') {
            socket.emit('join public', { name });
        } else {
            if (!roomId.trim() || !password.trim()) {
                setError('Please enter Room ID and Password');
                return;
            }
            const event = isCreating ? 'create room' : 'join room';
            socket.emit(event, { name, roomId, password });
        }
    };

    return (
        <div id="onboarding">
            <div className="onboard-container">
                <div className="brand">
                    <div className="brand-icon">💬</div>
                    <div className="brand-text">ChatJet</div>
                </div>

                <h1 className="onboard-title">Start chatting<br />instantly.</h1>
                <p className="onboard-subtitle">Join the public conversation or create a private room.</p>

                <div className="mode-toggle">
                    <button
                        className={`mode-btn ${mode === 'public' ? 'active' : ''}`}
                        onClick={() => setMode('public')}
                    >
                        🌐 Public Chat
                    </button>
                    <button
                        className={`mode-btn ${mode === 'private' ? 'active' : ''}`}
                        onClick={() => setMode('private')}
                    >
                        🔒 Private Room
                    </button>
                </div>

                <div className="input-group">
                    <label className="input-label">Your Name</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Enter your display name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                {mode === 'private' && (
                    <div className="private-fields visible">
                        <div className="input-group">
                            <label className="input-label">Room ID</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Enter room identifier"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="Room password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

                {mode === 'public' ? (
                    <button className="btn-primary" onClick={() => handleJoin(false)}>
                        Join Public Chat
                    </button>
                ) : (
                    <>
                        <button className="btn-primary" onClick={() => handleJoin(false)}>
                            Join Room
                        </button>
                        <button className="btn-secondary" onClick={() => handleJoin(true)}>
                            Create New Room
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
