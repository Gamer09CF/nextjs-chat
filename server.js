// server.js

// Import necessary modules
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Initialize Express app and create an HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server with CORS enabled for development
const io = new Server(server, {
    cors: {
        origin: "*", // Allows all origins, but should be restricted in production
        methods: ["GET", "POST"]
    }
});

// --- Server-side State Management (In-memory) ---
// Note: In a production environment, you would use a database for persistence.
let connectedUsers = [];
let bannedUsers = [];
let featureRequests = [];
const adminPassword = "toorroot123"; // A simple password for demonstration

// Serve the HTML file from the same directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Socket.IO Event Handlers ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user joining event
    socket.on('userJoined', (user) => {
        // Check if the user is banned
        if (bannedUsers.some(bannedUser => bannedUser.id === user.id)) {
            socket.emit('connectionDenied', { reason: 'You are banned from this chat.' });
            socket.disconnect();
            return;
        }

        // Add the new user to the connected users list
        connectedUsers.push({ id: socket.id, username: user.username, isModerator: user.isModerator });
        console.log(`${user.username} has joined the chat.`);

        // Notify the new user of the current state
        socket.emit('bannedUsersList', bannedUsers);
        socket.emit('featureRequestsList', featureRequests);

        // Broadcast the updated user list to all clients
        io.emit('userList', connectedUsers);
    });

    // Handle incoming chat messages from regular users
    socket.on('message', (message) => {
        console.log(`Message from ${message.username}: ${message.text}`);
        // Broadcast the message to all connected clients
        io.emit('message', message);
    });

    // Handle incoming admin chat messages (only from moderators)
    socket.on('adminMessage', (message) => {
        const user = connectedUsers.find(u => u.id === socket.id);
        if (user && user.isModerator) {
            console.log(`Admin Message from ${message.username}: ${message.text}`);
            // Broadcast the admin message to all clients
            io.emit('adminMessage', message);
        }
    });

    // Handle a feature request from a user
    socket.on('featureRequest', (request) => {
        const user = connectedUsers.find(u => u.id === socket.id);
        if (user) {
            featureRequests.push({ ...request, username: user.username });
            console.log(`New feature request from ${user.username}: ${request.text}`);
            // Update all moderator clients with the new list of requests
            io.emit('featureRequestsList', featureRequests);
        }
    });

    // Handle banning a user (moderator action)
    socket.on('banUser', (data) => {
        const moderator = connectedUsers.find(u => u.id === socket.id);
        if (moderator && moderator.isModerator) {
            const userToBan = connectedUsers.find(u => u.id === data.userId);
            if (userToBan) {
                bannedUsers.push(userToBan);
                connectedUsers = connectedUsers.filter(u => u.id !== userToBan.id);

                // Find the socket of the user to be banned and disconnect them
                const userSocket = io.sockets.sockets.get(userToBan.id);
                if (userSocket) {
                    userSocket.emit('connectionDenied', { reason: 'You have been banned by a moderator.' });
                    userSocket.disconnect(true);
                }

                console.log(`${moderator.username} banned user: ${userToBan.username}`);
                io.emit('userList', connectedUsers);
                io.emit('bannedUsersList', bannedUsers);
            }
        }
    });

    // Handle unbanning a user (moderator action)
    socket.on('unbanUser', (data) => {
        const moderator = connectedUsers.find(u => u.id === socket.id);
        if (moderator && moderator.isModerator) {
            const userToUnban = bannedUsers.find(u => u.id === data.userId);
            if (userToUnban) {
                bannedUsers = bannedUsers.filter(u => u.id !== userToUnban.id);
                console.log(`${moderator.username} unbanned user: ${userToUnban.username}`);
                io.emit('bannedUsersList', bannedUsers);
            }
        }
    });

    // Handle deleting a feature request (moderator action)
    socket.on('deleteFeatureRequest', (data) => {
        const moderator = connectedUsers.find(u => u.id === socket.id);
        if (moderator && moderator.isModerator) {
            featureRequests = featureRequests.filter(req => req.id !== data.requestId);
            console.log(`Feature request ${data.requestId} deleted by ${moderator.username}`);
            io.emit('featureRequestsList', featureRequests);
        }
    });

    // Handle a user disconnecting
    socket.on('disconnect', () => {
        // Find the user that disconnected and remove them from the list
        const user = connectedUsers.find(u => u.id === socket.id);
        if (user) {
            connectedUsers = connectedUsers.filter(u => u.id !== socket.id);
            console.log(`${user.username} disconnected.`);
            // Broadcast the updated user list
            io.emit('userList', connectedUsers);
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on https://nextjs-chat-xvnd.onrender.com:${PORT}`);
});
