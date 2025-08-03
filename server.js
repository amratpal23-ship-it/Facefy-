// server.js - Final Stable Version
console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto =require('crypto');
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
    try {
        const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 ਘੰਟੇ ਲਈ ਵੈਧ
        const username = `${expiry}:facefy_user`;
        const hmac = crypto.createHmac('sha1', TURN_SECRET);
        hmac.update(username);
        const credential = hmac.digest('base64');
        
        res.json({
            urls: ['turn:relay1.expressturn.com:3480', 'turn:relay1.expressturn.com:3480?transport=tcp'],
            username,
            credential
        });
    } catch (error) {
        console.error("Error generating TURN credentials:", error);
        res.status(500).send("Error generating credentials");
    }
});

let waitingUsers = {
    video: [],
    chat: []
};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join', (data) => {
        if (!data || !data.mode || !['video', 'chat'].includes(data.mode)) {
            console.log(`Invalid join data from ${socket.id}`);
            return;
        }

        console.log(`User ${socket.id} wants to join ${data.mode}`);
        
        // ਪਹਿਲਾਂ, ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਯੂਜ਼ਰ ਪਹਿਲਾਂ ਤੋਂ ਕਿਸੇ ਹੋਰ ਲਿਸਟ ਵਿੱਚ ਨਹੀਂ ਹੈ
        waitingUsers.video = waitingUsers.video.filter(user => user.id !== socket.id);
        waitingUsers.chat = waitingUsers.chat.filter(user => user.id !== socket.id);

        socket.userData = data;
        
        // ਇੱਕ ਸਾਥੀ ਲੱਭੋ
        const partner = waitingUsers[data.mode].pop();

        if (partner) {
            // ਸਾਥੀ ਮਿਲ ਗਿਆ
            console.log(`Match found for ${data.mode}: ${socket.id} and ${partner.id}`);
            socket.partnerId = partner.id;
            partner.partnerId = socket.id;

            // ਦੋਵਾਂ ਨੂੰ ਦੱਸੋ ਕਿ ਮੈਚ ਮਿਲ ਗਿਆ ਹੈ
            socket.emit('match', { initiator: true });
            partner.emit('match', { initiator: false });
        } else {
            // ਕੋਈ ਸਾਥੀ ਨਹੀਂ, ਉਡੀਕ ਕਰੋ
            waitingUsers[data.mode].push(socket);
            console.log(`User ${socket.id} is now waiting in ${data.mode}. Pool size: ${waitingUsers[data.mode].length}`);
        }
    });

    socket.on('signal', (data) => {
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                // ਸਿਗਨਲ ਨੂੰ ਸਿੱਧਾ ਦੂਜੇ ਯੂਜ਼ਰ ਨੂੰ ਭੇਜੋ
                partnerSocket.emit('signal', data);
            }
        }
    });

    socket.on('chat', (message) => {
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                // ਚੈਟ ਸੁਨੇਹੇ ਨੂੰ ਸਿੱਧਾ ਦੂਜੇ ਯੂਜ਼ਰ ਨੂੰ ਭੇਜੋ
                partnerSocket.emit('chat', message);
            }
        }
    });

    const cleanup = () => {
        console.log(`User disconnected: ${socket.id}. Cleaning up.`);
        
        // ਯੂਜ਼ਰ ਨੂੰ ਉਡੀਕ ਸੂਚੀ ਵਿੱਚੋਂ ਹਟਾਓ
        waitingUsers.video = waitingUsers.video.filter(user => user.id !== socket.id);
        waitingUsers.chat = waitingUsers.chat.filter(user => user.id !== socket.id);

        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                // ਦੂਜੇ ਯੂਜ਼ਰ ਨੂੰ ਦੱਸੋ ਕਿ ਸਾਂਝੇਦਾਰੀ ਖਤਮ ਹੋ ਗਈ ਹੈ
                partnerSocket.emit('leave');
                delete partnerSocket.partnerId; // ਉਸਦੇ ਪਾਰਟਨਰ ਦੀ ID ਨੂੰ ਵੀ ਹਟਾਓ
            }
        }
        delete socket.partnerId;
    };

    socket.on('leave', cleanup);
    socket.on('disconnect', cleanup);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
