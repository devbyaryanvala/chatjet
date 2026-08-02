import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import DOMPurify from 'dompurify';

export default function MessageItem({ message, isOwn, onDelete }) {
    const contentRef = useRef(null);
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

                // Detect language from class (e.g., "language-c" or "language-javascript")
                const langClass = Array.from(code.classList).find(c => c.startsWith('language-'));
                let language = langClass ? langClass.replace('language-', '') : '';
                if (!language || language === 'null' || language === 'undefined') {
                    language = 'CODE';
                }

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
                        const copyTextEl = copyBtn.querySelector('.copy-text');
                        if (copyTextEl) copyTextEl.textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            if (copyTextEl) copyTextEl.textContent = 'Copy';
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

    // Parse Markdown safely without double-escaping entities
    const getRenderedContent = () => {
        if (!message.text) return { __html: '' };
        const rawMarkup = marked.parse(message.text, { breaks: true, gfm: true });
        return { __html: DOMPurify.sanitize(rawMarkup) };
    };

    // Robust file download handler converting data-URI / base64 to Blob
    const handleDownload = (e, attachment) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (!attachment || !attachment.data) return;

            if (attachment.data.startsWith('data:')) {
                const parts = attachment.data.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                const mime = mimeMatch ? mimeMatch[1] : (attachment.type || 'application/octet-stream');
                const byteCharacters = atob(parts[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mime });
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = attachment.name || 'download';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
            } else {
                const link = document.createElement('a');
                link.href = attachment.data;
                link.download = attachment.name || 'download';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error('Download failed, using fallback:', err);
            const link = document.createElement('a');
            link.href = attachment.data;
            link.download = attachment.name || 'download';
            link.target = '_blank';
            link.click();
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes || isNaN(bytes)) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileExt = (filename) => {
        if (!filename) return 'FILE';
        const ext = filename.split('.').pop();
        return ext ? ext.toUpperCase() : 'FILE';
    };

    const isImageAttachment = message.attachment && (
        (message.attachment.type || '').startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|svg)$/i.test(message.attachment.name || '')
    );

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
                {message.text && <div dangerouslySetInnerHTML={getRenderedContent()} />}

                {message.attachment && (
                    isImageAttachment ? (
                        <img
                            src={message.attachment.data}
                            alt={message.attachment.name}
                            style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.5rem', display: 'block' }}
                        />
                    ) : (
                        <div className="file-attachment-card">
                            <div className="file-icon" style={{
                                width: '38px',
                                height: '38px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0, 212, 255, 0.15)',
                                border: '1px solid rgba(0, 212, 255, 0.3)',
                                borderRadius: '8px',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                fontSize: '0.75rem'
                            }}>
                                {getFileExt(message.attachment.name).slice(0, 4)}
                            </div>
                            <div className="file-info">
                                <div className="file-name" title={message.attachment.name}>{message.attachment.name}</div>
                                <div className="file-type">
                                    {formatFileSize(message.attachment.size) || 'Attachment'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleDownload(e, message.attachment)}
                                className="btn-download"
                                style={{ cursor: 'pointer', border: '1px solid var(--border-active)' }}
                            >
                                Download
                            </button>
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
