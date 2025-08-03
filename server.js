// server.js - ਪੂਰਾ ਅਤੇ ਅੰਤਿਮ ਕੋਡ

console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const cors = require('cors'); // <-- 1. ਨਵਾਂ ਪੈਕੇਜ ਸ਼ਾਮਲ ਕੀਤਾ

const app = express();
const server = http.createServer(app);

// 2. Express ਲਈ CORS ਨੂੰ ਸਮਰੱਥ ਕਰੋ (ਇਹੀ ਮੁੱਖ ਹੱਲ ਹੈ)
app.use(cors()); 

const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਤੁਸੀਂ ਇੱਥੇ ਆਪਣੀ ਉਹੀ ਪੁਰਾਣੀ ਗੁਪਤ ਕੁੰਜੀ ਪਾਈ ਹੈ
const TURN_SECRET = "ਇੱਥੇ-ਆਪਣੀ-ਉਹੀ-ਪੁਰਾਣੀ-ਕੁੰਜੀ-ਰੱਖੋ";

app.get('/api/get-turn-credentials', (req, res) => {
    const expiry = Math.floor(Date.now() / 1000) + 3600; 
    const username = `${expiry}:facefy_user`;
    const hmac = crypto.createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    res.json({
        urls: [
            'turn:relay1.expressturn.com:3480',
            'turn:relay1.expressturn.com:3480?transport=tcp'
        ],
        username: username,
        credential: credential
    });
});

let waitingUsers = [];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.on('join', (data) => {
        socket.userData = data;
        socket.partner = null;
        const partner = waitingUsers.find(
            user => user.id !== socket.id && user.userData.mode === socket.userData.mode
        );
        if (partner) {
            waitingUsers = waitingUsers.filter(user => user.id !== partner.id);
            socket.partner = partner;
            partner.partner = socket;
            console.log(`Match found: ${socket.id} and ${partner.id}`);
            partner.emit('match', { initiator: false });
            socket.emit('match', { initiator: true });
        } else {
            waitingUsers.push(socket);
            console.log(`User ${socket.id} is waiting for a match.`);
        }
    });
    socket.on('signal', (data) => {
        if (socket.partner) {
            socket.partner.emit('signal', data);
        }
    });
    socket.on('chat', (message) => {
        if (socket.partner) {
            socket.partner.emit('chat', message);
        }
    });
    const handleDisconnect = () => {
        console.log(`User disconnected: ${socket.id}`);
        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
        if (socket.partner) {
            socket.partner.emit('leave');
            socket.partner.partner = null;
        }
    };
    socket.on('leave', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

// Render ਲਈ ਪੋਰਟ ਨੂੰ ਸਹੀ ਢੰਗ ਨਾਲ ਸੈੱਟ ਕਰੋ
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
