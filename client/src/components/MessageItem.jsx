import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Download, Trash2, Copy, Check, FileText } from 'lucide-react';
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
import { getAvatarUrl } from '../utils/avatar';

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
            const preElements = contentRef.current.querySelectorAll('pre');

            preElements.forEach((pre, index) => {
                if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

                const code = pre.querySelector('code');
                if (!code) return;

                const langClass = Array.from(code.classList).find(c => c.startsWith('language-'));
                let language = langClass ? langClass.replace('language-', '') : '';
                if (!language || language === 'null' || language === 'undefined') {
                    language = 'CODE';
                }

                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';

                const header = document.createElement('div');
                header.className = 'code-block-header';
                header.innerHTML = `
                    <span class="code-language">${language.toUpperCase()}</span>
                    <button class="code-copy-btn" data-code-index="${index}">
                        <span class="copy-text">Copy</span>
                    </button>
                `;

                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(header);
                wrapper.appendChild(pre);

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

            Prism.highlightAllUnder(contentRef.current);
        }
    }, [message.text]);

    if (isExpired) {
        return null;
    }

    const time = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const avatarContent = message.name ? message.name.substring(0, 2).toUpperCase() : '??';

    const getRenderedContent = () => {
        if (!message.text) return { __html: '' };
        const rawMarkup = marked.parse(message.text, { breaks: true, gfm: true });
        return { __html: DOMPurify.sanitize(rawMarkup) };
    };

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

    const isImageAttachment = message.attachment && message.attachment.data && (
        (message.attachment.type || '').startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|svg)$/i.test(message.attachment.name || '')
    );

    const isAudioAttachment = message.attachment && message.attachment.data && (
        (message.attachment.type || '').startsWith('audio/') ||
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(message.attachment.name || '')
    );

    const isVideoAttachment = message.attachment && message.attachment.data && (
        (message.attachment.type || '').startsWith('video/') ||
        /\.(mp4|webm|ogv|mov)$/i.test(message.attachment.name || '')
    );

    return (
        <div className={`message ${isOwn ? 'own' : ''}`} id={`msg-${message.id}`}>
            <div className="message-header">
                {!isOwn && (
                    <div
                        className="user-avatar"
                        style={{
                            background: message.color || '#3b82f6',
                        }}
                    >
                        <img
                            src={message.avatar || getAvatarUrl(message.name)}
                            alt={message.name}
                            className="user-avatar-img"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                        <span className="user-avatar-initials">{avatarContent}</span>
                    </div>
                )}
                <span className="message-author" style={{ color: message.color || '#94a3b8' }}>{message.name}</span>
                <span className="message-time">{time}</span>
                {isOwn && onDelete && (
                    <button
                        className="delete-msg-btn"
                        onClick={onDelete}
                        title="Delete Message"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            <div className="message-content" ref={contentRef}>
                {message.text && <div dangerouslySetInnerHTML={getRenderedContent()} />}

                {message.attachment && (
                    isImageAttachment ? (
                        <div style={{ marginTop: '0.5rem' }}>
                            <img
                                src={message.attachment.data}
                                alt={message.attachment.name}
                                style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: 'var(--radius-sm)', display: 'block', objectFit: 'contain' }}
                            />
                        </div>
                    ) : isAudioAttachment ? (
                        <div style={{ marginTop: '0.5rem', width: '100%' }}>
                            <audio
                                controls
                                src={message.attachment.data}
                                style={{ width: '100%', borderRadius: 'var(--radius-sm)', display: 'block', outline: 'none' }}
                            />
                            <div className="file-attachment-card" style={{ marginTop: '0.4rem' }}>
                                <div className="file-icon-badge">
                                    {getFileExt(message.attachment.name).slice(0, 4)}
                                </div>
                                <div className="file-info">
                                    <div className="file-name" title={message.attachment.name}>{message.attachment.name}</div>
                                    <div className="file-type">
                                        {formatFileSize(message.attachment.size) || 'Audio Attachment'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => handleDownload(e, message.attachment)}
                                    className="btn-download"
                                >
                                    <Download size={13} />
                                    <span>Download</span>
                                </button>
                            </div>
                        </div>
                    ) : isVideoAttachment ? (
                        <div style={{ marginTop: '0.5rem', width: '100%' }}>
                            <video
                                controls
                                src={message.attachment.data}
                                style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: 'var(--radius-sm)', display: 'block' }}
                            />
                        </div>
                    ) : (
                        <div className="file-attachment-card">
                            <div className="file-icon-badge">
                                {getFileExt(message.attachment.name).slice(0, 4)}
                            </div>
                            <div className="file-info">
                                <div className="file-name" title={message.attachment.name}>{message.attachment.name}</div>
                                <div className="file-type">
                                    {formatFileSize(message.attachment.size) || 'Attachment'}
                                </div>
                            </div>
                            {message.attachment.data && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDownload(e, message.attachment)}
                                    className="btn-download"
                                >
                                    <Download size={13} />
                                    <span>Download</span>
                                </button>
                            )}
                        </div>
                    )
                )}

                {message.ephemeral > 0 && countdown !== null && (
                    <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'inline-block', marginTop: '0.35rem' }}>
                        ⏳ Expiring in {countdown}s...
                    </span>
                )}
            </div>
        </div>
    );
}
