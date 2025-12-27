import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pokemonData = require("../pokemon.json");

export class Character {
    constructor({ id, ownerId, ownerName, pokemonId, nickname = null }) {
        this.id = id;
        this.ownerId = ownerId;
        this.ownerName = ownerName;

        this.pokemonId = pokemonId;
        this.species = pokemonData.find(p => p.id === pokemonId);
        if(!this.species) throw new Error(`Pokémon '${pokemonId}' not found.`);

        // identity
        this.nickname = nickname;
        this.level = 1;
        this.exp = 0;

        // base stats (species-defined)
        this.stats = { ...this.species.baseStats };
        this.maxStats = { ...this.species.maxStats };

        // skills
        this.skills = {
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

        this.skillPoints = 3;

        // social
        this.social = {
            tough: 1,
            cool: 1,
            beauty: 1,
            cute: 1,
            clever: 1
        };

        // attributes
        this.attributes = {
            logic: 1,
            instrinct: 1,
            primal: 0
        };

        // ability and nature
        this.ability = this.species.abilities[0];
        this.nature = null;

        // moves
        this.moves = {
            learnset: [],
            active: []
        };

        // items
        this.items = [];
        thjis.accessories = [];

        // conditions
        this.conditions = ["Healthy"];

        // size
        this.size = 1.0;

        this.recalculateSize();

        // overrides
        this.imageOverride = null;

        // derived stats
        this.recalculateDerived();
    }

    recalculateDerived() {
        this.derived = {
            maxHp: this.stats.HP * 3,
            will: this.stats.insight + 2,
            initiative: this.statis.dexterity + this.skills.alert,
            defense: this.stats.vitality,
            spDefense: this.stats.insight
        };

        this.recalculateSize();
        this.hp = this.hp ?? this.derived.maxHp;
    }

    recalculateSize() {
        this.height = +(this.species.height * this.size).toFixed(2);
        this.weight = +(this.species.weight * this.size).toFixed(2);
    }

    get displayName() {
        return this.nickname || this.species.name;
    }

    get image() {
        return this.imageOverride || this.species.image;
    }

    canIncreaseSkill(skill) {
        return this.skills[skill] < 5;
    }

    spendSkillPoint(skill) {
        if(this.skillPoints <= 0) {
            return false;
        }
        if(this.skills[skill] >= 5) {
            return false;
        }

        this.skills[skill]++;
        this.skillPoints--;
        return true;
    }

    getSkillUpgradeCost(skill) {
        const current = this.skills[skill];

        if(current >= 5) {
            return null;
        }
        if(current === 0) {
            return 6;
        }

        return current * 10;
    }

    upgradeSkill(skill) {
        const cost = this.getSkillUpgradeCost(skill);
        if(cost === null) {
            return false;
        }
        if(this.exp < cost) {
            return false;
        }

        this.skills[skill]++;
        this.exp -= cost;
        this.level++;

        return true;
    }

    applyPaidUpgrade(cost = 1) {
        if(this.exp < cost) {
            return false;
        }

        this.exp -= cost;
        this.level++;
        return true;
    }

    getStatUpgradeCost(stat) {
        const next = this.stats[stat] + 1;
        const max = this.species.maxStats[stat];

        if(next > max) {
            return null;
        }
        return next * 10;
    }

    upgradeStat(stat) {
        const cost = this.getStatUpgradeCost(stat);
        if(cost === null) {
            return false;
        }
        if(this.exp < cost) {
            return false;
        }

        this.stats[stat]++;
        this.exp -= cost;
        this.level++;
        this.racalculateDerived();

        return true;
    }

    setLevel(value) {
        this.level = Math.max(1, value);
    }

    setExp(value) {
        this.exp = Math.max(0, value);
    }

    setSkill(skill, value) {
        this.skills[skill] = Math.min(5, Math.max(0, value));
    }

    static MOVE_COSTS = {
        beginner: 5,
        amateur: 10,
        ace: 15,
        pro: 20,
        master: 25
    };
}