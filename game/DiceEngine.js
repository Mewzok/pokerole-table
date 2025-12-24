export function rollDice(diceCount, successThreshold = 4) {
    if(diceCount < 0) diceCount = 0;

    const rolls = [];
    let successes = 0;

    for(let i = 0; i < diceCount; i++) {
        const roll = Math.floor(Math.random() * 6) + 1;
        rolls.push(roll);
        if(roll >= successThreshold) successes++;
    }

    return {
        rolls,
        successes,
        diceCount,
        successThreshold,
        timestamp: Date.now()
    };
}