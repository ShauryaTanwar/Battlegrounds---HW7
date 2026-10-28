# Agent handoff and current project state

## Original request and decisions

The user asked to implement SPEC.md and be especially thorough about architecture and future-agent documentation. After clarification, they selected a **3D browser game**, **ChatGPT** for the LLM, and an approximately **45-minute initial implementation** with unfinished work acceptable.

Implementation uses a local Node server, Vite, vanilla JavaScript, and Three.js. No framework, cloud database, remote multiplayer, deployment, or external character-asset pipeline is required. The no-key offline path keeps the game playable. OpenAI generation is optional and follows a server-side structured-output boundary.

## Working implementation

- Complete local loop: menu, map choice, Commander One draft, hidden handoff, Commander Two draft, countdown, autonomous combat, win/draw, prompt reveal, history, and rematch.
- Eight catalog roles and deterministic shared caps.
- Five visual forms and six cosmetic elements.
- Procedural low-poly units and three themed seeded battlefields.
- Melee, ranged, splash, armor, allied healing, health, death, targeting, movement, body separation, blocker steering, and sudden-death resolution.
- Orbit/pan/zoom, keyboard flight/altitude, unit selection/inspection, follow, and overview.
- Pause, playback speeds, short battle feed, optional synthesized sound cues, presets, suggestions, and local history.
- OpenAI Responses API schema, validation, error messages, offline mode, and server credential separation.
- Automated mechanics, mocked-provider, and DOM-flow tests.
- Setup, architecture, systems, integration, testing, and development documentation.

## Verification status

Read TESTING.md for the detailed evidence. Automated tests, syntax checks, production build, development HTTP serving, and offline generation were checked.

The initial delivery passed **26 automated tests**, formatting and syntax checks, and **12 production HTTP smoke checks**. Dependencies are installed in the current workspace, and dist contains a successful production build. Development/production preview processes used for verification are stopped at handoff; start your own terminal session with npm run dev or npm start.

**Not verified:** actual interactive WebGL rendering/layout, native pointer camera gestures, graphics performance on the user's device, and live paid OpenAI generation.

Browser QA was attempted but Computer Use stopped because it could not verify the current browser URL on Windows. Do not reinterpret DOM tests as visual browser evidence. No API key was available; do not claim the provider badge alone verifies access.

## First next steps

1. Run npm run dev and visually open the local game in a supported browser.
2. Walk through the manual acceptance checklist, especially camera control, arena framing, panel layout, and click selection.
3. Configure an OpenAI key only if the user wants live generation; run one small prompt and verify source, explanation, and caps.
4. If an issue is observed, fix that concrete issue before expanding scope.

## Deliberate scope tradeoffs

**Finite mechanics instead of arbitrary generated programs:** the model maps ideas to fixed roles. This makes budget enforcement deterministic and avoids executing model-authored code. Names, supported forms, and visual elements provide identity, while custom powers are approximated.

**Grounded simulation instead of rigid-body physics:** movement is 2D steering within a 3D environment. No flying, jumping, destructible environment, realistic ragdolls, or terrain-height navigation exists.

**Pass-and-play instead of split-screen or online multiplayer:** both players draft sequentially and spectate together. First-army hiding is normal-interface privacy, not adversarial secrecy.

**Third-person follow instead of first-person view:** the camera tracks movement and remains orbitable. There is no pointer lock.

**Local history instead of cloud persistence:** last 20 results are browser-local. Drafts do not persist on refresh. There is no replay browser or export/import feature.

**Simple steering instead of a navigation mesh:** deterministic obstacles and a clear center lane keep basic battles functional. Occasional crowding is possible; arena collapse bounds match duration.

## Known limitations and follow-up work

- Competitive role costs need empirical tuning across many seeds and both orientations.
- Combat statistics can overcount simultaneous overkill/healing, and kill credit uses the last queued attacker.
- Offline parsing is simplistic: punctuation/conjunction boundaries, keyword priority, small number vocabulary, no negation.
- Source provenance is per draft's last generation path, not per troop; adding presets can create mixed provenance.
- Ranged damage occurs at attack time; visible projectiles are cosmetic and ignore obstacles.
- The visual death animation is lightweight tilt/sink, not a ragdoll.
- A very low frame rate can slow active draft/battle time relative to wall time because the frame delta is clamped.
- Google Fonts are optional runtime network requests. Self-host them if fully network-free presentation is desired.
- The Three.js-containing production chunk can exceed Vite's advisory size threshold.
- The server concurrency cap is process-local and there is no public authentication or persistent rate limiter.
- History validation is intentionally basic. Add a stricter versioned schema before supporting imports or migrations.
- main.js is the largest coordinator module; extract pure view functions when extending UI substantially.

## Files to edit for common tasks

- Balance, caps, roles, suggestions, theme metadata: src/game/catalog.js.
- AI prompt and strict schema: server/generation.js.
- HTTP routes and server/static lifecycle: server/index.js.
- Offline grammar/keywords: src/game/offline.js.
- Targeting, damage, movement, healing, win logic: src/game/simulation.js.
- Terrain colliders: src/game/maps.js.
- 3D models, scene, camera, visual effects: src/game/renderer.js.
- Screen transitions, drafting, battle loop, modal actions: src/main.js.
- Presentation and responsive rules: src/style.css.
- History: src/ui/storage.js.

## Avoid these regressions

Do not move credentials into the client, accept model-supplied stats, remove no-key play, use unseeded mechanical randomness, make combat resolution sequentially lethal, reveal Commander One during Commander Two's draft, or let provider failures masquerade as successful AI output.

Preserve SPEC.md as the original requirements. Update docs when behavior changes, keep tests meaningful, and record actual verification limits honestly.
