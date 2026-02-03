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


const userColors = {};
const polls = {}; // Global poll store
const userNames = {};
const activeRooms = {}; // { roomId: { password: '...', users: [] } }
const userRooms = {}; // { socketId: roomId }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const color = getRandomColor();
    userColors[socket.id] = color;
    socket.emit('color', color);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const roomId = userRooms[socket.id];
        if (roomId && activeRooms[roomId]) {
            // Remove user from room user list
            activeRooms[roomId].users = activeRooms[roomId].users.filter(id => id !== socket.id);
            // Optional: Delete room if empty
            if (activeRooms[roomId].users.length === 0) {
                delete activeRooms[roomId];
                console.log(`Room ${roomId} deleted (empty)`);
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
        console.log(`Cleaned up polls for room ${roomId}`);
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

        console.log(`User ${name} created room: ${roomId}`);
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

        console.log(`User ${name} joined room: ${roomId}`);
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

        console.log(`User ${name} joined Public Chat`);
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
            io.to(roomId).emit('room users', users);
        });
    }



    // Invite User
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
    socket.on('vote poll', ({ pollId, optionIndex, voter }) => {
        console.log(`Vote attempt: Poll ${pollId}, Option ${optionIndex}, Voter ${voter} (${socket.id})`);
        const poll = polls[pollId];
        if (!poll) {
            console.log('Poll not found');
            return;
        }

        // Simple check: Allow 1 vote per user (using socket id)
        // If they already voted, are we changing vote? Or preventing?
        // Let's implements: If voted, remove old vote, add new.

        const previousVoteIndex = poll.voters[socket.id];

        if (previousVoteIndex !== undefined) {
            // Remove previous vote
            if (poll.options[previousVoteIndex]) {
                poll.options[previousVoteIndex].count--;
            }
        }

        // Add new vote
        poll.options[optionIndex].count++;
        poll.voters[socket.id] = optionIndex;

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
        console.log(`User ${socket.id} set name: ${name}`);
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
            ephemeral: ephemeralDuration
        });
    });

});

function getRandomColor() {
    r = Math.ceil(Math.random() * 255);
    g = Math.ceil(Math.random() * 255);
    b = Math.ceil(Math.random() * 255);
    c = 50;
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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(2800, () => {
    console.log('Server is running on port 2800');
});
