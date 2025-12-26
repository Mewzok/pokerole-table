import { Character } from "../public/data/models/Character.js";
import { rollDice } from "../game/DiceEngine.js";
import { createCharacter, updateCharacter, deleteCharacter, listCharacters } from "./characters.js";

const gameState = {
    characters: []
};

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

let lastSeen = new Map();
let players = new Map();
// key: socket.id
// value: { id, name }
let playersById = new Map();

let characters = new Map();
// key: charId
// value: { id, name, ownerId, hp, maxHp, notes }

function nameExists(name) {
    const lower = name.toLowerCase();
    for(const p of playersById.values()) {
        if(p.name.toLowerCase() === lower) {
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
        const age = now - time;

        if(age > 15000) {
            if(players.has(sid)) {
                players.delete(sid);
                io.emit("player-list", Array.from(players.values()));
            }
            lastSeen.delete(sid);
        }
    }
}, 10000);

// when a user connects
io.on("connection", socket => {
    console.log("Socket connected", socket.id);
    
    lastSeen.set(socket.id, Date.now());

    socket.on("heartbeat", () => {
        lastSeen.set(socket.id, Date.now());
    });

    socket.on("request-join", ({ name, existingId }) => {
        const eid = (existingId && existingId !== "undefined" && existingId !== "null") ? existingId : undefined;
        console.log("[request-join] socket.id:", socket.id, "existingId:", existingId, "name:", name);

        let playerData;
        const existingPlayerEntry = Array.from(players.entries()).find(
            ([sid, p]) => p.id === eid
        );
        const savedById = eid ? playersById.get(eid) : null;

        if(existingPlayerEntry) {
            const [oldSid, oldPlayer] = existingPlayerEntry;
            console.log("[request-join] found existing player entry:", oldSid, oldPlayer);
            players.delete(oldSid);
            playerData = {
                id: oldPlayer.id,
                name: name || oldPlayer.name || "Unknown",
            };
        } else if(savedById) {
            playerData = { id: savedById.id, name: savedById.name };
        } else {
            if(!name || nameExists(name)) {
                socket.emit("join-denied", { reason: "Name already taken or invalid."});
                console.log("[request-join] join denied for", socket.id, "name:", name);
                return;
            }
            playerData = { id: crypto.randomUUID(), name };
        }

        // first player to join is GM temporarily
        playerData.isGM = playersById.size === 0;

        players.set(socket.id, playerData);
        playersById.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            isGM: playerData.isGM
        });
        lastSeen.set(socket.id, Date.now());

        console.log("[request-join] registered player for socket:", socket.id, "->", playerData);
        socket.emit("join-approved", playerData);
        io.emit("playerJoinedAnnouncement", playerData.name);
        io.emit("player-list", Array.from(players.values()));
    });

    socket.on("change-name", (newName) => {
        console.log("[change-name] socket:", socket.id, "newName:", newName);
        if(nameExists(newName)) {
            socket.emit("name-change-denied", { reason: "Name already taken."});
            console.log("[change-name] name change denied for socket:", socket.id, "name:", newName);
            return;
        }

        const player = players.get(socket.id);
        if(!player) {
            console.log("[change-name] no player found for socket:", socket.id);
            return;
        }

        const oldName = player.name;
        player.name = newName;

        // persist updated name by player ID
        const saved = playersById.get(player.id) || {};
        saved.name = newName;
        playersById.set(player.id, saved);
        playersById.set(player.id, { id: player.id, name: newName });

        socket.emit("name-change-approved", player);

        io.emit("event-log", `${oldName} changed name to ${newName}`);
        io.emit("player-list", Array.from(players.values()));
        console.log("[change-name] updated player:", player, "players map size:", players.size);
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

    // character creation
    socket.on("create-character", ({ name, maxHp = 10 }) => {
        const player = players.get(socket.id);
        if(!player)  {
            return;
        }

        // enforce character limit per player unless GM
        const ownedCount = Array.from(characters.values()).filter(c => c.ownerId === player.id).length;

        if(!player.isGM && ownedCount >= 3) {
            socket.emit("character-creation-denied", { reason: "Character limit reached."});
            return;
        }
        
        const character = {
            id: crypto.randomUUID(),
            name,
            ownerId: player.isGM ? null : player.id,
            ownerName: player.name,
            hp: maxHp,
            maxHp,
            notes: "",
        };

        characters.set(character.id, character);

        broadcastCharacterList();
    });

    socket.on("update-character", (updated) => {
        const player = players.get(socket.id);
        if(!player)  {
            return;
        }

        const char = characters.get(updated.id);
        if(!char) {
            return;
        }

        if(!player.isGM && char.ownerId !== player.id) {
            return;
        }

        Object.assign(char, updated);
        broadcastCharacterList();
    });

    socket.on("delete-character", (id) => {
        const player = players.get(socket.id);
        if(!player) {
            return;
        }

        const char = characters.get(id);
        if(!char) {
            return;
        }

        if(!player.isGM && char.ownerId !== player.id) {
            return;
        }

        characters.delete(id);
        broadcastCharacterList();
    });

    socket.on("disconnect", () => {
        if(players.has(socket.id)) {
            players.delete(socket.id);
            io.emit("player-list", Array.from(players.values()));
            console.log("[disconnect] removed player for socket:", socket.id);
        }
    });

    // gm adds a character
    socket.on("gm_createCharacter", (data) => {
        const character = createCharacter({
            pokemonId: data.pokemonId,
            name: data.name
        });
        io.emit("characterListUpdated", listCharacters());
    });

    // gm updates a character
    socket.on("gm_updateCharacter", (data) => {
        const char = updateCharacter(data.id, data.updates);
        if(char) {
            io.emit("characterListUpdated", listCharacters());
        }
    });

    // gm deletes a character
    socket.on("gm_deleteCharacter", (id) => {
        const char = deleteCharacter(id);
        if(char) {
            io.emit("characterListUpdated", listCharacters());
        }
    });
});

// start server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log("Server is running at http://localhost:3000");
});

// utility
function broadcastCharacterList() {
    for(const [sid, player] of players.entries()) {
        const list = Array.from(characters.values());

        if(!player.isGM) {
            const filtered = list.filter(c => c.ownerId === player.id);
            io.to(sid).emit("character-list", filtered);
        } else {
            io.to(sid).emit("character-list", list);
        }
    }
}