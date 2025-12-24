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

let PLAYER_ID = localStorage.getItem("playerId") || null;
let PLAYER_NAME = localStorage.getItem("playerName") || null;

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
    PLAYER_ID = player.id;
    PLAYER_NAME = player.name;

    localStorage.setItem("playerId", PLAYER_ID);
    localStorage.setItem("playerName", PLAYER_NAME);

    playerDisplayName.textContent = `${PLAYER_NAME}`;
    showMainGameScreen();

    setInterval(() => {
        socket.emit("heartbeat");
    }, 5000);
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
});

socket.on("name-change-denied", (data) => {
    alert(data.reason);
});