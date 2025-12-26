import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pokemonData = require("../pokemon.json");

export class Character {
    constructor({
        id,
        ownerId = null,
        pokemonId,
        nickname = null,

        // core state
        hp = null,
        maxHp = null,
        exp = 0,
        level = 1,

        // optional overrides
        ability = nill,
        heightPercent = 1.0,
        weightPercent = 1.0,

        stats = {},
        skills = {},
        contest = {},

        logic = 1,
        instinct = 1,
        primal = 0,

        movesLearned = [],
        activeMoves = [],

        items = [],
        accessories = [],
        conditions = ["Healthy"],

        imageOverride = null
    }) {
        // ---- Basic Required Fields ----
        this.id = id;
        this.ownerId = ownerId;
        this.pokemonId = pokemonId;

        // ---- Look Up Species ----
        this.species = pokemonData.find(p => p.id === pokemonId);
        if(!this.species) {
            throw new Error(`Pokémon '${pokemonId}' not found in database.`);
        }

        // ---- Name / Identity ----
        this.nickname = nickname || this.species.name;

        // ---- Base + Max Stats ----
        this.baseStats = { ...this.species.baseStats };
        this.maxStats = { ...this.species.maxStats };

        // ---- Character Current Stats (can change in gameplay) ----
        this.stats = {
            HP: this.baseStats.HP,
            strength: this.baseStats.strength,
            dexterity: this.baseStats.dexterity,
            vitality: this.baseStats.vitality,
            special: this.baseStats.special,
            insight: this.baseStats.insight,
            ...stats
        };

        // ---- Skills ----
        const defaultSkills = {
            brawl: 0,
            channel: 0,
            clash: 0,
            evasion: 0,
            alert: 0,
            athletic: 0,
            nature: 0,
            stealth: 0,
            allure: 0,
            etiquette: 0,
            intimidate: 0,
            perform: 0
        };

        this.skills = {
            ...defaultSkills,
            ...skills(skills | {})
        };

        // ---- Contest Stats ----
        const defaultContest = {
            tough: 1,
            cool: 1,
            beauty: 1,
            cute: 1,
            clever: 1
        };

        this.contest = {
            ...defaultContest,
            ...(contest || {})
        };

        // ---- Logic / Instinct / Primal ----
        this.logic = logic ?? 1;
        this.instinct = instinct ?? 1;
        this.primal = primal ?? 0;

        // ---- Moves ----
        this.movesLearned = movesLearned.length ? movesLearned : this.getStarterMoves();
        this.activeMoves = activeMoves.length ? activeMoves.slice(0, 4) : this.activeMoves.movesLearned.slice(0, 4);

        // ---- Height / Weight ----
        this.heightPercent = Math.max(0.5, Math.min(1.5, heightPercent));
        this.weightPercent = Math.max(0.5, Math.min(1.5, weightPercent));

        // ---- HP ----
        this.maxHp = maxHp ?? this.stats.HP;
        this.hp = hp ?? this.maxHp;

        // ---- Calculate Values ----
        this.will = this.stats.insight + 2;
        this.initiative = (this.stats.dexterity || 0) + (this.skills.alert || 0);
        this.defense = this.stats.vitality;
        this.specialDefense = this.stats.insight;

        // ---- EXP / Level ----
        this.exp = exp;
        this.level = level;

        // ---- Items ----
        this.items = items || [];
        this.accessories = accessories || [];

        // ---- Conditions ----
        this.conditions = conditions?.length ? conditions : ["Healthy"];

        // ---- Image ----
        this.image = imageOverride || this.species.image;
        this.imageOverride = imageOverride;

        // ---- Ability ----
        this.ability = ability || this.pickDefaultAbility();
    }

    // ----------------------------------
    // Helpers
    // ----------------------------------
    pickDefaultAbility() {
        if(Array.isArray(this.species.abilities) && this.species.abilities.length) {
            return this.species.abilities[0];
        }

        return null;
    }

    getStarterMoves() {
        if(!this.species.moves) {
            return [];
        }

        // later filter by rank
        return this.species.moves.slice(0, 4);
    }
}