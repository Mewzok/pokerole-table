import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pokemonData = require("../pokemon.json");

export class Character {
    constructor({
        id,
        pokemonId,
        name = null,
        hp = null,
        will = 0,
        initiative = 0,
        ability = null,
        stats = {},
        skills = {},
        moves = [],
        items = [],
        conditions = [],
        imageOverride = null
    }) {
        this.id = id;
        this.pokemonId = pokemonId;
        
        this.species = pokemonData.find(p => p.id === pokemonId);
        if(!this.species) {
            throw new Error(`Pokemon '${pokemonId}' not found in database.`);
        }

        this.name = name || this.species.name;

        this.hp = hp ?? 3;

        this.will = will;
        this.initiative = initiative;

        this.stats = {
            HP: this.species.baseStates.HP,
            strength: this.species.baseStates.strength,
            dexterity: this.species.baseStates.dexterity,
            vitality: this.species.baseStates.vitality,
            special: this.species.baseStates.special,
            insight: this.species.baseStates.insight,
            ...stats
        };

        this.skills = {
            ...(this.species.defaultSkills || {}),
            ...skills
        };

        this.items = items;
        this.conditions = conditions;

        this.image = imageOverride || this.species.image;
    }
}