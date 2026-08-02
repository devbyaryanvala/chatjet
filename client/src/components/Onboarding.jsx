import { useState, useEffect } from 'react';
import { Globe, Lock, ArrowRight, ShieldCheck, AlertCircle, Sparkles, Info, X, Instagram, Linkedin } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
import { getClientId } from '../utils/clientId';
import ChatJetIcon from '../assets/ChatJetIcon.png';

export default function Onboarding({ socket, setUser, setRoom }) {
    const [mode, setMode] = useState('public');
    const [name, setName] = useState(localStorage.getItem('chatjet_name') || '');
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const handleError = (errMsg) => {
            setError(errMsg);
            setIsSubmitting(false);
        };

        const handleRoomJoined = () => {
            setIsSubmitting(false);
        };

        socket.on('error', handleError);
        socket.on('room joined', handleRoomJoined);

        return () => {
            socket.off('error', handleError);
            socket.off('room joined', handleRoomJoined);
        };
    }, [socket]);

    const handleJoin = (isCreating = false) => {
        const cleanName = name.trim();
        if (!cleanName) {
            setError('Please enter your display name to continue');
            return;
        }

        if (cleanName.length < 2 || cleanName.length > 30) {
            setError('Display name must be between 2 and 30 characters');
            return;
        }

        setError('');
        setIsSubmitting(true);

        // Save name to state and localStorage
        localStorage.setItem('chatjet_name', cleanName);
        setUser(cleanName);

        const clientId = getClientId();

        if (mode === 'public') {
            socket.emit('join public', { name: cleanName, clientId });
        } else {
            const cleanRoomId = roomId.trim();
            const cleanPassword = password.trim();
            if (!cleanRoomId || !cleanPassword) {
                setError('Please enter both Room ID and Password');
                setIsSubmitting(false);
                return;
            }
            const event = isCreating ? 'create room' : 'join room';
            socket.emit(event, { name: cleanName, roomId: cleanRoomId, password: cleanPassword, clientId });
        }
    };

    return (
        <div id="onboarding">
            {/* Info / Credits Modal */}
            {showInfo && (
                <div className="info-modal-overlay" onClick={() => setShowInfo(false)}>
                    <div className="info-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="info-modal-close"
                            onClick={() => setShowInfo(false)}
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                        <div className="info-modal-avatar">
                            <img
                                src={getAvatarUrl('Aryan')}
                                alt="Aryan"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div className="info-modal-name">Aryan Vala</div>
                        <div className="info-modal-tagline">Developer &amp; Designer</div>
                        <div className="info-modal-links">
                            <a
                                href="https://www.instagram.com/dez.aryan"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-link"
                            >
                                <Instagram size={15} />
                                <span>dez.aryan</span>
                            </a>
                            <a
                                href="https://www.linkedin.com/in/aryan-vala-ba62a1212/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-link"
                            >
                                <Linkedin size={15} />
                                <span>aryan-vala</span>
                            </a>
                        </div>
                        <div className="info-modal-footer">ChatJet v2.0.0 &bull; Velocity Release</div>
                    </div>
                </div>
            )}

            <div className="onboard-card">
                <div className="brand-header">
                    <div className="brand-badge">
                        <img src={ChatJetIcon} alt="ChatJet Logo" className="brand-logo-img" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="brand-title-row">
                            <div className="brand-title">ChatJet</div>
                            <span className="brand-version-badge">v2.0.0</span>
                        </div>
                        <div className="brand-version-name">Velocity Edition</div>
                    </div>
                    <button
                        type="button"
                        className="info-btn"
                        onClick={() => setShowInfo(true)}
                        title="About / Credits"
                    >
                        <Info size={16} />
                    </button>
                </div>

                <h1 className="onboard-heading">Welcome back</h1>
                <p className="onboard-subtext">Join the public workspace or access a private team room.</p>

                <div className="segmented-tabs">
                    <button
                        type="button"
                        className={`tab-btn ${mode === 'public' ? 'active' : ''}`}
                        onClick={() => { setMode('public'); setError(''); }}
                    >
                        <Globe size={15} /> Public Chat
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${mode === 'private' ? 'active' : ''}`}
                        onClick={() => { setMode('private'); setError(''); }}
                    >
                        <Lock size={15} /> Private Room
                    </button>
                </div>

                <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>Display Name</label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Sparkles size={11} /> Auto Avatar
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div className="user-avatar-preview" title="Auto-generated Profile Picture">
                            <img
                                src={getAvatarUrl(name || 'guest')}
                                alt="Avatar Preview"
                                className="user-item-avatar-img"
                            />
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="e.g. Alex Morgan"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoin(false)}
                            autoFocus
                        />
                    </div>
                </div>

                {mode === 'private' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Room Identifier</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. engineering-team"
                                value={roomId}
                                onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Passcode</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Room secret passcode"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoin(false)}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="form-error">
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                <div style={{ marginTop: '1.25rem' }}>
                    {mode === 'public' ? (
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleJoin(false)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Entering Workspace...' : 'Enter Public Workspace'} <ArrowRight size={16} />
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleJoin(false)}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Joining Room...' : 'Join Existing Room'} <ArrowRight size={16} />
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleJoin(true)}
                                disabled={isSubmitting}
                            >
                                <ShieldCheck size={16} /> Create New Private Room
                            </button>
                        </>
                    )}
                </div>

                <div className="onboard-footer">
                    <span>ChatJet <strong className="version-tag">v2.0.0</strong> &bull; <em>Velocity</em></span>
                </div>
            </div>
        </div>
    );
}
