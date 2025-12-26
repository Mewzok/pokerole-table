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

// character creator sheet variables
const sheetPanel = document.getElementById("character-sheet-panel");
const sheetTitle = document.getElementById("sheet-title");
const sheetName = document.getElementById("sheet-name");
const sheetSpecies = document.getElementById("sheet-species");
const sheetMaxHp = document.getElementById("sheet-maxhp");
const sheetSave = document.getElementById("sheet-save");
const sheetCancel = document.getElementById("sheet-cancel");
const sheetDelete = document.getElementById("sheet-delete");
const createCharacterBtn = document.getElementById("createCharacterBtn");

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
    renderCharacters(chars);
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

    if(!characters || characters.length === 0) {
        characterGrid.innerHTML = "<p>No characters yet.</p>";
        return;
    }

    characters.forEach(c => {
        const species = window.pokemon?.find(p => p.id === c.pokemonId);
        const hpPercent = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));

        const card = document.createElement("div");
        card.className = "character-card";

        card.innerHTML= `
            <img src="${species?.image || "https://via.placeholder.com/80"}">

            <div class="character-name">${c.name}</div>

            <div class="misc-info">
                ${species?.type1 || ""} ${species?.type2 ? "/" + species.type2 : ""}
            </div>

            <div class="hp-container">
                <div class="hp-label">HP: ${c.hp} / ${c.maxHp}</div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width:${hpPercent}%"></div>
                </div>
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
        `;

        div.onclick = () => openCharacterSheet(char);
        container.appendChild(div);
    });
}

function openCharacterSheet(char) {
    editingCharacterId = char.id;
    sheetPanel.style.display = "block";
    createCharacterBtn.style.display = "none";

    const species = window.pokemon.find(p => p.id === char.pokemonId);

    sheetTitle.textContent = `Editing ${char.nickname || char.name}`;
    document.getElementById("sheet-species-name").textContent = species.name;

    // nickname
    document.getElementById("sheet-nickname").value = char.nickname || "";

    // image
    const img = document.getElementById("sheet-image");
    img.src = char.image;
    img.alt = char.nickname || char.name;

    // type
    document.getElementById("sheet-types").textContent = species.types.join(" / ");

    // stats
    const statDiv = document.getElementById("sheet-stats");
    statDiv.innerHTML = `
            <p>HP: ${char.stats.HP}</p>
            <p>Strength: ${char.stats.strength}</p>
            <p>Dexterity: ${char.stats.dexterity}</p>
            <p>Vitality: ${char.stats.vitality}</p>
            <p>Special: ${char.stats.special}</p>
            <p>Insight: ${char.stats.insight}</p>
        `;

        // calculated
        const calcDiv = document.getElementById("sheet-calculated");
        calcDiv.innerHTML = `
            <p>Will: ${char.will}</p>
            <p>Initiative: ${char.initiative}</p>
            <p>Defense: ${char.defense}</p>
            <p>Special Defense: ${char.specialDefense}</p>
        `;

        // abilities dropdown
        const abilitySelect = document.getElementById("sheet-abilities");
        abilitySelect.innerHTML = "";
        species.abilities.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a;
            opt.textContent = a;
            if(a === char.abilitiy) opt.selected = true;
            abilitySelect.appendChild(opt);
        });

        // height + weight
        const h = document.getElementById("sheet-height");
        const w = document.getElementById("sheet-weight");

        h.value = (char.heightPercent || 1) * 100;
        w.value = (char.weightPercent || 1) * 100;

        document.getElementById("sheet-height-label").textContent = h.value;
        document.getElementById("sheet-weight-label").textContent = w.value;

        h.oninput = () => 
            document.getElementById("sheet-height-label").textContent = h.value;

        w.oninput = () => 
            document.getElementById("sheet-weight-label").textContent = w.value;

        // ---- Skills ----
        const skillDiv = document.getElementById("sheet-skills");
        skillDiv.innerHTML = "";

        Object.entries(char.skills).forEach(([name, value]) => {
            const row = document.createElement("div");
            row.innerHTML = `
                ${name}:
                <input type="number" min="0" max="5"
                    data-skill="${name}"
                    value="${value}">
            `;
            skillDiv.appendChild(row);
        });

        // GM delete permissions
        sheetDelete.style.display = IS_GM || char.ownerId === PLAYER_ID ? "inline-block" : "none";
}

document.getElementById("createCharacterBtn").onclick = () => {
    editingCharacterId = null;
    
    sheetPanel.style.display = "block";
    sheetTitle.textContent = "Create Character";

    sheetName.value = "";
    sheetSpecies.value = "";
    sheetMaxHp.value = 3;

    sheetDelete.style.display = "none";

    // hide button while sheet is open
    createCharacterBtn.style.display = "none";
};

sheetCancel.onclick = () => {
    sheetPanel.style.display = "none";
    createCharacterBtn.style.display = "inline-block";
}

sheetSave.onclick = () => {
    const nickname = document.getElementById("sheet-nickname").value.trim();
    const ability = document.getElementById("sheet-ability").value;

    const height = document.getElementById("sheet-height").value / 100;
    const weight = document.getElementById("sheet-weight").value / 100;

    const skillInputs = document.querySelectorAll("#sheet-skills input");
    const skills = {};
    skillInputs.forEach(s => {
        skills[s.dataset.skill] = parseInt(s.value) || 0;
    });

    socket.emit("update-character", {
        id: editingCharacterId,
        nickname,
        ability,
        heightPercent: height,
        weightPercent: weight,
        skills
    });

    sheetPanel.style.display = "none";
    createCharacterBtn.style.display = "inline-block";
};

sheetDelete.onclick = () => {
    if(!confirm("Delete this character?")) {
        return;
    }
    socket.emit("delete-character", editingCharacterId);
    sheetPanel.style.display = "none";
    createCharacterBtn.style.display = "inline-block";
};

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

// handle GM
if(!window.isGM) {
    document.querySelectorAll(".gm-only").forEach(e => e.remove());
}