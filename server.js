// server.js - Final Version
console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
app.use(cors());

const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਤੁਸੀਂ ਇੱਥੇ ਆਪਣੀ ਉਹੀ ਪੁਰਾਣੀ ਗੁਪਤ ਕੁੰਜੀ ਪਾਈ ਹੈ
const TURN_SECRET = "ammyghuman123456-facefy";

app.get('/api/get-turn-credentials', (req, res) => {
    const expiry = Math.floor(Date.now() / 1000) + 3600; 
    const username = `${expiry}:facefy_user`;
    const hmac = crypto.createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    res.json({
        urls: ['turn:relay1.expressturn.com:3480', 'turn:relay1.expressturn.com:3480?transport=tcp'],
        username,
        credential
    });
});

let waitingPool = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const findPartnerFor = (currentUser) => {
        const mode = currentUser.userData.mode;
        if (!waitingPool[mode]) {
            waitingPool[mode] = [];
        }

        let partner = null;
        const partnerIndex = waitingPool[mode].findIndex(user => user.id !== currentUser.id);

        if (partnerIndex !== -1) {
            partner = waitingPool[mode][partnerIndex];
            waitingPool[mode].splice(partnerIndex, 1);
        }

        if (partner) {
            currentUser.partnerId = partner.id;
            partner.partnerId = currentUser.id;
            console.log(`Match found: ${currentUser.id} and ${partner.id}`);
            partner.emit('match', { initiator: false });
            currentUser.emit('match', { initiator: true });
        } else {
            if (!waitingPool[mode].some(user => user.id === currentUser.id)) {
                waitingPool[mode].push(currentUser);
            }
            console.log(`User ${currentUser.id} added to waiting pool for mode '${mode}'.`);
        }
    };

    socket.on('join', (data) => {
        socket.userData = data;
        findPartnerFor(socket);
    });

    socket.on('signal', (data) => {
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if(partnerSocket) {
                partnerSocket.emit('signal', data);
            }
        }
    });

    const cleanup = () => {
        console.log(`Cleaning up for user: ${socket.id}`);
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('leave');
                delete partnerSocket.partnerId;
            }
        }
        for (const mode in waitingPool) {
            waitingPool[mode] = waitingPool[mode].filter(user => user.id !== socket.id);
        }
    };
    
    socket.on('leave', cleanup);
    socket.on('disconnect', cleanup);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
