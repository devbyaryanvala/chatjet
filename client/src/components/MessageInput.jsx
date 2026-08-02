import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Code2, X, FileText, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';

// Register languages for detection
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);

function detectLanguage(code) {
    if (!code || code.trim().length < 8) return null;
    try {
        const result = hljs.highlightAuto(code);
        if (result.relevance > 4 && result.language) {
            return result.language;
        }
    } catch (e) {
        console.warn('Language detection failed:', e);
    }
    return null;
}

export default function MessageInput({ socket, currentRoom, userName, onSendMessage }) {
    const [text, setText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [codeMode, setCodeMode] = useState(false);
    const [codeLanguage, setCodeLanguage] = useState(null);

    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const detectTimeoutRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
        }
    }, [text]);

    const handleInput = (e) => {
        const newText = e.target.value;
        setText(newText);

        if (codeMode) {
            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
            detectTimeoutRef.current = setTimeout(() => {
                const detected = detectLanguage(newText);
                if (detected) {
                    setCodeLanguage(detected);
                }
            }, 250);
        }

        if (!isTyping) {
            setIsTyping(true);
            socket.emit('typing');
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('stop typing');
        }, 1000);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !codeMode) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Enter' && e.ctrlKey && codeMode) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (!text.trim() && !attachment) return;

        let finalText = text;

        if (codeMode && text.trim()) {
            const lang = (codeLanguage && codeLanguage !== 'null') ? codeLanguage : (detectLanguage(text) || '');
            finalText = `\`\`\`${lang}\n${text}\n\`\`\``;
        }

        onSendMessage({ text: finalText, attachment });

        setText('');
        setAttachment(null);
        setCodeMode(false);
        setCodeLanguage(null);
        setIsTyping(false);
        socket.emit('stop typing');

        if (textareaRef.current) textareaRef.current.focus();
    };

    const toggleCodeMode = () => {
        const nextMode = !codeMode;
        setCodeMode(nextMode);
        if (nextMode && text.trim()) {
            setCodeLanguage(detectLanguage(text));
        } else {
            setCodeLanguage(null);
        }
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large. Maximum allowed size is 10MB.');
            return;
        }

        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const mimeMap = {
            c: 'text/x-c',
            cpp: 'text/x-c++src',
            cc: 'text/x-c++src',
            cxx: 'text/x-c++src',
            h: 'text/x-chdr',
            hpp: 'text/x-c++hdr',
            cs: 'text/x-csharp',
            java: 'text/x-java',
            py: 'text/x-python',
            js: 'text/javascript',
            jsx: 'text/javascript',
            ts: 'text/typescript',
            tsx: 'text/typescript',
            json: 'application/json',
            html: 'text/html',
            htm: 'text/html',
            css: 'text/css',
            md: 'text/markdown',
            txt: 'text/plain',
            sql: 'text/x-sql',
            sh: 'application/x-sh',
            bash: 'application/x-sh',
            rs: 'text/x-rust',
            go: 'text/x-go',
            php: 'text/x-php',
            rb: 'text/x-ruby',
            swift: 'text/x-swift',
            kt: 'text/x-kotlin',
            pdf: 'application/pdf',
            zip: 'application/zip'
        };

        const resolvedType = file.type || mimeMap[ext] || 'application/octet-stream';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            setAttachment({
                name: file.name,
                type: resolvedType,
                size: file.size,
                data: reader.result
            });
        };
        e.target.value = '';
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="input-container">
            {codeMode && (
                <div className="code-mode-chip">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Code2 size={14} style={{ color: '#60a5fa' }} />
                        <span style={{ fontWeight: 600 }}>Code Mode</span>
                        <span style={{
                            padding: '1px 6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#93c5fd',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {codeLanguage ? codeLanguage.toUpperCase() : 'AUTO-DETECT'}
                        </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Press Ctrl+Enter to send
                    </span>
                </div>
            )}

            {attachment && (
                <div className="attachment-preview-box">
                    <div className="file-icon-badge">
                        <FileText size={18} />
                    </div>
                    <div className="file-info">
                        <div className="file-name">{attachment.name}</div>
                        <div className="file-type">{formatFileSize(attachment.size)} • Ready to send</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Remove attachment"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="input-bar">
                <button
                    type="button"
                    className="input-icon-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach File"
                >
                    <Paperclip size={18} />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                <textarea
                    className="chat-textarea"
                    ref={textareaRef}
                    placeholder={codeMode ? "Paste or write snippet code here... (Ctrl+Enter to send)" : "Type a message... (Press Enter to send, Shift+Enter for new line)"}
                    rows={1}
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    style={codeMode ? {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem'
                    } : {}}
                />

                <button
                    type="button"
                    className={`input-icon-btn ${codeMode ? 'active' : ''}`}
                    onClick={toggleCodeMode}
                    title="Toggle Code Snippet Mode"
                >
                    <Code2 size={18} />
                </button>

                <button
                    type="button"
                    className="btn-send-msg"
                    onClick={handleSend}
                    disabled={!text.trim() && !attachment}
                    title="Send Message"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
