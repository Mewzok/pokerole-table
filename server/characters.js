import { Character } from "../data/models/Character.js";
import crypto from "crypto";

export const characters = new Map();
// key: charId
// value: Character instance

export function createCharacter({ pokemonId, name, }) {
    const id = crypto.randomUUID();
    const character = new Character({
        id,
        pokemonId,
        name
    });
    character.set(id, character);
    return character;
}

export function updateCharacter(id, updates) {
    const char = characters.get(id);
    if(!char) {
        return null;
    }
    Object.assign(char, updates);
    return char;
}

export function deleteCharacter(id) {
    const char = characters.get(id);
    if(!char) {
        return null;
    }
    characters.delete(id);
    return char;
}

export function listCharacters() {
    return Array.from(characters.values());
}