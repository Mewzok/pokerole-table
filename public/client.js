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
const characterGrid = document.getElementById("character-grid");

// character creator variables
let CHARACTERS = [];
let editingCharacterId = null;

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
const SKILLS = ["Brawl", "Channel", "Clash", "Evasion", "Alert", "Athletic", "Nature", "Stealth", "Allure", "Etiquette", "Intimidate", "Perform"];
const sizeSlider = document.getElementById("sheet-size");
const sizeLabel = document.getElementById("sheet-size-label");
const dimensionsDiv = document.getElementById("sheet-dimensions");
let skillPointsRemaining = 3;
let skillValues = {};

// move variables
const MOVE_XP_COST = {
    beginner: 5,
    amateur: 10,
    ace: 15,
    pro: 20,
    master: 25,
    champion: 30
};

const RANK_ORDER = [
    "starter",
    "beginner",
    "amateur",
    "ace",
    "pro",
    "master",
    "champion"
];

// pokemon variables
let currentSpecies = null;
const speciesPicker = document.getElementById("sheet-species-picker");
window.POKEMON = [];

// move variables
let MOVES = {};

// handle pokemon
async function loadPokemonData() {
    try {
        const res = await fetch("/data/pokemon.json");
        const data = await res.json();
        window.POKEMON = data;
        console.log("[client] Loaded pokemon:", data.length);
        populateSpeciesDropdown();
    } catch (err) {
        console.error("Failed to load pokemon.json", err);
    }
}

async function loadMoves() {
    const res = await fetch("/data/moves.json");
    const data = await res.json();

    data.forEach(move => {
        MOVES[move.id] = move;
    });

    console.log(`[moves] Loaded $(Object.keys(MOVES).length) moves`);
}

window.addEventListener("load", async () => {
    await loadPokemonData();
    await loadMoves();
});

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
        const species = window.POKEMON?.find(p => p.id === c.pokemonId);
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

    const species = window.POKEMON.find(p => p.id === char.pokemonId);

    document.getElementById("sheet-species-name").textContent = species.name;
    document.getElementById("sheet-nickname").value = char.nickname || "";
    document.getElementById("sheet-image").src = char.image;

    renderStats(char);
    renderCalculated(char);
    renderSkills(char);
    renderSize(char);
    renderAbility(char, species);
    renderMovesPanel(char);
}

document.getElementById("createCharacterBtn").onclick = () => {
    editingCharacterId = null;
    
    sheetPanel.style.display = "block";
    speciesPicker.value = window.POKEMON[0].id;
    speciesPicker.dispatchEvent(new Event("change"));

    sheetTitle.textContent = "Create Character";

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

// render attributes
function resetSkills() {
    skillPointsRemaining = 3;
    skillValues = {};
    SKILLS.forEach(s => skillValues[s] = 0);
    renderSkills();
}

function renderSkills() {
    const container = document.getElementById("sheet-skills");
    const pointsLabel = document.getElementById("sheet-skill-points");

    container.innerHTML = "";
    pointsLabel.textContent = `Points Remaining: ${skillPointsRemaining}`;

    SKILLS.forEach(skill => {
        const row = document.createElement("div");
        row.className = "skill-row";

        row.innerHTML = `
            <span>${skill}</span>
            <button data-skill="${skill}" data-dir="-1">−</button>
            <span>${skillValues[skill]} / 5</span>
            <button data-skill="${skill}" data-dir="1">+</button>
        `;

        container.appendChild(row);
    });
}

document.getElementById("sheet-skills").addEventListener("click", e => {
    if(!e.target.dataset.skill) {
        return;
    }

    const skill = e.target.dataset.skill;
    const dir = parseInt(e.target.dataset.dir);

    if(dir === 1 && skillPointsRemaining === 0) {
        return;
    }
    if(dir === -1 && skillValues[skill] === 0) {
        return;
    }
    if(dir === 1 && skillValues[skill] >= 5) {
        return;
    }

    skillValues[skill] += dir;
    skillPointsRemaining -= dir;

    renderSkills();
    renderCalculated(currentSpecies, skillValues);
});

document.getElementById("skills-randomize").onclick = () => {
    resetSkills();
    while(skillPointsRemaining > 0) {
        const s = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        if(skillValues[s] < 5) {
            skillValues[s]++;
            skillPointsRemaining--;
        }
    }
    renderSkills();
    renderCalculated(currentSpecies, skillValues);
};

// gm exp button
document.getElementById("gm-add-exp").onclick = () => {
    currentCharacter.exp += 10;
    refreshCharacterUI(currentCharacter);
};

// pokemon data functions
function populateSpeciesDropdown() {
    if(!window.POKEMON || window.POKEMON.length === 0) {
        return;
    }

    speciesPicker.innerHTML = "";

    window.POKEMON.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        speciesPicker.appendChild(opt);
    });

    var event = new Event('change');
    speciesPicker.dispatchEvent(event);
}

speciesPicker.addEventListener("change", () => {
    const pokemonId = speciesPicker.value;
    const species = window.POKEMON.find(p => p.id === pokemonId);
    if(!species) {
        return;
    }

    currentSpecies = species;
    populateAbilities(species);
    resetSkills();
    updateSizeDisplay(species);
    renderSpeciesInfo(species);
    renderCalculated(species, skillValues);
    renderMovesPanel({species, moves: []});
});

function renderSpeciesStats(species) {
    const statsDiv = document.getElementById("sheet-stats");
    statsDiv.innerHTML = "";

    Object.entries(species.baseStats).forEach(([stat, value]) => {
        const row = document.createElement("div");
        row.className = "stat-row";

        row.innerHTML = `
        <span>${stat}</span>
        <span>${value} / ${species.maxStats[stat] ?? value}</span>
        `;

        statsDiv.appendChild(row);
    });
}

