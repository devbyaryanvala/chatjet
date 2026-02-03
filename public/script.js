const socket = io();
let userName = '';
let currentRoom = '';
let userColor = '';
let codeModeEnabled = false;
let currentMode = 'public';

// Load saved name
window.addEventListener('DOMContentLoaded', () => {
    // 2-Minute Inactivity Check (Anonymity)
    const lastActive = localStorage.getItem('chatjet_last_active');
    if (lastActive && (Date.now() - parseInt(lastActive) > 2 * 60 * 1000)) {
        console.log("Session expired. Clearing data.");
        localStorage.clear();
    }
    updateActivity(); // Set initial timestamp

    const saved = localStorage.getItem('chatjet_name');
    if (saved) document.getElementById('nameInput').value = saved;

    console.log("%c ChatJet v2.0 ", "background: #6366f1; color: white; padding: 4px; border-radius: 4px;");

    // ... rest of DOMContentLoaded ...
    // Activity Tracker
    function updateActivity() {
        localStorage.setItem('chatjet_last_active', Date.now());
    }

    // Listen for activity
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        window.addEventListener(event, () => {
            // Debounce slightly to avoid thrashing storage
            if (!window.activityThrottled) {
                updateActivity();
                window.activityThrottled = true;
                setTimeout(() => window.activityThrottled = false, 1000);
            }
        });
    });

    // Check for expiry and update timer every second
    setInterval(() => {
        const lastActive = parseInt(localStorage.getItem('chatjet_last_active') || Date.now());
        const now = Date.now();
        const elapsed = now - lastActive;
        const remaining = Math.max(0, 2 * 60 * 1000 - elapsed);

        // Update Timer UI
        const totalSeconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timerEl = document.getElementById('inactivityTimer');

        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (remaining < 30000) { // Less than 30s
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }
        }

        if (remaining <= 0) {
            // Expired
            if (window.leaveRoom) window.leaveRoom();
        }
    }, 1000);

    // Load saved session
    window.addEventListener('DOMContentLoaded', () => {
        const savedName = localStorage.getItem('chatjet_name');
        if (savedName) document.getElementById('nameInput').value = savedName;

        // Check for active session
        const activeSession = localStorage.getItem('chatjet_active_session');
        if (activeSession) {
            try {
                const { roomId, password, name } = JSON.parse(activeSession);
                if (roomId && name) {
                    // Auto-login
                    userName = name;
                    document.getElementById('nameInput').value = name;
                    if (roomId === 'Public') {
                        socket.emit('join public', { name });
                    } else {
                        socket.emit('join room', { name, roomId, password });
                    }
                }
            } catch (e) {
                console.error('Session parse error', e);
            }
        }

        console.log("%c ChatJet v2.0 ", "background: #6366f1; color: white; padding: 4px; border-radius: 4px;");
    });

    // ... existing code ...

    // Room joined handler
    socket.on('room joined', ({ roomId }) => {
        currentRoom = roomId;
        userName = document.getElementById('nameInput').value.trim();

        // Save Session
        const password = document.getElementById('passwordInput').value.trim();
        localStorage.setItem('chatjet_active_session', JSON.stringify({
            roomId,
            password, // stored locally for auto-rejoin
            name: userName
        }));

        localStorage.setItem('chatjet_name', userName);

        document.getElementById('onboarding').style.display = 'none';
        document.getElementById('chatScreen').classList.add('active');
        document.getElementById('roomDisplay').textContent = roomId === 'Public' ? 'Public Chat' : roomId;

        // Restore History
        restoreHistory(roomId);

        document.getElementById('messageInput').focus();

        // ... notifications ...
    });

    // History Management
    function saveToHistory(roomId, type, data) {
        if (!roomId) return;
        const key = `chatjet_hist_${roomId}`;
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) { }

        // Limit history to 50 items
        if (history.length > 50) history.shift();

        history.push({ type, data, timestamp: Date.now() });
        localStorage.setItem(key, JSON.stringify(history));
    }

    function restoreHistory(roomId) {
        const key = `chatjet_hist_${roomId}`;
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        const container = document.getElementById('messages');
        container.innerHTML = ''; // Start clean

        history.forEach(item => {
            if (item.type === 'message') {
                renderMessage(item.data, true); // true = restoration
            } else if (item.type === 'poll') {
                // Render poll (simplified state restoration)
                const div = document.createElement('div');
                div.className = 'message poll';
                div.id = `poll-${item.data.id}`;
                div.innerHTML = renderPollHTML(item.data);
                container.appendChild(div);
            }
        });

        if (history.length === 0) {
            // Show empty state if no history
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.id = 'emptyState';
            empty.innerHTML = '<div class="empty-icon">💬</div><div class="empty-text">No messages yet. Say hello!</div>';
            container.appendChild(empty);
        } else {
            scrollToBottom();
        }
    }

    // Separate render function to reuse
    function renderMessage(data, isRestoring = false) {
        if (!isRestoring) hideEmptyState();

        const isOwn = data.name === userName;
        const msgId = data.id || ('local-' + Date.now());

        // Do not render expired ephemeral messages on restore
        if (isRestoring && data.ephemeral) return;

        if (data.ephemeral) {
            // ... set timeout ...
            setTimeout(() => {
                const el = document.getElementById(`msg-${msgId}`);
                if (el) el.remove();
            }, data.ephemeral);
        }

        const div = document.createElement('div');
        div.className = `message${isOwn ? ' own' : ''}`;
        div.id = `msg-${msgId}`;
        if (data.ephemeral) div.classList.add('ephemeral');

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Generate Avatar
        const avatar = `<div class="user-avatar" style="width: 24px; height: 24px; font-size: 0.7rem; background: ${data.color || '#666'}; margin-right: 0.5rem; display: inline-flex;">${data.name.substring(0, 2).toUpperCase()}</div>`;

        // Handle text content (Secure Escaping)
        const textContent = data.text || data.message || '';
        const safeText = textContent.replace(/</g, "&lt;");
        let renderedContent = marked.parse(safeText);

        // Append Attachment HTML if present
        if (data.attachment) {
            if (data.attachment.type.startsWith('image/')) {
                renderedContent += `<img src="${data.attachment.data}" alt="${data.attachment.name}" style="max-width:100%; border-radius:8px; margin-top:0.5rem; display:block;">`;
            } else {
                renderedContent += `
                 <div class="file-attachment-card">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(data.attachment.name)}</div>
                        <div class="file-type">Attachment</div>
                    </div>
                    <a href="${data.attachment.data}" download="${data.attachment.name}" class="btn-download">Download</a>
                 </div>`;
            }
        }

        const ephemeralBadge = data.ephemeral ? `<span style="font-size:0.7em; color:#f43f5e; margin-left:5px;">To ensure privacy, this message self-destructs... 🔥</span>` : '';

        div.innerHTML = `
                <div class="message-header" style="${isOwn ? 'justify-content: flex-end;' : ''}">
                    ${!isOwn ? avatar : ''}
                    <span class="message-author" style="color: ${data.color}">${escapeHtml(data.name)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">
                    ${renderedContent}
                    ${ephemeralBadge}
                </div>`;

        div.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });

        document.getElementById('messages').appendChild(div);

        // DOM Recycling: Limit to 100 messages
        const container = document.getElementById('messages');
        if (container.children.length > 100) {
            container.removeChild(container.firstChild);
        }

        if (!isRestoring) scrollToBottom();
    }

    // Updated Handlers to use render and save logic
    socket.on('chat message', (data) => {
        // Save to history
        saveToHistory(currentRoom, 'message', data);
        renderMessage(data);

        // Notification logic
        // if (data.name !== userName && document.hidden && Notification.permission === 'granted') {
        //     new Notification(`New message from ${data.name}`, { body: data.message });
        // }
    });

    socket.on('new poll', (poll) => {
        saveToHistory(currentRoom, 'poll', poll);
        // ... existing render ...
        hideEmptyState();
        const div = document.createElement('div');
        div.className = 'message poll';
        div.id = `poll-${poll.id}`;
        div.innerHTML = renderPollHTML(poll);
        document.getElementById('messages').appendChild(div);
        scrollToBottom();
    });

    // Leave room - expose to window for onclick
    window.leaveRoom = function () {
        localStorage.clear();
        location.reload();
    };
}); // Close DOMContentLoaded

