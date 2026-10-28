# Architecture and file guide

## Design in one paragraph

Node serves a JSON generation endpoint and a Vite development app (or built static assets). The browser owns the entire local match: drafting, deterministic simulation, 3D rendering, camera controls, and results. Both environments import the same catalog and army normalizer. This prevents AI-generated stats or client parsing differences from changing the power cap. There is no database, authentication layer, network multiplayer, asset pipeline, or dependency on React.

## File tree

```text
Battlegrounds - HW7/
├── SPEC.md                     Original game proposal; unchanged
├── README.md                   User setup, play instructions, feature summary
├── AGENTS.md                   Persistent guidance for future agents
├── package.json                Scripts, runtime requirements, dependencies
├── package-lock.json           Exact dependency resolution; commit this
├── .env.example                Safe server configuration template
├── .gitignore                  Excludes secrets, dependencies, build output
├── .prettierignore             Generated files and original spec stay unformatted
├── index.html                  Vite entry; viewport, graphics root, UI root, toast
├── public/
│   └── favicon.svg             Local vector favicon
├── server/
│   ├── index.js                HTTP lifecycle, routes, dev/static serving
│   └── generation.js           Responses API call and strict output schema
├── src/
│   ├── main.js                 UI screens, interaction handlers, match lifecycle
│   ├── style.css               Full interface, responsive states, map thumbnails
│   ├── game/
│   │   ├── catalog.js          Role stats, caps, maps, suggestions, validation
│   │   ├── random.js           Seeded PRNG and string hash helper
│   │   ├── maps.js             Seeded blocker geometry and arena dimensions
│   │   ├── offline.js          No-key keyword-to-army interpreter
│   │   ├── simulation.js       Pure fixed-step combat and movement
│   │   └── renderer.js         Three.js scene, meshes, effects, picking, camera
│   └── ui/
│       ├── html.js             Text escaping, clock formatting, inline icons
│       └── storage.js          Defensive browser-local match history storage
├── tests/
│   ├── balance.test.js         Caps, normalization, parser, seeded maps
│   ├── simulation.test.js      Combat, healing, splash, draws, determinism
│   ├── generation.test.js      Mocked API success and failure behavior
│   ├── scene.test.js           Real Three.js geometry checks without a GPU
│   ├── server.test.js          Real local HTTP endpoint / private-file checks
│   └── ui.test.js              DOM match flow with a stub graphics adapter
└── docs/
    ├── ARCHITECTURE.md         This document
    ├── GAME_SYSTEMS.md         Rules, algorithms, stats, camera, visual adapter
    ├── AI_INTEGRATION.md       Provider setup, contracts, errors, privacy
    ├── TESTING.md              Evidence and manual acceptance checks
    ├── HANDOFF.md              State of work, limitations, future priorities
    └── DEVELOPMENT.md          Developer commands and troubleshooting
```

`node_modules/` and `dist/` are generated and ignored. `.env` is private and ignored. The final source of the game is the tracked JavaScript, CSS, HTML, and Markdown, not `dist/`.

## Runtime boundaries

### Server

`server/index.js` uses Node's built-in `http` module. Development creates Vite in middleware mode on the same server, so the UI and API share an origin and there is no second API port or CORS configuration. Production mode is selected by `--production`; it serves `dist/` with path containment checks and simple MIME handling. Only static HTML/assets are exposed in production, never `.env` or source directories.

The server loads `.env` through Node's `--env-file-if-exists` flag in the npm scripts. `HOST`, `PORT`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are server environment variables. Vite does not receive a client-facing API key.

`server/generation.js` accepts an army prompt and calls the OpenAI Responses API through the built-in `fetch`. Its exported function accepts an injected fetch implementation for tests. The strict response schema permits a list of approved groups, not executable code. All output passes through `normalizeArmy` before reaching the browser.

### Browser coordinator

`src/main.js` owns mutable UI state in one `state` object. This includes `screen`, `player`, `teams`, selected map and seed, timer, generation status, provider mode, battle speed, pause, selected unit, and modal. Screen functions return escaped HTML. `render()` replaces `#app` at state transitions; a small battle HUD update runs approximately every 150 ms.

One delegated click listener on `#app` dispatches `data-action` attributes. Input and change listeners update the draft text/name, timer option, and generation mode. Keyboard handling handles shortcuts and modal focus. Camera key state is owned by the renderer.

The frame loop clamps visual elapsed time, counts down drafting/countdown, advances combat using a fixed-step accumulator, forwards simulation events to rendering/feed, updates the HUD, then draws the scene. The simulation does not know the UI frame rate or playback speed.

