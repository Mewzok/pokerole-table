window.pokemon = [];

async function loadPokemon() {
    try {
        const res = await fetch("/data/pokemon.json");
        window.pokemon = await res.json();

        console.log("Loaded pokemon:", window.pokemon.length);

    } catch (err) {
        console.error("Failed loading pokemon.json", err);
    }
}

loadPokemon();