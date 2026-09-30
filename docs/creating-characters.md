# Creating characters

Characters should expose a small deterministic action API rather than forcing each scene to know their internal SVG structure.

A useful character module might provide:

```js
const character = MAFIA.myCharacter.insert("#layer", "unique-prefix");
MAFIA.myCharacter.enter(tl, character, 0.2);
MAFIA.myCharacter.react(tl, character, 1.4);
MAFIA.myCharacter.exit(tl, character, 3.2);
```

Guidelines:

- prefix SVG IDs so several instances can coexist
- make actions finite
- derive time-sensitive procedural state from time/seed
- keep the character independent from one specific video
- include a tiny demo and document available actions
- visually inspect extreme poses, not only the idle state

The public `signal` character is deliberately simple; it exists to demonstrate the contract.