// Dev tool to show private mode
window.EPM = function () {
    document.getElementById('privateModeBtn').style.display = 'flex';
    console.log("🔒 Private Mode Enabled");
    return "Secret unlocked!";
};

let typingTimeout;

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const privateFields = document.getElementById('privateFields');
    const joinBtn = document.getElementById('joinBtn');
    const createBtn = document.getElementById('createBtn');

    if (mode === 'private') {
        privateFields.classList.add('visible');
        joinBtn.textContent = 'Join Room';
        joinBtn.onclick = joinPrivateRoom;
        createBtn.style.display = 'block';
    } else {
        privateFields.classList.remove('visible');
        joinBtn.textContent = 'Join Public Chat';
        joinBtn.onclick = joinPublic;
        createBtn.style.display = 'none';
    }
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        // Determine behavior for desktop if needed, currently persistent
    }
}

// Join Public
function joinPublic() {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) return alert('Please enter your name');
    socket.emit('join public', { name });
}

// Join Private
function joinPrivateRoom() {
    const name = document.getElementById('nameInput').value.trim();
    const roomId = document.getElementById('roomInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    if (!name || !roomId || !password) return alert('Please fill all fields');
    socket.emit('join room', { name, roomId, password });
}

// Create Private
function createPrivateRoom() {
    const name = document.getElementById('nameInput').value.trim();
    const roomId = document.getElementById('roomInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    if (!name || !roomId || !password) return alert('Please fill all fields');
    socket.emit('create room', { name, roomId, password });
}

// Room joined handler
socket.on('room joined', ({ roomId }) => {
    currentRoom = roomId;
    userName = document.getElementById('nameInput').value.trim();
    localStorage.setItem('chatjet_name', userName);

    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('chatScreen').classList.add('active');
    document.getElementById('roomDisplay').textContent = roomId === 'Public' ? 'Public Chat' : roomId;
    document.getElementById('messageInput').focus();

    // Notification permission
    // if (Notification.permission === 'default') {
    //     Notification.requestPermission();
    // }
});

socket.on('color', (color) => userColor = color);

socket.on('error', (msg) => alert(msg));

// User List Updates
socket.on('room users', (users) => {
    const list = document.getElementById('userList');
    list.innerHTML = users.map(u => {
        const isMe = u.name === userName; // Don't DM self
        const clickAttr = !isMe ? `onclick="startDM('${u.id}', '${escapeHtml(u.name)}')" style="cursor:pointer;" title="Click to DM"` : '';
        return `
                <div class="user-item" ${clickAttr}>
                    <div class="user-avatar" style="background: ${u.color || '#666'}">${u.name.substring(0, 2).toUpperCase()}</div>
                    <div class="user-name">${escapeHtml(u.name)} ${isMe ? '(You)' : ''}</div>
                </div>
            `}).join('');
});

// Direct Messages with Notifications
function startDM(targetId, targetName) {
    // Deterministic Room ID
    const safeUser = userName.replace(/[^a-zA-Z0-9]/g, '');
    const safeTarget = targetName.replace(/[^a-zA-Z0-9]/g, '');
    const participants = [safeUser, safeTarget].sort();
    const dmRoomId = `DM-${participants[0]}-${participants[1]}`;

    // Instead of auto-joining, we invite.
    // But wait, user requested "request for room joining comes".
    // So User A joins, then sends invite to User B.

    socket.emit('join room', { name: userName, roomId: dmRoomId, password: 'dm' });

    // Handle creation if needed (optimistic)
    const tempHandler = (msg) => {
        if (msg === 'Room does not exist') {
            socket.off('error', tempHandler);
            socket.emit('create room', { name: userName, roomId: dmRoomId, password: 'dm' });
            // After creating, invite the user
            setTimeout(() => {
                socket.emit('invite user', { targetId, roomId: dmRoomId, inviterName: userName });
                addSystemMessage(`Invited ${targetName} to private chat.`);
            }, 500);
        }
    };
    socket.on('error', tempHandler);

    // If join successful (we are already in or just joined), send invite
    // We need a way to know if join succeeded to send invite.
    // Simpler: Just send invite anyway. If they are already here, no harm.
    socket.emit('invite user', { targetId, roomId: dmRoomId, inviterName: userName });
    addSystemMessage(`Joined private chat. Inviting ${targetName}...`);
}

// Handle Invites
socket.on('invite received', ({ roomId, inviterName }) => {
    const notifArea = document.getElementById('notificationsArea');
    const list = document.getElementById('notificationList');

    notifArea.style.display = 'block';

    const div = document.createElement('div');
    div.className = 'notification-item';
    div.style.cssText = 'background:var(--bg-tertiary); padding:0.5rem; margin-bottom:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); font-size:0.85rem;';
    div.innerHTML = `
                <div style="margin-bottom:0.5rem"><strong>${escapeHtml(inviterName)}</strong> invited you to chat.</div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-primary" style="padding:0.25rem 0.5rem; margin:0; font-size:0.75rem;" onclick="acceptInvite('${roomId}', this)">Join</button>
                    <button class="btn-secondary" style="padding:0.25rem 0.5rem; margin:0; font-size:0.75rem;" onclick="this.parentElement.parentElement.remove()">Ignore</button>
                </div>
            `;
    list.appendChild(div);
});

function acceptInvite(roomId, btn) {
    socket.emit('join room', { name: userName, roomId, password: 'dm' });
    // Handle create outcome just in case? Usually inviter created it.
    // Remove notification
    btn.parentElement.parentElement.remove();
    if (document.getElementById('notificationList').children.length === 0) {
        document.getElementById('notificationsArea').style.display = 'none';
    }
}

// Typing Indicators
const messageInput = document.getElementById('messageInput');
messageInput.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing');
    }, 1000);

    // Auto resize
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
});

