// grab page elements
const socket = io();

const joinScreen = document.getElementById("joinScreen");
const gameScreen = document.getElementById("gameScreen");
const eventLog = document.getElementById("eventLog");

// dev tools
const DEV_BYPASS = false;

// dice
const sharedBtn = document.getElementById("sharedRollBtn");
const sharedResult = document.getElementById("sharedResult");

// player variables
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const joinStatus = document.getElementById("joinStatus");
const playerList = document.getElementById("playerList");
const playerDisplayName = document.getElementById("playerDisplayName");

// character variables
const characterListDiv = document.getElementById("characterList");
const charNameInput = document.getElementById("charNameInput");
const charHpInput = document.getElementById("charHpInput");
const enemyCheck = document.getElementById("enemyCheck");
const createCharBtn = document.getElementById("createCharBtn");
const characterGrid = document.getElementById("character-grid");

function readStored(key) {
    const v = localStorage.getItem(key);
    if(v === null || v === undefined) {
        return null;
    }
    if(v === "undefined" || v === "null") {
        return null;
    }
    return v;
}

let PLAYER_ID = readStored("playerId");
let PLAYER_NAME = readStored("playerName");

let _heartbeatStarted = false;
let _heartbeatInterval = null;

socket.on("connect", () => {
    if(!_heartbeatStarted) {
        _heartbeatStarted = true;
        _heartbeatInterval = setInterval(() => {
            socket.emit("heartbeat");
        }, 5000);
    }
});

socket.on("disconnect", () => {
    if(_heartbeatStarted) {
        clearInterval(_heartbeatInterval);
        _heartbeatInterval = null;
        _heartbeatStarted = false;
    }
});

// ---- ui helpers ----
function showNameEntryScreen() {
    joinScreen.style.display = "block";
    gameScreen.style.display = "none";
}

function showMainGameScreen() {
    joinScreen.style.display = "none";
    gameScreen.style.display = "block";
}

// ---- join logic ----
function joinGame(name) {
    socket.emit("request-join", {
        name,
        existingId: PLAYER_ID
    });
}

joinBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if(!name) {
        return;
    }
    joinStatus.textContent = "Joining...";
    joinGame(name);
});

window.onload = () => {
    console.log("[client] onload localStorage:", {
        playerId: localStorage.getItem("playerId"),
        playerName: localStorage.getItem("playerName")
    });
    if(DEV_BYPASS) {
        joinGame("Dev 0");
        return;
    }

    if(PLAYER_NAME) {
        joinGame(PLAYER_NAME);
    } else {
        showNameEntryScreen();
    }
};

// ---- server events ----
socket.on("join-approved", (player) => {
    PLAYER_ID = player.id || null;
    PLAYER_NAME = player.name || null;

    if(PLAYER_ID) {
        localStorage.setItem("playerId", PLAYER_ID);
    }
    if(PLAYER_NAME) {
        localStorage.setItem("playerName", PLAYER_NAME);
    }

    console.log("[client] join-approved:", player, "localStorage:", {
        playerId: localStorage.getItem("playerId"),
        playerName: localStorage.getItem("playerName")
    });

    playerDisplayName.textContent = `${PLAYER_NAME}`;
    showMainGameScreen();
});

socket.on("join-denied", (data) => {
    alert(data.reason);
    showNameEntryScreen();
});

socket.on("player-list", (list) => {
    renderPlayerList(list);
});

socket.on("playerJoinedAnnouncement", (name) => {
    addLog(`${name} has joined.`);
});

// player list
function renderPlayerList(list) {
    playerList.innerHTML = "";

    list.forEach(player => {
        const li = document.createElement("li");
        li.textContent = player.name;
        playerList.appendChild(li);
    });

    // auto scroll to bottom
    playerList.scrollTop = playerList.scrollHeight;
}

// ---- event log ----
socket.on("event-log", msg => addLog(msg));

function addLog(message) {
    const li = document.createElement("li");
    li.textContent = message;
    eventLog.appendChild(li);

    // auto scroll to bottom
    eventLog.scrollTop = eventLog.scrollHeight;
}

// ---- character creation ----
createCharBtn.addEventListener("click", () => {
    socket.emit("create-character", {
        name: charNameInput.value.trim(),
        maxHp: parseInt(charHpInput.value),
        isEnemy: enemyCheck.checked
    });
    charNameInput.value = "";
});

socket.on("character-list", (chars) => {
    characterListDiv.innerHTML = "";

    chars.forEach(c => {
        const div = document.createElement("div");
        div.className = "character-card";

        div.innerHTML = ` <h3>${c.name} ${c.isEnemy ? "(Enemy)" : ""}</h3>
            <p>HP: 
                <input type="number" value="${c.hp}" min="0" max="${c.maxHp}" data-id="${c.id}" class="hpInput">
                / ${c.maxHp}
            </p>
            <textarea class="noteBox" data-id="${c.id}" placeholder="Notes...">${c.notes || ""}</textarea>
            <button class="deleteCharBtn" data-id="${c.id}">Remove</button>
        `;

        characterListDiv.appendChild(div);
    });
});

// ---- character updates ----
document.addEventListener("input", (e) => {
    if(e.target.classList.contains("hpInput")) {
        socket.emit("character-update", {
            id: e.target.dataset.id,
            hp: parseInt(e.target.value)
        });
    }

    if(e.target.classList.contains("noteBox")) {
        socket.emit("character-update", {
            id: e.target.dataset.id,
            notes: e.target.value
        });
    }
});

document.addEventListener("click", (e) => {
    if(e.target.classList.contains("deleteCharBtn")) {
        socket.emit("delete-character", e.target.dataset.id);
    }
});

// ---- shared dice ----
sharedBtn.addEventListener("click", () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    socket.emit("sharedRoll", roll);
});

socket.on("sharedRollResult", (data) => {
    sharedResult.textContent = "Shared roll: " + data.roll;
    addLog(`${data.name} rolled a ${data.roll}`);
});

// ---- name change ----
function changeName() {
    const newName = prompt("Enter new name:");
    if(!newName) return;

    socket.emit("change-name", newName);
}

socket.on("name-change-approved", (player) => {
    PLAYER_NAME = player.name;
    localStorage.setItem("playerName", PLAYER_NAME);
    playerDisplayName.textContent = `${PLAYER_NAME}`;
    console.log("[client] name-change-approved, saved playerName:", PLAYER_NAME);
});

socket.on("name-change-denied", (data) => {
    alert(data.reason);
});

// ---- characters ----
function renderCharacters(characters) {
    characterGrid.innerHTML = "";

    characters.forEach(c => {
        const card = document.createElement("div");
        card.className = "character-card";

        const hpPercent = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));

        card.innerHTML = `
            <img src="${c.img || "https://via.placeholder.com/60"}">

            <div class="character-name">${c.name}</div>

            <div class="hp-container">
                <div class="hp-label">HP: ${c.hp} / ${c.maxHp}</div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width:${hpPercent}%"></div>
                </div>
            </div>

            <div class="misc-info">
                ${c.type1 || ""} ${c.type2 ? "/" + c.type2 : ""}
            </div>
        `;

        characterGrid.appendChild(card);
    });
}

socket.on("characters-update", (characters) => {
    renderCharacters(characters);
});