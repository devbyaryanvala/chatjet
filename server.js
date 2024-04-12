const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const userColors = {};
const userNames = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const color = getRandomColor();
    userColors[socket.id] = color;
    socket.emit('color', color);

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete userColors[socket.id];
        delete userNames[socket.id];
    });

    socket.on('set name', (name) => {
        userNames[socket.id] = name;
        console.log(`User ${socket.id} set name: ${name}`);
    });

    socket.on('chat message', (msg) => {
        const userId = socket.id;
        const userColor = userColors[userId];
        const userName = userNames[userId] || 'Unknown'; 
        
        //console.log(`User ${userName} (${userId}) sent message: ${msg}`);
        
        io.emit('chat message', { name: userName, message: msg, color: userColor });
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
