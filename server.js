const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 5e6 // 5 MB for file uploads
});

// --- Better Logging Helper ---
const log = {
    info: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ✅ ${msg}`),
    warn: (msg) => console.log(`[${new Date().toLocaleTimeString()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toLocaleTimeString()}] ❌ ${msg}`)
};


const userColors = {};
const polls = {}; // Global poll store
const userNames = {};
const activeRooms = {}; // { roomId: { password: '...', users: [] } }
const userRooms = {}; // { socketId: roomId }

io.on('connection', (socket) => {
    log.info(`User connected: ${socket.id}`);

    const color = getRandomColor();
    userColors[socket.id] = color;
    socket.emit('color', color);

    socket.on('disconnect', () => {
        log.info(`User disconnected: ${socket.id}`);
        const roomId = userRooms[socket.id];
        if (roomId && activeRooms[roomId]) {
            // Remove user from room user list
            activeRooms[roomId].users = activeRooms[roomId].users.filter(id => id !== socket.id);
            // Optional: Delete room if empty
            if (activeRooms[roomId].users.length === 0) {
                delete activeRooms[roomId];
                log.info(`Room ${roomId} deleted (empty)`);
            }
        }
        delete userColors[socket.id];
        delete userNames[socket.id];
        delete userRooms[socket.id];
    });


    // Helper to leave previous room
    function leavePreviousRoom(socket) {
        const prevRoomId = userRooms[socket.id];
        if (prevRoomId) {
            socket.leave(prevRoomId);
            // Update activeRooms tracking if applicable
            if (activeRooms[prevRoomId]) {
                activeRooms[prevRoomId].users = activeRooms[prevRoomId].users.filter(id => id !== socket.id);
                if (activeRooms[prevRoomId].users.length === 0) {
                    delete activeRooms[prevRoomId];
                }
            }
            // Update user list for the room they left
            broadcastUserList(prevRoomId);

            // Poll Cleanup: If room is deleted, remove its polls
            if (!activeRooms[prevRoomId]) {
                cleanupRoomPolls(prevRoomId);
            }
        }
    }

    function cleanupRoomPolls(roomId) {
        for (const pollId in polls) {
            if (polls[pollId].roomId === roomId) {
                delete polls[pollId];
            }
        }
        log.info(`Cleaned up polls for room ${roomId}`);
    }

    socket.on('create room', ({ name, roomId, password }) => {
        // Validation
        if (!name || name.length > 30 || name.length < 2) {
            socket.emit('error', 'Name must be between 2 and 30 characters.');
            return;
        }
        if (!roomId || roomId.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(roomId)) {
            socket.emit('error', 'Room ID must be 1-30 chars and alphanumeric.');
            return;
        }
        if (!password || password.length < 4) {
            socket.emit('error', 'Password must be at least 4 characters.');
            return;
        }

        if (roomId.toLowerCase() === 'public') {
            socket.emit('error', 'Cannot create a room named "Public". Use the Public Chat instead.');
            return;
        }
        if (activeRooms[roomId]) {
            socket.emit('error', 'Room already exists');
            return;
        }

        leavePreviousRoom(socket); // Leave old room first

        activeRooms[roomId] = {
            password: password,
            users: [socket.id]
        };

        userNames[socket.id] = name;
        userRooms[socket.id] = roomId;
        socket.join(roomId);

        log.success(`User ${name} created room: ${roomId}`);
        socket.emit('room joined', { roomId, isCreator: true });

        // Notify room
        io.to(roomId).emit('system message', `${name} created the room.`);
        broadcastUserList(roomId);
    });

    socket.on('join room', ({ name, roomId, password }) => {
        if (!activeRooms[roomId]) {
            socket.emit('error', 'Room does not exist');
            return;
        }

        if (activeRooms[roomId].password !== password) {
            socket.emit('error', 'Incorrect password');
            return;
        }

        leavePreviousRoom(socket); // Leave old room first

        activeRooms[roomId].users.push(socket.id);
        userNames[socket.id] = name;
        userRooms[socket.id] = roomId;
        socket.join(roomId);

        log.success(`User ${name} joined room: ${roomId}`);
        socket.emit('room joined', { roomId, isCreator: false });

        // Notify others in room
        socket.to(roomId).emit('system message', `${name} joined the room.`);
        broadcastUserList(roomId);
    });

    socket.on('join public', ({ name }) => {
        leavePreviousRoom(socket); // Leave old room first

        const roomId = 'Public';
        userNames[socket.id] = name;
        userRooms[socket.id] = roomId;
        socket.join(roomId);

        log.success(`User ${name} joined Public Chat`);
        socket.emit('room joined', { roomId, isCreator: false });

        socket.to(roomId).emit('system message', `${name} joined Public Chat.`);

        // Broadcast user list
        broadcastUserList(roomId);
    });

    // Typing Indicators
    socket.on('typing', () => {
        const roomId = userRooms[socket.id];
        const name = userNames[socket.id];
        if (roomId && name) {
            socket.to(roomId).emit('user typing', { name });
        }
    });

    socket.on('stop typing', () => {
        const roomId = userRooms[socket.id];
        const name = userNames[socket.id];
        if (roomId && name) {
            socket.to(roomId).emit('user stop typing', { name });
        }
    });

    // Reactions
    socket.on('add reaction', ({ msgId, emoji }) => {
        const roomId = userRooms[socket.id];
        if (roomId) {
            io.to(roomId).emit('reaction added', { msgId, emoji, from: userNames[socket.id] });
        }
    });

    // Helper to broadcast active users in a room
    function broadcastUserList(roomId) {
        if (!roomId) return;

        // Get all sockets in the room
        io.in(roomId).fetchSockets().then(sockets => {
            const users = sockets.map(s => ({
                id: s.id,
                name: userNames[s.id] || 'Unknown',
                color: userColors[s.id]
            }));
            // log.info(`Broadcasting ${users.length} users to room ${roomId}`);
            io.to(roomId).emit('room users', users);
        });
    }

    // Allow clients to request user list on demand
    socket.on('request users', () => {
        const roomId = userRooms[socket.id];
        // log.info(`User ${userNames[socket.id] || socket.id} requesting users for room: ${roomId}`);
        if (roomId) {
            broadcastUserList(roomId);
        } else {
            log.warn(`No room found for socket ${socket.id}, sending empty list`);
            socket.emit('room users', []);
        }
    });




    // DM Request Flow
    socket.on('send dm request', ({ targetId, fromName }) => {
        io.to(targetId).emit('dm request received', {
            fromId: socket.id,
            fromName: fromName
        });
    });

    socket.on('dm accepted', ({ fromId, toId }) => {
        // Create unique room ID for DM
        // Sort IDs to ensure same room ID regardless of who accepted
        const user1 = fromId;
        const user2 = toId; // This socket
        const dmRoomId = `DM-${[user1, user2].sort().join('-')}`;

        // Notify both to join the new room
        // We use io.to() because we want to target specific sockets
        io.to(user1).emit('join dm room', { roomId: dmRoomId });
        io.to(user2).emit('join dm room', { roomId: dmRoomId });
    });

    // Handle joining DM room (client will emit this after receiving 'join dm room')
    socket.on('join dm', ({ roomId, name }) => {
        leavePreviousRoom(socket);

        userNames[socket.id] = name;
        userRooms[socket.id] = roomId;
        socket.join(roomId);

        log.success(`User ${name} joined DM Room ${roomId}`);

        // Notify user they joined
        socket.emit('room joined', { roomId, isCreator: false });

        // Notify others in room
        socket.to(roomId).emit('system message', `${name} joined the chat.`);

        // Broadcast updated user list
        broadcastUserList(roomId);
    });

    // Invite User (Legacy/General)
    socket.on('invite user', ({ targetId, roomId, inviterName }) => {
        io.to(targetId).emit('invite received', { roomId, inviterName });
    });

    // Create Poll
    socket.on('create poll', ({ question, options, roomId, creator }) => {
        const pollId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        polls[pollId] = {
            id: pollId,
            question,
            options: options.map(opt => ({ text: opt, count: 0 })),
            voters: {}, // Map user socket.id to true (allow multiple votes? No, usually 1)
            creator,
            roomId
        };

        io.to(roomId).emit('new poll', polls[pollId]);
    });

    // Vote Poll
    socket.on('vote poll', ({ pollId, optionIndex, voter, userId }) => {
        log.info(`Vote attempt: Poll ${pollId}, Option ${optionIndex}, Voter ${voter}`);
        const poll = polls[pollId];
        if (!poll) {
            log.error('Poll not found');
            return;
        }

        // Use persistent userId if available, otherwise fallback to socket.id
        const voterKey = userId || socket.id;

        const previousVoteIndex = poll.voters[voterKey];

        if (previousVoteIndex !== undefined) {
            // Check if voting for same option - if so, maybe toggle off? or just return?
            // User says "voting just keeps increasing" so they want to switch or just update.
            // Current logic removes old vote and adds new one, which allows switching.
            // If same option, we could do nothing, but re-voting same option is harmless with this logic.

            // Remove previous vote
            if (poll.options[previousVoteIndex]) {
                poll.options[previousVoteIndex].count--;
            }
        }

        // Add new vote
        poll.options[optionIndex].count++;
        poll.voters[voterKey] = optionIndex;

        // Calculate total for percentages
        const totalVotes = poll.options.reduce((a, b) => a + b.count, 0);

        io.to(poll.roomId).emit('update poll', {
            pollId,
            options: poll.options,
            totalVotes
        });
    });

    // Legacy support or fallback? userNames mainly set in join/create now.
    socket.on('set name', (name) => {
        userNames[socket.id] = name;
        log.info(`User ${socket.id} set name: ${name}`);
        // Optionally update user list if they are in a room
        const roomId = userRooms[socket.id];
        if (roomId) broadcastUserList(roomId);
    });

    socket.on('chat message', (msg) => {
        const userId = socket.id;
        const userColor = userColors[userId];
        const userName = userNames[userId] || 'Unknown';
        const roomId = userRooms[userId];

        if (!roomId) {
            socket.emit('error', 'You must be in a room to send messages.');
            return;
        }

        // Parse Payload (String or Object)
        let textContent = '';
        let attachment = null;

        if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
            textContent = msg.text || '';
            attachment = msg.attachment || null;
        } else {
            textContent = String(msg || '');
        }

        // Ephemeral Check
        // Format: "Real message ||ephemeral|10000||"
        let finalMsg = textContent;
        let ephemeralDuration = 0;

        const ephemeralMatch = textContent.match(/\|\|ephemeral\|(\d+)\|\|$/);
        if (ephemeralMatch) {
            ephemeralDuration = parseInt(ephemeralMatch[1]);
            finalMsg = textContent.replace(ephemeralMatch[0], '').trim();
        }

        // Generate stable ID on server
        const msgId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        io.to(roomId).emit('chat message', {
            id: msgId,
            name: userName,
            text: finalMsg,
            attachment: attachment,
            color: userColor,
            ephemeral: ephemeralDuration,
            timestamp: Date.now()
        });
    });

    socket.on('delete message', ({ msgId, roomId }) => {
        io.to(roomId).emit('message deleted', msgId);
    });

});

function getRandomColor() {
    let r = Math.ceil(Math.random() * 255);
    let g = Math.ceil(Math.random() * 255);
    let b = Math.ceil(Math.random() * 255);
    const c = 50;
    if (r <= c) {
        r *= 2;
    }
    if (g <= c) {
        g *= 2;
    }
    if (b <= c) {
        b *= 2;
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

app.use(express.static(path.join(__dirname, 'client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

const PORT = process.env.PORT || 2800;
server.listen(PORT, () => {
    log.success(`Server is running on port ${PORT}`);
});
