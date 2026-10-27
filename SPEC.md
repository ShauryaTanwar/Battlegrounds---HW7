# AI Battle Simulator — Game Proposal

## 1. The Game

### Overview

**AI Battle Simulator** is a creative, two-player battle game where players can pit almost anything against anything else. Each player describes an army to a large language model (LLM), which turns those descriptions into characters and units that battle on a shared map.

The fun comes from experimenting with unusual army compositions, seeing creative prompts come to life, and discovering which team wins.

### Core Game Loop

1. **Create armies (2 minutes):** Player 1 and Player 2 each have two minutes to submit prompts describing the characters and units on their teams.
2. **Generate units:** An LLM interprets each prompt and generates the requested characters, subject to clear, fair rules and a team power cap evaluated by the LLM.
3. **Battle:** Both teams fight automatically. Characters target the opposing team and interact with other units on the map.
4. **Determine the winner:** The last team with surviving characters wins.
5. **Reveal prompts:** At the end of the match, both players can view their own prompts and their opponent's prompts.

## 2. Full Intended Feature Set

The complete vision includes features that may not be achievable within the initial one-hour development period.

### Core Features

- **Two-player local play:** Both players can play on the same device.
- **Prompt-based army creation:** Players describe their armies in natural language.
- **LLM-generated characters:** An LLM translates prompts into functional game units while enforcing reasonable constraints and a power cap.
- **Randomized maps:** Each match can take place on a randomly generated or selected battlefield.
- **Character behavior and combat:** Units can move, target opponents, interact with one another, take damage, and die.
- **Player cameras:** Players can freely fly around the map to watch the battle or spectate individual units.
- **Main menu:** A screen for starting and navigating the game.
- **Complete game loop:** Army creation, generation, battle, victory determination, and post-match prompt reveal.

### Additional Features

- **Predefined basic troops:** Players can add simple, ready-made units without writing detailed prompts.
- **Character suggestions:** The game can suggest possible characters or army ideas.
- **Game history log:** Players can review previous matches and results.

## 3. Acceptance Criteria

The game is considered complete when the following criteria can be verified:

1. **Same-device multiplayer:** Two players can create teams and participate in a match on the same device.
2. **Consistent LLM generation:** The LLM reliably converts supported player prompts into functional characters and applies a fair, consistent evaluation of each team's power against the cap.
3. **Enemy targeting and unit interaction:** Characters automatically target units on the opposing team while remaining capable of interacting with other characters on the map.
4. **Health and death:** Every character has health and is removed from combat or marked defeated when its health reaches zero.
5. **Prompt fidelity:** Generated characters reasonably reflect the descriptions provided by players, within the game's technical and balance constraints.
6. **Free-roaming camera:** Players can move a camera freely around and above the battlefield to observe their teams.
7. **Unit spectating:** Players can choose a unit and follow its perspective or movement during combat.
8. **Win condition:** The match ends when one team has no surviving characters, and the remaining team is declared the winner.

## 4. Priorities and Scope Trade-offs

### Highest Priority

The initial implementation should focus on making the battlefield playable and watchable:

1. **Character physics and behavior:** Functional movement, interactions, and combat.
2. **Maps:** A usable environment where battles can take place.
3. **Player cameras:** Free-roaming observation and unit spectating.
4. **Core game loop:** Two teams are created, fight, and produce a winner.

### If Time Runs Short

**Simplify LLM integration first.** LLM-generated units are likely the hardest feature to implement reliably. If integration is not feasible, replace them with **predefined characters** while keeping the same two-team battle structure and game loop.

After that, defer secondary features such as the game history log, character suggestions, and extra menu polish. Keep the central experience—two players assembling teams, watching them fight, and seeing a winner—intact.
