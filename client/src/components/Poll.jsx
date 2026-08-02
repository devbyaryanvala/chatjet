import { BarChart3 } from 'lucide-react';

export default function Poll({ poll, socket, userName }) {
    const totalVotes = poll.options.reduce((a, b) => a + (b.count || 0), 0);

    const handleVote = (idx) => {
        let userId = localStorage.getItem('chatjet_uuid');
        if (!userId) {
            userId = crypto.randomUUID();
            localStorage.setItem('chatjet_uuid', userId);
        }

        socket.emit('vote poll', {
            pollId: poll.id,
            optionIndex: idx,
            voter: userName,
            userId: userId
        });
    };

    return (
        <div className="message poll" id={`poll-${poll.id}`} style={{ alignSelf: 'center', width: '100%', maxWidth: '420px', margin: '0.5rem 0' }}>
            <div className="message-content" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
                    <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                    <span>{poll.question}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {poll.options.map((opt, idx) => {
                        const percent = totalVotes === 0 ? 0 : Math.round(((opt.count || 0) / totalVotes) * 100);
                        return (
                            <div
                                key={idx}
                                onClick={() => handleVote(idx)}
                                style={{
                                    padding: '0.6rem 0.75rem',
                                    background: 'var(--bg-surface-elevated)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{opt.text}</span>
                                    <span style={{ fontWeight: 600, color: '#60a5fa', fontSize: '0.8rem' }}>{percent}%</span>
                                </div>
                                <div style={{ height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${percent}%`, background: 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                    {opt.count || 0} {opt.count === 1 ? 'vote' : 'votes'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    <span>By {poll.creator}</span>
                    <span>Total: {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                </div>
            </div>
        </div>
    );
}
