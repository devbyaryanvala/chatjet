import { useState, useEffect } from 'react';
import { UserPlus, Check, X } from 'lucide-react';

export default function Sidebar({ socket, users, userName, currentUser, onStartDM, inviteRequests = [], onAcceptInvite, onDeclineInvite }) {
    const [isOpen, setIsOpen] = useState(false);

    // Listen for window resize to handle responsiveness
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) setIsOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => setIsOpen(!isOpen);

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
            {inviteRequests.length > 0 && (
                <div className="notifications-section" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                    <div className="sidebar-header" style={{ color: 'var(--accent-primary)' }}>Notifications</div>
                    <div className="notification-list">
                        {inviteRequests.map(req => (
                            <div key={req.id} style={{
                                padding: '0.75rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '0.5rem',
                                border: '1px solid var(--border-subtle)'
                            }}>
                                <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <strong>{req.fromName}</strong> sent a DM request
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => onAcceptInvite(req)}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                            background: 'var(--success)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', fontSize: '0.75rem'
                                        }}>
                                        <Check size={12} /> Accept
                                    </button>
                                    <button
                                        onClick={() => onDeclineInvite(req)}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                            background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '4px', cursor: 'pointer', fontSize: '0.75rem'
                                        }}>
                                        <X size={12} /> Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Online Users</span>
                <span style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minWidth: '24px',
                    textAlign: 'center'
                }}>
                    {users.length}
                </span>
            </div>
            <div className="user-list">
                {users.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem 1rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem'
                    }}>
                        No users online
                    </div>
                ) : (
                    users.map(u => {
                        const isMe = u.name === userName;
                        return (
                            <div
                                key={u.id}
                                className="user-item"
                                style={{ cursor: !isMe ? 'pointer' : 'default' }}
                                onClick={() => !isMe && onStartDM(u)}
                                title={!isMe ? "Click to DM" : ""}
                            >
                                <div style={{ position: 'relative' }}>
                                    <div className="user-avatar" style={{ background: u.color || '#666' }}>
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '10px',
                                        height: '10px',
                                        background: 'var(--success)',
                                        borderRadius: '50%',
                                        border: '2px solid var(--bg-secondary)'
                                    }} />
                                </div>
                                <div className="user-name">
                                    {u.name} {isMe ? '(You)' : ''}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
