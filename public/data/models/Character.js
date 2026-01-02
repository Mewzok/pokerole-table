import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pokemonData = require("../pokemon.json");

const MOVE_EXP_COST = {
    starter: 0,
    beginner: 5,
    amateur: 10,
    ace: 15,
    pro: 20,
    master: 25,
    champion: 30
};

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
            instinct: 1,
            primal: 0
        };

        // ability and nature
        this.ability = this.species.abilities[0];
        this.nature = null;

        // moves
        this.moves = {
            learned: [],
            active: []
        };

        // starter moves (species-defined)
        const starterMoves = this.species.moves?.starter || [];

        // learn starters permanently
        this.moves.learned = [...starterMoves];

        // slot starters by default
        this.moves.active = [...starterMoves];

        // items
        this.items = [];
        this.accessories = [];

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
            initiative: this.stats.dexterity + this.skills.alert,
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
        this.recalculateDerived();

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

    canLearnMove(moveId) {
        return !this.moves.learned.includes(moveId);
    }

    learnMove(moveId, moveRank, { gmOverride = false } = {}) {
        if(this.moves.learned.includes(moveId)) {
            return {
                ok: false,
                reason: "known"
            };
        }

        const cost = MOVE_EXP_COST[moveRank] ?? null;
        if(cost === null) {
            return {
                ok: false,
                reason: "invalid-rank"
            };
        }

        if(!gmOverride) {
            if(!this.spendExp(cost)) {
                return {
                    ok: false,
                    reason: "exp"
                };
            }
        }

        this.moves.learned.push(moveId);

        // auto-slot if space available
        if(Character.MAX_ACTIVE_MOVES === null || this.moves.active.length < Character.MAX_ACTIVE_MOVES) {
            this.moves.active.push(moveId);
        }

        return {
            ok: true
        };
    }

    activateMove(moveId) {
        if(!this.moves.learned.includes(moveId)) {
            return false;
        }
        if(this.moves.active.includes(moveId)) {
            return false;
        }
        if(Character.MAX_ACTIVE_MOVES !== null && this.moves.active.length >= Character.MAX_ACTIVE_MOVES) {
            return false;
        }

        this.moves.active.push(moveId);
        return true;
    }

    deactivateMove(moveId) {
        this.moves.active = this.moves.active.filter(id => id !== moveId);
    }

    spendExp(amount) {
        if(this.exp < amount) {
            return false;
        }
        this.exp -= amount;
        this.level += 1;
        return true;
    }
}

// number of total active move slots. set to null for unlimited
Character.MAX_ACTIVE_MOVES = 4;