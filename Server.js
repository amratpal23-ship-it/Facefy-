console.log("Server.js file started running...");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://facefy.fun/", // <-- ਇੱਥੇ ਆਪਣੀ ਹੋਸਟਿੰਗਰ ਵੈੱਬਸਾਈਟ ਦਾ ਪੂਰਾ URL ਪਾਓ
    methods: ["GET", "POST"]
  }
});

// HTML ਫਾਈਲ ਨੂੰ ਸਰਵ ਕਰਨ ਲਈ
/*app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); 
});*/
// HTML ਫਾਈਲ ਨੂੰ ਸਰਵ ਕਰਨ 

// ਉਡੀਕ ਕਰ ਰਹੇ ਉਪਭੋਗਤਾਵਾਂ ਲਈ ਇੱਕ ਸਧਾਰਨ ਕਤਾਰ
let waitingUsers = [];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join', (data) => {
        socket.userData = data; // gender, mode ਨੂੰ ਸਾਕਟ ਨਾਲ ਜੋੜੋ
        socket.partner = null;

        // ਇੱਕ ਸਾਥੀ ਲੱਭਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ
        const partner = waitingUsers.find(
            user => user.id !== socket.id && user.userData.mode === socket.userData.mode
        );

        if (partner) {
            // ਸਾਥੀ ਮਿਲ ਗਿਆ
            waitingUsers = waitingUsers.filter(user => user.id !== partner.id); // ਕਤਾਰ 'ਚੋਂ ਸਾਥੀ ਨੂੰ ਹਟਾਓ
            
            socket.partner = partner;
            partner.partner = socket;
            
            console.log(`Match found: ${socket.id} and ${partner.id}`);

            // ਦੋਵਾਂ ਨੂੰ ਸੂਚਿਤ ਕਰੋ
            partner.emit('match', { initiator: false });
            socket.emit('match', { initiator: true });

        } else {
            // ਕੋਈ ਸਾਥੀ ਨਹੀਂ ਮਿਲਿਆ, ਕਤਾਰ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ
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
        // ਜੇਕਰ ਉਪਭੋਗਤਾ ਕਤਾਰ ਵਿੱਚ ਸੀ, ਤਾਂ ਉਸਨੂੰ ਹਟਾ ਦਿਓ
        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);

        // ਜੇਕਰ ਉਪਭੋਗਤਾ ਦਾ ਕੋਈ ਸਾਥੀ ਸੀ, ਤਾਂ ਉਸਨੂੰ ਸੂਚਿਤ ਕਰੋ
        if (socket.partner) {
            socket.partner.emit('leave');
            socket.partner.partner = null; // ਸਾਥੀ ਦਾ ਲਿੰਕ ਤੋੜੋ
        }
    
    socket.on('leave', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


