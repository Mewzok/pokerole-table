let movesData = {};

export async function loadMoves() {
    const res = await fetch("/data/moves.json");
    const data = await res.json();

    data.forEach(move => {
        movesData[move.id] = move;
    });

    console.log("[moves] Loaded ", Object.keys(movesData).length);
}