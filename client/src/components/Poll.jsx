export default function Poll({ poll, socket, userName }) {
    const totalVotes = poll.options.reduce((a, b) => a + b.count, 0);

    const handleVote = (idx) => {
        // Persistent User ID for voting
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
        <div className="message poll" id={`poll-${poll.id}`}>
            <div className="message-content" style={{ background: 'var(--bg-tertiary)', width: '100%', maxWidth: '400px' }}>
                <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.1rem' }}>
                    📊 {poll.question}
                </div>
                <div className="poll-options">
                    {poll.options.map((opt, idx) => {
                        const percent = totalVotes === 0 ? 0 : Math.round((opt.count / totalVotes) * 100);
                        return (
                            <div
                                key={idx}
                                className="poll-option"
                                onClick={() => handleVote(idx)}
                            >
                                <div className="poll-text">
                                    <span>{opt.text}</span>
                                    <span className="poll-percent">{percent}%</span>
                                </div>
                                <div className="poll-bar">
                                    <div className="poll-bar-fill" style={{ width: `${percent}%` }}></div>
                                </div>
                                <div className="poll-meta">
                                    <span className="poll-count">{opt.count} votes</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="poll-total" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                    Total votes: {totalVotes}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Created by {poll.creator}
                </div>
            </div>
        </div>
    );
}