socket.on('user typing', ({ name }) => {
    const indicator = document.getElementById('typingIndicator');
    indicator.textContent = `${name} is typing...`;
    indicator.classList.add('active');
});

socket.on('user stop typing', () => {
    document.getElementById('typingIndicator').classList.remove('active');
});

// System messages
socket.on('system message', (msg) => {
    hideEmptyState();
    const div = document.createElement('div');
    div.className = 'message system';
    div.innerHTML = `<div class="message-content">${escapeHtml(msg)}</div>`;
    document.getElementById('messages').appendChild(div);
    scrollToBottom();
});

// File Attachment Logic
let pendingAttachment = null;

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB
        alert('File is too large. Max size is 5MB.');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function () {
        pendingAttachment = {
            name: file.name,
            type: file.type,
            data: reader.result
        };

        // Show Preview
        const preview = document.getElementById('attachmentPreview');
        const nameEl = document.getElementById('previewName');
        nameEl.textContent = file.name;
        preview.style.display = 'flex';

        // Clear input so same file can be selected again if needed (after clearing)
        input.value = '';
        document.getElementById('messageInput').focus();
    }
}

function clearAttachment() {
    pendingAttachment = null;
    document.getElementById('attachmentPreview').style.display = 'none';
}

// [Fragments Removed]

