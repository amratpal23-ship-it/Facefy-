// server.js - Final Stable Version with 100x User Count
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

//            
const TURN_SECRET = "ammyghuman123456-facefy";

app.get('/api/get-turn-credentials', (req, res) => {
    try {
        const expiry = Math.floor(Date.now() / 1000) + 3600; // 1   
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

// ---   :          ---
function updateUserCount() {
    const realCount = io.of("/").sockets.size; //    
    
    // ---   :    100    ---
    const displayCount = realCount * 100; 
    
    console.log(`Real user count: ${realCount}, Broadcasting display count: ${displayCount}`);
    io.emit('user-count-update', displayCount); //      
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    updateUserCount();

    socket.on('join', (data) => {
        if (!data || !data.mode || !['video', 'chat'].includes(data.mode)) {
            console.log(`Invalid join data from ${socket.id}`);
            return;
        }

        console.log(`User ${socket.id} wants to join ${data.mode}`);
        
        waitingUsers.video = waitingUsers.video.filter(user => user.id !== socket.id);
        waitingUsers.chat = waitingUsers.chat.filter(user => user.id !== socket.id);

        socket.userData = data;
        
        const partner = waitingUsers[data.mode].pop();

        if (partner) {
            console.log(`Match found for ${data.mode}: ${socket.id} and ${partner.id}`);
            socket.partnerId = partner.id;
            partner.partnerId = socket.id;

            socket.emit('match', { initiator: true });
            partner.emit('match', { initiator: false });
        } else {
            waitingUsers[data.mode].push(socket);
            console.log(`User ${socket.id} is now waiting in ${data.mode}. Pool size: ${waitingUsers[data.mode].length}`);
        }
    });

    socket.on('signal', (data) => {
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('signal', data);
            }
        }
    });

    socket.on('chat', (message) => {
        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('chat', message);
            }
        }
    });

    const cleanup = () => {
        console.log(`User disconnected: ${socket.id}. Cleaning up.`);
        
        waitingUsers.video = waitingUsers.video.filter(user => user.id !== socket.id);
        waitingUsers.chat = waitingUsers.chat.filter(user => user.id !== socket.id);

        if (socket.partnerId) {
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.emit('leave');
                delete partnerSocket.partnerId;
            }
        }
        delete socket.partnerId;
        
        setTimeout(updateUserCount, 500);
    };

    socket.on('leave', cleanup);
    socket.on('disconnect', cleanup);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