function renderCalculated(species, skills = {}) {
    const calcDiv = document.getElementById("sheet-calculated");
    calcDiv.innerHTML = "";

    const insight = species.baseStats.insight;
    const dex = species.baseStats.dexterity;
    const vit = species.baseStats.vitality;
    const alert = skills.Alert || 0;

    const calculated = {
        "Will: ": insight + 2,
        "Initiative: ": dex + alert,
        "Defense: ": vit,
        "SP Defense: ": insight,
        "Max HP: ": species.baseStats.HP + vit
    };

    Object.entries(calculated).forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "stat-row";
        row.innerHTML = `<span>${label}</span><span>${value}</span>`;
        calcDiv.appendChild(row);
    });
}

function renderSpeciesInfo(species) {
    document.getElementById("sheet-species-name").textContent = species.name;
    document.getElementById("sheet-image").src = species.image;

    // types
    document.getElementById("sheet-types").textContent = species.types.join(" / ");

    // ability
    const abilitySelect = document.getElementById("sheet-ability");
    abilitySelect.innerHTML = "";
    species.abilities.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        abilitySelect.appendChild(opt);
    });

    renderSpeciesStats(species);
    renderCalculated(species);
}

// size functions
sizeSlider.addEventListener("input", () => {
    updateSizeDisplay(currentSpecies);
});

function updateSizeDisplay(species) {
    const size = parseInt(sizeSlider.value);
    sizeLabel.textContent = size;

    const height = (species.height * size / 100).toFixed(2);
    const weight = (species.weight * size / 100).toFixed(2);

    dimensionsDiv.innerHTML = `
        <p>Height: ${height}m / ${convertMetersToFeetInches(height)}</p>
        <p>Weight: ${weight} kg / ${convertKgToLbs(weight)} lbs</p>
    `;
}

function convertMetersToFeetInches(meters) {
    const totalInches = meters * 39.3700787;

    const feet = Math.floor(totalInches / 12);

    const inches = (totalInches % 12).toFixed(0);

    return `${feet}'${inches}"`;
}

function convertKgToLbs(kg) {
    const factor = 2.2046226218;
    return (kg * factor).toFixed(0);
}

// abilitiy functions
function populateAbilities(species) {
    const select = document.getElementById("sheet-ability");
    select.innerHTML = "";

    species.abilities.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        select.appendChild(opt);
    });
}

document.getElementById("ability-random").onclick = () => {
    const abilities = currentSpecies.abilities
    const pick = abilities[Math.floor(Math.random() * abilities.length)];
    document.getElementById("sheet-ability").value = pick;
}

// --------------------------------------------------------------------------- move functions ---------------------------------------------------------------------------
function renderActiveMoves(character) {
    const grid = document.getElementById("active-moves-grid");
    grid.innerHTML = "";

    if(!character.moves || character.moves.length === 0) {
        grid.innerHTML = "<em>No active moves</em>";
        return;
    }

    character.moves.forEach(moveId => {
        const move = MOVES[moveId];
        if(!move) {
            return;
        }

        const card = createMoveCard(move, { active: true, ok: true });
        grid.appendChild(card);
    });
}

function renderLearnableMoves(character, species) {
    document.querySelectorAll(".move-rank-group").forEach(group => {
        const rank = group.dataset.rank;
        const grid = group.querySelector(".moves-grid");

        grid.innerHTML = "";

        const moveIds = species.moves[rank] || [];

        moveIds.forEach(moveId => {
            const move = MOVES[moveId];
            if(!move) {
                return;
            }

            const card = createMoveCard(move, { ok: false, reason: rank.toUpperCase() });
            grid.appendChild(card);
        });
    });
}

function createMoveCard(move, state) {
    const card = document.createElement("div");
    card.classList.add("move-card");

    card.innerHTML = `
        <div class="move-header">
            <span class="move-name">${move.name}</span>
            <span class="move-type ${move.type.toLowerCase()}">${move.type}</span>
        </div>

        <div class="move-meta">
            <span>${move.category}</span>
            <span>Power: ${move.power.base} + ${move.power.scaling}</span>
            <span>Accuracy: ${move.accuracy.formula}</span>
        </div>

        <p class="move-desc">${move.description}</p>

        <div class="move-actions">
            ${renderMoveActionButton(state, move)}
        </div>
    `;

    return card;
}

function renderMoveActionButton(state, move) {
    if(!state.ok) {
        return `<button disabled>${state.reason}</button>`;
    }

    return `<button onclick="learnMove('${move.id}')">Learn</button>`;
}

function renderMove(moveId) {
    const move = MOVES[moveId];
    if(!move) {
        return "<div>Unknown move</div>";
    }
    return createMoveCard(move);
}

function canLearnMove(species, moveId, moveRank, character) {
    // already learned?
    if(character.moves.includes(moveId)) {
        return { ok: false, reason: "known" };
    }

    // rank locked?
    const speciesRankIndex = RANK_ORDER.indexOf(species.rank.toLowerCase());
    const moveRankIndex = RANK_ORDER.indexOf(moveRank);
    if(moveRankIndex > speciesRankIndex) {
        return { ok: false, reason: "rank" };
    }

    // exp check
    const cost = MOVE_EXP_COSTS[moveRank];
    if(character.exp < cost) {
        return { ok: false, reason: "exp" };
    }

    return { ok: true };
}

function renderMovesPanel(character) {
    const species = character.species;
    renderActiveMoves(character);
    renderLearnableMoves(character, species);
}

// handle GM
if(!window.isGM) {
    document.querySelectorAll(".gm-only").forEach(e => e.remove());
}