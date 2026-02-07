import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import DOMPurify from 'dompurify';

export default function MessageItem({ message, isOwn, onDelete }) {
    const contentRef = useRef(null);
    const [copiedId, setCopiedId] = useState(null);
    const [isExpired, setIsExpired] = useState(false);
    const [countdown, setCountdown] = useState(null);

    // Ephemeral message countdown and auto-delete
    useEffect(() => {
        if (message.ephemeral > 0 && !isExpired) {
            const startTime = Date.now();
            const endTime = startTime + message.ephemeral;

            const interval = setInterval(() => {
                const remaining = Math.max(0, endTime - Date.now());
                setCountdown(Math.ceil(remaining / 1000));

                if (remaining <= 0) {
                    clearInterval(interval);
                    setIsExpired(true);
                }
            }, 100);

            return () => clearInterval(interval);
        }
    }, [message.ephemeral, isExpired]);

    useEffect(() => {
        if (contentRef.current) {
            // Process code blocks: add language labels and copy buttons
            const preElements = contentRef.current.querySelectorAll('pre');

            preElements.forEach((pre, index) => {
                // Skip if already processed
                if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

                const code = pre.querySelector('code');
                if (!code) return;

                // Detect language from class (e.g., "language-javascript")
                const langClass = Array.from(code.classList).find(c => c.startsWith('language-'));
                const language = langClass ? langClass.replace('language-', '') : 'code';

                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';

                // Create header with language label and copy button
                const header = document.createElement('div');
                header.className = 'code-block-header';
                header.innerHTML = `
                    <span class="code-language">${language.toUpperCase()}</span>
                    <button class="code-copy-btn" data-code-index="${index}">
                        <span class="copy-icon">📋</span>
                        <span class="copy-text">Copy</span>
                    </button>
                `;

                // Insert wrapper
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(header);
                wrapper.appendChild(pre);

                // Add copy functionality
                const copyBtn = header.querySelector('.code-copy-btn');
                copyBtn.addEventListener('click', () => {
                    const codeText = code.textContent;
                    navigator.clipboard.writeText(codeText).then(() => {
                        copyBtn.querySelector('.copy-text').textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.querySelector('.copy-text').textContent = 'Copy';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    });
                });
            });

            // Highlight syntax
            Prism.highlightAllUnder(contentRef.current);
        }
    }, [message.text]);

    // Don't render if ephemeral message has expired (must be after all hooks)
    if (isExpired) {
        return null;
    }

    // Use actual timestamp from message, fallback to current time
    const time = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Avatar generator
    const avatarContent = message.name ? message.name.substring(0, 2).toUpperCase() : '??';

    // Escape HTML entities to prevent rendering raw HTML
    const escapeHtml = (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    };

    // Parse Markdown safely
    const getRenderedContent = () => {
        if (!message.text) return { __html: '' };
        const escapedText = escapeHtml(message.text);
        const rawMarkup = marked.parse(escapedText);
        return { __html: DOMPurify.sanitize(rawMarkup) };
    };

    return (
        <div className={`message ${isOwn ? 'own' : ''}`} id={`msg-${message.id}`}>
            <div className={`message-header`} style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                {!isOwn && (
                    <div
                        className="user-avatar"
                        style={{
                            width: '24px',
                            height: '24px',
                            fontSize: '0.7rem',
                            background: message.color || '#666',
                            marginRight: '0.5rem',
                            display: 'inline-flex'
                        }}
                    >
                        {avatarContent}
                    </div>
                )}
                <span className="message-author" style={{ color: message.color }}>{message.name}</span>
                <span className="message-time">{time}</span>
                {isOwn && onDelete && (
                    <button
                        className="delete-msg-btn"
                        onClick={onDelete}
                        title="Delete Message"
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="message-content" ref={contentRef}>
                <div dangerouslySetInnerHTML={getRenderedContent()} />

                {message.attachment && (
                    message.attachment.type.startsWith('image/') ? (
                        <img
                            src={message.attachment.data}
                            alt={message.attachment.name}
                            style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.5rem', display: 'block' }}
                        />
                    ) : (
                        <div className="file-attachment-card">
                            <div className="file-icon">📄</div>
                            <div className="file-info">
                                <div className="file-name">{message.attachment.name}</div>
                                <div className="file-type">Attachment</div>
                            </div>
                            <a href={message.attachment.data} download={message.attachment.name} className="btn-download">Download</a>
                        </div>
                    )
                )}

                {message.ephemeral > 0 && countdown !== null && (
                    <span style={{ fontSize: '0.7em', color: '#f43f5e', marginLeft: '5px' }}>
                        🔥 Self-destructs in {countdown}s...
                    </span>
                )}
            </div>
        </div>
    );
}
