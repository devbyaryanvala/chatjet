import { useEffect } from 'react';
import { Users, Check, X, MessageSquarePlus, Bell, ChevronRight, PanelRightClose } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

export default function Sidebar({
    socket,
    users,
    userName,
    onStartDM,
    inviteRequests = [],
    onAcceptInvite,
    onDeclineInvite,
    isOpen = true,
    onClose
}) {
    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={onClose}
                    title="Click to close sidebar"
                />
            )}

            <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`} id="sidebar">
                <div className="sidebar-inner">
                    <div className="sidebar-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={16} />
                            <span>Workspace Members</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="sidebar-count-badge">{users.length}</span>
                            <button
                                type="button"
                                className="sidebar-collapse-btn"
                                onClick={onClose}
                                title="Collapse Sidebar"
                            >
                                <PanelRightClose size={16} />
                            </button>
                        </div>
                    </div>

                    {inviteRequests.length > 0 && (
                        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                marginBottom: '0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                            }}>
                                <Bell size={13} />
                                <span>Direct Message Requests</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {inviteRequests.map(req => (
                                    <div key={req.id} style={{
                                        padding: '0.65rem 0.75rem',
                                        background: 'var(--bg-surface-elevated)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border-default)'
                                    }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                            <strong>{req.fromName}</strong> invited you to a direct chat
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => onAcceptInvite(req)}
                                                style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    background: 'var(--success)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-xs)',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600
                                                }}
                                            >
                                                <Check size={12} /> Accept
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeclineInvite(req)}
                                                style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    background: 'var(--bg-surface)',
                                                    color: 'var(--text-secondary)',
                                                    border: '1px solid var(--border-default)',
                                                    borderRadius: 'var(--radius-xs)',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem'
                                                }}
                                            >
                                                <X size={12} /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="user-list">
                        {users.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2.5rem 1rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.8125rem'
                            }}>
                                No active members
                            </div>
                        ) : (
                            users.map(u => {
                                const isMe = u.name === userName;
                                const avatarSrc = u.avatar || getAvatarUrl(u.name || u.id);
                                return (
                                    <div
                                        key={u.id}
                                        className="user-item"
                                        onClick={() => !isMe && onStartDM(u)}
                                        title={!isMe ? `Direct message ${u.name}` : 'You'}
                                    >
                                        <div className="user-item-avatar-wrap">
                                            <div className="user-item-avatar" style={{ background: u.color || '#3b82f6' }}>
                                                <img
                                                    src={avatarSrc}
                                                    alt={u.name}
                                                    className="user-item-avatar-img"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                                <span className="user-avatar-initials">
                                                    {u.name ? u.name.substring(0, 2).toUpperCase() : '??'}
                                                </span>
                                            </div>
                                            <span className="online-dot" />
                                        </div>
                                        <div className="user-item-name">
                                            {u.name}
                                        </div>
                                        {isMe ? (
                                            <span className="user-item-badge">(You)</span>
                                        ) : (
                                            <span className="user-item-badge" style={{ opacity: 0.7 }}>
                                                <MessageSquarePlus size={14} />
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
