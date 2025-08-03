// server.js - ਪੂਰਾ ਕੋਡ

console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto'); // <-- ਨਵਾਂ ਮੋਡੀਊਲ ਸ਼ਾਮਲ ਕੀਤਾ ਗਿਆ

const app = express();
const server = http.createServer(app);

// 1. CORS ਦੀ ਸਮੱਸਿਆ ਦਾ ਹੱਲ
const io = socketIo(server, {
  cors: {
    origin: "*", // ਸਾਰਿਆਂ ਨੂੰ ਇਜਾਜ਼ਤ ਦਿਓ (ਟੈਸਟਿੰਗ ਲਈ ਵਧੀਆ)
    methods: ["GET", "POST"]
  }
});

// 2. TURN ਕ੍ਰੇਡੈਂਸ਼ੀਅਲ ਲਈ API ਐਂਡਪੁਆਇੰਟ
// ਇਸ ਗੁਪਤ ਕੁੰਜੀ ਨੂੰ ਕਿਸੇ ਨਾਲ ਸਾਂਝਾ ਨਾ ਕਰੋ ਅਤੇ ਪ੍ਰੋਡਕਸ਼ਨ ਵਿੱਚ ਇਸਨੂੰ ਬਦਲ ਦਿਓ
const TURN_SECRET = "ammyghuman123456-facefy";

app.get('/api/get-turn-credentials', (req, res) => {
    // ਇੱਕ ਯੂਜ਼ਰਨੇਮ ਬਣਾਓ ਜੋ 1 ਘੰਟੇ (3600 ਸਕਿੰਟ) ਬਾਅਦ ਐਕਸਪਾਇਰ ਹੋ ਜਾਵੇਗਾ
    const expiry = Math.floor(Date.now() / 1000) + 3600; 
    const username = `${expiry}:facefy_user`;

    // HMAC-SHA1 ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਪਾਸਵਰਡ ਬਣਾਓ
    const hmac = crypto.createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');

    // ਫਰੰਟ-ਐਂਡ ਨੂੰ ਕ੍ਰੇਡੈਂਸ਼ੀਅਲ ਭੇਜੋ
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

        // ਮੈਚਮੇਕਿੰਗ ਤਰਕ ਵਿੱਚ ਕੋਈ ਬਦਲਾਅ ਨਹੀਂ ਕੀਤਾ ਗਿਆ
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

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

