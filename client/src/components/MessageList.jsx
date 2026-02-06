import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import Poll from './Poll';

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
                    <div className="empty-icon">💬</div>
                    <div className="empty-text">No messages yet. Say hello!</div>
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

                if (msg.roomId && msg.options) { // Use msg.type check if consistent, or structure check
                    // 'new poll' logic in ChatScreen adds { ...poll, type: 'poll' }
                    // So we can check msg.type === 'poll' or fallback to structure
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