### Pure rules

`catalog.js`, `random.js`, `maps.js`, `offline.js`, and `simulation.js` run directly in Node tests. They must not access `window`, `document`, WebGL, `localStorage`, or provider credentials. This makes mechanics fast to test without launching a browser.

### Renderer

`Battlefield` is the only module importing Three.js. Its `setMap` and `setUnits` replace the current visual scene. Its `event` method spawns short-lived visual effects. `update` reads unit data and updates positions, animation, health bars, and camera movement. The renderer owns picking through a Three.js raycaster and reports selected IDs to the coordinator.

Meshes store `userData.unitId`; the application resolves that ID against `simulation.units`. Mesh position, scale, collision shape, or raycast result never overrides combat rules. All meshes/materials/geometries are procedural; no binary model downloads are required.

## Main state flow

```text
menu -> draft (player 0) -> handoff -> draft (player 1)
                                      |
                                      v
                              battle + 3s countdown
                                      |
                                      v
                                   results
                                    /   \
                           new armies   rematch
                               |           |
                              draft      battle (new seed)
```

The menu's demo creates two offline example armies and starts at battle. Modals (`guide`, `history`, `settings`, `leave`) layer on top of a screen and pause its active timer/simulation. Returning to the menu discards the current draft/battle and builds an idle showcase. The result is saved only on natural battle completion.

## Data contracts

### Army group

```js
{
  role: 'ranger',                  // one of ROLES keys
  count: 6,                        // normalized positive integer
  name: 'Robot archers',           // at most 40 characters
  description: '...',              // at most 160 characters
  element: 'lightning',            // cosmetic enum
  form: 'robot'                    // visual enum
}
```

An army is an array of these groups. `normalizeArmy(input)` returns `{groups, notes, cost, count}` or throws if no valid units remain. It discards unknown stat properties and unsupported roles, validates enums, and trims counts in input order against the point and population caps. A normalized group does **not** contain combat stats.

### Generation result

```js
{
  groups: [/* normalized army groups */],
  notes: ['...'],
  cost: 950,
  count: 9,
  source: 'offline',               // or 'openai'
  summary: 'Keyword interpretation...'
}
```

The browser re-normalizes results defensively. It records the submitted prompt on success, retains any previous accepted prompts in the same draft, and records the generation source. A failed request preserves the existing army.

### Team

```js
{
  name: 'The Verdant Order',
  army: [/* groups */],
  prompts: ['...'],                // successful generation submissions, in order
  source: 'presets',               // presets, offline, or openai
  message: '...'                   // transient forge feedback; optional
}
```

The prompt list is a history, not a promise that every prior prompt remains in the final roster: every generation replaces the roster. Manual presets after generation can make it a mixed army. The source field records the last generation path, not provenance per individual unit.

### Simulation unit

`Simulation` expands each group into individual units. Each unit gets a stable match-local ID of `team-group-index`, role stats, position (`x`, `z`), HP/maxHP, team, alive flag, facing, cooldown state, target ID, animation hints, and accumulated combat stats. Coordinates use Three.js X/Z for ground and Y for height. Units move on the ground plane only.

### Events and result

`simulation.events` is replaced each tick. Events are `attack`, `heal`, `death`, `sudden-death`, and `end`. Attack/heal events carry source/target IDs and impact coordinates; death carries name/team/location. Read and dispatch them after each `step`, before stepping again.

`simulation.result` is `null` during combat, then `{winner, time, survivors, seed}`. `winner` is `0`, `1`, or `null` for simultaneous defeat. Results freeze further stepping.

### Persistence

`storage.js` stores a list under `battlegrounds.history.v1`. A record contains ID, ISO date, cloned teams, winner, elapsed time, seed, map ID, and survivor counts. Reads validate basic shape and retain up to 20 records. Storage failures are caught; matches remain playable. There is no replay import or saved-draft migration.

## Extension points

- Add a role: update `ROLES`, renderer accessories, AI prompt/schema expectations, offline keywords, tests, and `GAME_SYSTEMS.md`.
- Add an element/form: update enums, renderer palette/mesh logic, parser rules, and relevant docs. Elements are intentionally cosmetic.
- Add a map theme: update `MAPS`. Add layout changes in `maps.js` so renderer and simulator always share blockers.
- Add a combat mechanic: implement it in `Simulation`, expose a visual event, and test it independently before changing UI.
- Add a screen: write a screen-render function and explicit state transitions in `main.js`. Do not let independent animation loops multiply.
- Add network multiplayer: this requires a new authority model. The current browser is authoritative and is not cheat-resistant.