socket.on('update poll', ({ pollId, options, totalVotes }) => {
    console.log(`Update received for ${pollId}, Total: ${totalVotes}`);
    const pollEl = document.getElementById(`poll-${pollId}`);
    if (pollEl) {
        // Update bars and counts
        options.forEach((opt, idx) => {
            const row = pollEl.querySelector(`[data-idx="${idx}"]`);
            if (row) {
                const percent = totalVotes === 0 ? 0 : Math.round((opt.count / totalVotes) * 100);
                row.querySelector('.poll-bar-fill').style.width = `${percent}%`;
                row.querySelector('.poll-count').textContent = `${opt.count} votes`;
                row.querySelector('.poll-percent').textContent = `${percent}%`;
            }
        });

        // Update total
        const totalEl = pollEl.querySelector('.poll-total');
        if (totalEl) totalEl.textContent = `Total votes: ${totalVotes}`;
    }
});

window.vote = function (pollId, idx) {
    console.log(`Clicking vote: ${pollId}, Option: ${idx}`);
    socket.emit('vote poll', { pollId, optionIndex: idx, voter: userName });
};

function renderPollHTML(poll) {
    const optionsHTML = poll.options.map((opt, idx) => `
        <div class="poll-option" onclick="vote('${poll.id}', ${idx})" data-idx="${idx}">
            <div class="poll-text">
                <span>${escapeHtml(opt.text)}</span>
                <span class="poll-percent">0%</span>
            </div>
            <div class="poll-bar">
                <div class="poll-bar-fill" style="width: 0%"></div>
            </div>
            <div class="poll-meta">
                <span class="poll-count">0 votes</span>
            </div>
        </div>
    `).join('');

    return `
        <div class="message-content" style="background:var(--bg-tertiary); width:100%; max-width:400px;">
            <div style="font-weight:700; margin-bottom:1rem; font-size:1.1rem;">📊 ${escapeHtml(poll.question)}</div>
            <div class="poll-options">
                ${optionsHTML}
            </div>
            <div class="poll-total" style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem; text-align:right;">Total votes: 0</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Created by ${escapeHtml(poll.creator)}</div>
        </div>
    `;
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text && !pendingAttachment) return;

    // Slash Commands (Text only)
    if (text.startsWith('/') && !pendingAttachment) {
        handleSlashCommand(text);
        input.value = '';
        input.style.height = 'auto';
        return;
    }

    // Emit object payload
    socket.emit('chat message', {
        text: text,
        attachment: pendingAttachment
    });

    input.value = '';
    input.style.height = 'auto';
    clearAttachment();
    socket.emit('stop typing');
}

