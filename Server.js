console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "https://facefy.fun", // ਤੁਹਾਡਾ ਡੋਮੇਨ
    methods: ["GET", "POST"]
  }
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

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



