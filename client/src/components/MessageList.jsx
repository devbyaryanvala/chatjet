import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import Poll from './Poll';
import ChatJetIcon from '../assets/ChatJetIcon.png';

export default function MessageList({ messages, userName, socket, onDeleteMessage }) {
    const endRef = useRef(null);

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="messages-container">
                <div className="empty-state" id="emptyState">
                    <div className="empty-state-icon">
                        <img src={ChatJetIcon} alt="ChatJet" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                    </div>
                    <div className="empty-state-text">Welcome to the workspace</div>
                    <div className="empty-state-sub">Start the conversation by sending a message or snippet.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-container" id="messages">
            {messages.map((msg, index) => {
                if (msg.type === 'system') {
                    return (
                        <div key={index} className="message system">
                            <div className="message-content">{msg.text}</div>
                        </div>
                    );
                }

                if (msg.type === 'poll') {
                    return (
                        <Poll
                            key={msg.id}
                            poll={msg}
                            socket={socket}
                            userName={userName}
                        />
                    );
                }

                return (
                    <MessageItem
                        key={msg.id || index}
                        message={msg}
                        isOwn={msg.name === userName}
                        onDelete={() => onDeleteMessage && onDeleteMessage(msg.id)}
                    />
                );
            })}
            <div ref={endRef} />
        </div>
    );
}