function handleSlashCommand(cmd) {
    const parts = cmd.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case '/clear':
            document.getElementById('messages').innerHTML = '';
            addSystemMessage('Chat cleared locally.');
            break;
        case '/roll':
            const max = args[0] ? parseInt(args[0]) : 100;
            const roll = Math.floor(Math.random() * max) + 1;
            socket.emit('chat message', { text: `🎲 I rolled a **${roll}** (1-${max})` });
            break;
        case '/shrug':
            socket.emit('chat message', { text: `¯\\_(ツ)_/¯` });
            break;
        case '/burn':
            // Send ephemeral message
            const secretMsg = args.join(' ');
            if (!secretMsg) return addSystemMessage('Usage: /burn <message>');
            socket.emit('chat message', { text: `🔥 [Self-destructing] ${secretMsg} ||ephemeral|10000||` });
            break;
        case '/poll':
            // Format: /poll Question | Opt1 | Opt2
            const wholeLine = args.join(' ');
            const pollParts = wholeLine.split('|').map(s => s.trim()).filter(s => s.length > 0);

            if (pollParts.length < 3) {
                return addSystemMessage('Usage: /poll Question | Option 1 | Option 2 ...');
            }

            const question = pollParts[0];
            const options = pollParts.slice(1);

            socket.emit('create poll', { question, options, roomId: currentRoom || 'Public', creator: userName });
            break;
        case '/help':
            addSystemMessage(`
                        **Available Commands:**
                        - \`/clear\`: Clear local chat
                        - \`/poll Q | Opt1 | Opt2\`: Create a poll
                        - \`/roll [max]\`: Roll a dice
                        - \`/shrug\`: Send shrug
                        - \`/burn <msg>\`: Send message that deletes in 10s
                    `);
            break;
        default:
            addSystemMessage('Unknown command. Try /help');
    }
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'message system';
    div.innerHTML = `<div class="message-content">${marked.parse(text)}</div>`;
    document.getElementById('messages').appendChild(div);
    scrollToBottom();
}

// Code mode toggle
function toggleCodeMode() {
    codeModeEnabled = !codeModeEnabled;
    const btn = document.getElementById('codeToggle');
    btn.classList.toggle('active', codeModeEnabled);

    const input = document.getElementById('messageInput');
    if (codeModeEnabled) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        input.value = before + "```\n\n```" + after;
        // Move cursor inside
        const cursorPosition = start + 4;
        input.setSelectionRange(cursorPosition, cursorPosition);
        input.focus();
    }
}

// Leave room
function leaveRoom() {
    location.reload();
}

// Auto-resize textarea
// const msgInput = document.getElementById('messageInput'); // This is now declared globally for typing indicator
// msgInput.addEventListener('input', () => { // This is now part of the typing indicator logic
//     msgInput.style.height = 'auto';
//     msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
// });

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('messages');
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

function hideEmptyState() {
    const empty = document.getElementById('emptyState');
    if (empty) empty.remove();
}