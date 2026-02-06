import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, Code, X } from 'lucide-react';
import hljs from 'highlight.js/lib/core';

// Register languages for detection
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml'; // HTML
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

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust', 'kotlin', 'swift', 'php', 'ruby', 'css', 'html', 'json', 'sql', 'bash'];

// Detect language using highlight.js auto-detection
function detectLanguage(code) {
    if (!code || code.trim().length < 10) return null;

    try {
        const result = hljs.highlightAuto(code);
        // Only return if we have reasonable confidence (relevance > 5)
        if (result.relevance > 5 && result.language) {
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

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
        }
    }, [text]);

    const handleInput = (e) => {
        const newText = e.target.value;
        setText(newText);

        // Auto-detect language in code mode (debounced)
        if (codeMode) {
            if (detectTimeoutRef.current) clearTimeout(detectTimeoutRef.current);
            detectTimeoutRef.current = setTimeout(() => {
                const detected = detectLanguage(newText);
                if (detected) {
                    setCodeLanguage(detected);
                }
            }, 300);
        }


        // Typing indicator
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
        // In code mode, Enter adds a new line, Ctrl+Enter sends
        if (e.key === 'Enter' && e.ctrlKey && codeMode) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (!text.trim() && !attachment) return;

        let finalText = text;

        // Wrap in code block if code mode is active
        if (codeMode && text.trim()) {
            finalText = `\`\`\`${codeLanguage}\n${text}\n\`\`\``;
        }

        // Let parent handle slash commands or just emitting
        onSendMessage({ text: finalText, attachment });

        setText('');
        setAttachment(null);
        setCodeMode(false);
        setIsTyping(false);
        socket.emit('stop typing');

        if (textareaRef.current) textareaRef.current.focus();
    };

    const toggleCodeMode = () => {
        setCodeMode(!codeMode);
        setShowLangDropdown(false);
        if (textareaRef.current) textareaRef.current.focus();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Max size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            setAttachment({
                name: file.name,
                type: file.type,
                data: reader.result
            });
        };
        e.target.value = ''; // Reset input
    };

    return (
        <div className="input-area">
            <div style={{ position: 'relative' }}>
                {/* Code mode indicator */}
                {codeMode && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Code size={14} style={{ color: 'var(--accent-primary)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>Code Mode</span>
                            <span style={{
                                padding: '0.2rem 0.5rem',
                                background: codeLanguage ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
                                border: codeLanguage ? '1px solid var(--success)' : '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                color: codeLanguage ? 'var(--success)' : 'var(--text-muted)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                transition: 'all 0.3s ease'
                            }}>
                                {codeLanguage ? `✓ ${codeLanguage.toUpperCase()}` : 'detecting...'}
                            </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            Ctrl+Enter to send
                        </span>
                    </div>
                )}


                {attachment && (
                    <div id="attachmentPreview" style={{
                        display: 'flex', marginBottom: '0.5rem', padding: '0.5rem',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)', alignItems: 'center', gap: '0.75rem'
                    }}>
                        <div style={{ fontSize: '1.5rem' }}>📄</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {attachment.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ready to send</div>
                        </div>
                        <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', fontSize: '1.2rem' }}>
                            <X size={18} />
                        </button>
                    </div>
                )}

                <div className="input-wrapper">
                    <button className="btn-icon" onClick={() => fileInputRef.current.click()} title="Attach File">
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />

                    <textarea
                        className="message-input"
                        ref={textareaRef}
                        placeholder={codeMode ? "Paste or type your code here..." : "Type a message..."}
                        rows={codeMode ? 4 : 1}
                        value={text}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        style={codeMode ? {
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: '0.85rem',
                            background: '#0d0d12',
                            borderColor: 'var(--accent-primary)'
                        } : {}}
                    />

                    <div className="input-actions">
                        <button
                            className={`btn-icon ${codeMode ? 'active' : ''}`}
                            onClick={toggleCodeMode}
                            title="Code Mode"
                        >
                            <Code size={20} />
                        </button>
                        <button className="btn-send" onClick={handleSend}>
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
