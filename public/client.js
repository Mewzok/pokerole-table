// grab page elements
const socket = io();

const joinScreen = document.getElementById("joinScreen");
const gameScreen = document.getElementById("gameScreen");
const eventLog = document.getElementById("eventLog");

// dev tools
const DEV_BYPASS = false;

// player variables
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const joinStatus = document.getElementById("joinStatus");
const playerList = document.getElementById("playerList");
const playerDisplayName = document.getElementById("playerDisplayName");

// character variables
const characterListDiv = document.getElementById("characterList");
const characterGrid = document.getElementById("character-grid");
let selectedCharacterId = null;

// character creator variables
let CHARACTERS = [];
let editingCharacterId = null;
const dialog = document.getElementById("characterDialog");
const charNameInput = document.getElementById("charNameInput");
const charHpInput = document.getElementById("charHpInput");

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
const tabButtons = document.querySelectorAll(".tabBtn");
const tabViews = document.querySelectorAll(".tabView");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;

        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        tabViews.forEach(v => {
            v.classList.remove("active");
        });

        document.getElementById(`tab-${tab}`).classList.add("active");
    });
});

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
    IS_GM = player.isGM;

    if(PLAYER_ID) {
        localStorage.setItem("playerId", PLAYER_ID);
    }
    if(PLAYER_NAME) {
        localStorage.setItem("playerName", PLAYER_NAME);
    }

    document.getElementById("playerDisplayName").textContent = `${IS_GM ? "(GM) " : ""}${PLAYER_NAME}`;

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
socket.on("character-list", (chars) => {
    CHARACTERS = chars;
    renderCharacterList();
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

function renderCharacterList() {
    const container = document.getElementById("characterList");
    container.innerHTML = "";

    if (!CHARACTERS || CHARACTERS.length === 0) {
        container.innerHTML = "<p>No characters yet.</p>";
        return;
    }

    CHARACTERS.forEach(char => {
        const div = document.createElement("div");
        div.className = "character-card";

        div.innerHTML = `
            <h3>${char.name}</h3>
            <p>HP: ${char.hp}/${char.maxHp}</p>
            ${char.ownerName ? `<p>Owner: ${char.ownerName}</p>` : ""}
            <div class="char-buttons">
                <button onclick="editCharacter('${char.id}')">Edit</button>
                <button onclick="deleteCharacter('${char.id}')">Delete</button>
            </div>
        `;

        container.appendChild(div);
    });
}

document.getElementById("createCharacterBtn").onclick = () => {
    editingCharacterId = null;
    document.getElementById("charDialogTitle").textContent = "Create Character";
    charNameInput.value = null;
    charHpInput.value = 3;
    dialog.showModal();
};

document.getElementById("cancelCharacterBtn").onclick = () => {
    dialog.close();
};

document.getElementById("saveCharacterBtn").onclick = () => {
    const name = charNameInput.value.trim();
    const maxHp = parseInt(charHpInput.value);

    if(!name || maxHp <= 0) {
        return;
    }

    if(editingCharacterId) {
        socket.emit("update-character", {
            id: editingCharacterId,
            name,
            maxHp,
            hp: maxHp
        });
    } else {
        socket.emit("create-character", {
            name,
            maxHp
        });
    }

    dialog.close();
};

window.editCharacter = function(id) {
    const c = CHARACTERS.find(x => x.id === id);
    if(!c) {
        return;
    }

    editingCharacterId = id;

    document.getElementById("charDialogTitle").textContent = "Edit Character";
    charNameInput.value = c.name;
    charHpInput.value = c.maxHp;

    dialog.showModal();
};

window.deleteCharacter = function(id) {
    if(!confirm("Delete this character?")) {
        return;
    }
    socket.emit("delete-character", id);
};

// render characters
socket.on("characterListUpdated", (characters) => {
    const grid = document.getElementById("character-grid");
    grid.innerHTML = ""; // clear grid
    characters.forEach(char => {
    const card = document.createElement("div");
    card.className = "character-card";
    card.dataset.id = char.id;

    card.innerHTML = `
      <img src="${char.image}" alt="${char.name}" />
      <h4>${char.name}</h4>
      <p>HP: ${char.hp}/${char.maxHp}</p>
      <p>Items: ${char.items?.join(", ") || "None"}</p>
    `;

    // highlight/select
    card.addEventListener("click", () => {
      document.querySelectorAll(".character-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedCharacterId = char.id;

      // update the player stat card panel
      renderPlayerStatCard(char);
    });

    grid.appendChild(card);
  });
});

// render player stat card
function renderPlayerStatCard(char) {
    const panel = document.getElementById("player-stat-card");

    panel.innerHTML = `
    <h3>${char.name}</h3>
    <img src="${char.image}" alt="${char.name}" />
    <p>HP: ${char.hp}/${char.maxHp}</p>
    <p>Will: ${char.will}</p>
    <p>Initiative: ${char.initiative}</p>
    <p>Stats: ${JSON.stringify(char.stats)}</p>
    <p>Skills: ${JSON.stringify(char.skills)}</p>
    <p>Moves: ${char.moves?.join(", ") || "None"}</p>
  `;
}

// render character sheet
function openCharacterSheet(char) {
    const panel = document.getElementById("character-sheet-panel");

    panel.innerHTML = `<h2>${char.name}</h2>

    <img src="${char.image}" style="width:150px">

    <label>Name</label>
    <input id="edit-name" value="${char.name}">

    <label>HP</label>
    <input id="edit-hp" type="number" value="${char.hp}">
    
    <label>Will</label>
    <input id="edit-will" type="number" value="${char.will}">

    <h3>Stats</h3>
    <pre>${JSON.stringify(char.stats, null, 2)}</pre>

    <h3>Moves</h3>
    <pre>${char.moves?.join(", ")}</pre>

    <button id="save-character-btn">Save</button>
    <button id="delete-character-btn" class="gm-only">Delete</button>
  `;
}

// handle GM
if(!window.isGM) {
    document.querySelectorAll(".gm-only").forEach(e => e.remove());
}