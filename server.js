const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const crypto = require("crypto");

let lastSeen = new Map();

const io = new Server(server, {
    cors: { origin: "*"}
});

let players = new Map();
// key: socket.id
// value: { id, name }

function nameExists(name) {
    for(const p of players.values()) {
        if(p.name.toLowerCase() === name.toLowerCase()) {
            return true;
        }
    }
    return false;
}

// serve static files
app.use(express.static("public"));

// clean up ghost players
setInterval(() => {
    const now = Date.now();

    for(const [sid, time] of lastSeen.entries()) {
        if(now - time > 15000) {
            if(players.has(sid)) {
                players.delete(sid);
                io.emit("player-list", Array.from(players.values()));
            }
            lastSeen.delete(sid);
        }
    }
}, 10000);


// when a user connects
io.on("connection", (socket) => {
    console.log("Socket connected", socket.id);
    
    lastSeen.set(socket.id, Date.now());

    socket.on("heartbeat", () => {
        lastSeen.set(socket.id, Date.now());
    });

    socket.on("request-join", ({ name, existingId }) => {
    let playerData;

    const existingPlayerEntry = Array.from(players.entries()).find(
        ([sid, p]) => p.id === existingId
    );

    if(existingPlayerEntry) {
        const [oldSid, oldPlayer] = existingPlayerEntry;
        players.delete(oldSid);
        playerData = {
            id: oldPlayer.id,
            name: name || oldPlayer.name || "Unknown",
        };
    } else {
        if(!name || nameExists(name)) {
            socket.emit("join-denied", { reason: "Name already taken or invalid."});
            return;
        }
        playerData = { id: existingId || crypto.randomUUID(), name };
    }

    players.set(socket.id, playerData);
    lastSeen.set(socket.id, Date.now());

    socket.emit("join-approved", playerData);
    io.emit("playerJoinedAnnouncement", name);
    io.emit("player-list", Array.from(players.values()));
});

    socket.on("change-name", (newName) => {
        if(nameExists(newName)) {
            socket.emit("name-change-denied", { reason: "Name already taken."});
            return;
        }

        const player = players.get(socket.id);
        if(!player) {
            return;
        }

        const oldName = player.name;
        player.name = newName;

        socket.emit("name-change-approved", player);

        io.emit("event-log", `${oldName} changed name to ${newName}`);
        io.emit("player-list", Array.from(players.values()));
    });

    // send roll to everyone
    socket.on("sharedRoll", (roll) => {
        const player = players.get(socket.id);
        const name = player ? player.name : "Unknown Player";

        io.emit("sharedRollResult", {
            name,
            roll
        });
    });

    socket.on("disconnect", () => {
        if(players.has(socket.id)) {
            players.delete(socket.id);
            io.emit("player-list", Array.from(players.values()));
        }
    });
});

// start server on port 3000
server.listen(3000, () => {
    console.log("Server is running at http://localhost:3000");
});