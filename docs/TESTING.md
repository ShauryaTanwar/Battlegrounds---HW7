# Testing, acceptance, and verification

## Automated checks

Run from the project root:

    npm test
    npm run check
    npm run build

Use npm.cmd on Windows if PowerShell blocks npm.ps1. Tests use Node's built-in runner. jsdom is a development-only dependency used for DOM behavior tests; it is not shipped to players.

### Rule and integration tests

**balance.test.js** covers power enforcement, arbitrary-stat stripping, invalid roles and prototype names, invalid counts, repeatable normalization, bounded text, supported offline interpretation, suggestions, and reproducible map layouts with a clear center lane.

**simulation.test.js** covers movement, enemy targeting, damage/death, winner declaration, frozen completed simulations, deterministic repeatability, allied healing, sudden-death suppression of healing, simultaneous defeat, friendly-fire prevention, splash victims, and termination of all role mirror matchups plus varied suggestion matchups.

**generation.test.js** supplies a fake fetch implementation. It verifies no-key operation, response format, request settings, independently enforced caps, malformed/refused/incomplete results, provider error statuses, and prompt rejection before any paid call.

**ui.test.js** executes the actual UI coordinator in jsdom with a **stubbed graphics adapter**. It covers the full draft/handoff/battle/results/history/rematch loop, first-army scene removal and DOM hiding, roster cap controls, modal timer pause, text escaping, empty/nonempty timeout behavior, pause, selection/follow controls, exit confirmation, aborted-match persistence, and corrupt local history.

The UI harness removes import declarations and injects the real pure modules plus a fake Battlefield. It exercises the coordinator and HTML event handlers. It does **not** claim to validate WebGL, graphics performance, layout, native pointer gestures, or screenshots.

**scene.test.js** uses real Three.js scene graphs and the actual renderer methods without constructing a WebGL context. It builds all themes and every role/form pairing, checks selectable geometry and finite transforms, verifies health bars and death/effect cleanup, and confirms paused animation still permits camera flight. These structural checks do not verify pixels, shaders, or GPU compatibility.

**server.test.js** starts an isolated production-mode server on an ephemeral loopback port with an explicitly empty API key. It checks the real status/generation routes, caps, invalid prompts/JSON/content types, origin rejection, unknown routes, and private/source-file denial. It does not require an existing browser build and never uses API credit.

## Initial verification evidence

Initial development took place on Windows using Node 24.15.0.

- All 26 automated rule, scene-graph, real-HTTP, mocked-provider, and DOM-flow tests passed.
- JavaScript syntax checks passed.
- The production bundle built successfully with Vite.
- npm installation/audit reported zero known vulnerabilities at installation time.
- GET /api/status returned HTTP 200 with offline configuration.
- GET / returned HTTP 200.
- POST /api/generate returned a normalized 950-power, nine-unit army for “Six robot archers, two frost wolves, one healer.”
- A separate 12-check production HTTP smoke run passed: built HTML/JavaScript assets, status, offline budget enforcement, invalid requests, cross-origin denial, unknown API routes, and denial of private/source files.
- No real OpenAI API key was configured; live generation was not tested.
- Visual browser QA was attempted through Computer Use. The tool stopped because it could not confidently verify the current browser URL on Windows. No screenshot, visual acceptance, or interactive WebGL verification was completed. No alternate UI automation route was used to bypass this stop.

The production build can report a large-chunk advisory because Three.js is bundled with the game. This is a performance consideration, not a failed build.

## Manual acceptance checklist

Run these checks in a current desktop Chrome/Edge/Firefox with hardware acceleration. They are intentionally left for an environment where browser interaction is available.

### Launch and menu

- Start the server, open the printed local URL, and verify a 3D floating arena renders behind the menu.
- Check the title, controls, troop text, and map cards at desktop resolution.
- Select each map and verify the scene palette and ruins change without errors.
- Open Field guide, Match history, and forge settings. Close them with X, backdrop, and Escape.
- Confirm a failed WebGL initialization shows a helpful fallback rather than a blank screen.
- Resize to a narrow window; verify controls remain reachable and panels scroll.

### Local two-player drafting

- Start a new match and verify Commander One has 2:00 and zero initial roster units.
- Rename the team and enter a supported multi-group prompt.
- Generate and check counts, role names, model forms, budget meter, source labeling, and explanation.
- Add and remove presets; verify units disappear individually and unaffordable additions disable.
- Generate again; verify the roster is replaced and the accepted prompt history is preserved for later reveal.
- Lock the first team. Verify its units and identity are absent from the handoff and second draft.
- Start Commander Two and verify a fresh full timer and separate roster.
- Test timer-off mode. Test expiry with an empty roster and a nonempty roster.
- Verify opening a dialog, generation, and hiding the browser tab pause drafting.

### Combat, movement, and camera

- Launch a demo and verify both teams move inward, target enemies, attack, lose health, and die.
- Watch guardians, menders, ranged units, splash damage, and melee units in separate compositions.
- Verify models steer around blockers and remain on the arena.
- Drag to orbit, right-drag to pan, scroll to zoom, fly with WASD, change height with Q/E, and hold Shift.
- Click a living unit, inspect its health, press F, and verify the camera follows its movement.
- Orbit while following, cycle living units with Tab, release with Escape, and reset with O.
- Pause and verify combat and death/effect animations stop while camera controls remain available.
- Try all playback speeds. Verify unit health, counts, feed, and selected inspector update.
- Follow a unit until death; verify follow releases safely.
- Let a healer-heavy battle reach arena collapse; verify the warning and eventual termination.

### Results and history

- Verify a surviving team wins and simultaneous elimination is represented as a draw.
- Check displayed rosters and prompt histories match both drafts.
- Verify result duration, survivors, and standout statistics are plausible.
- Rematch and verify armies stay the same but seed changes.
- Open history, reveal old prompts, refresh, and confirm records persist.
- Clear test history using the in-game button only when those browser-local test records can be discarded.
- Abort a battle via its confirmation dialog and verify no completed result is saved.

### Live AI, if configured

- Configure a key in .env, restart, refresh, and verify the badge changes.
- Generate a modest supported prompt; inspect the response source and resulting roster.
- Request an overpowered army and verify no arbitrary stats or budget bypass occurs.
- Test a rejected/invalid-key request without exposing the key. Existing roster must survive failure.
- Select Always offline and verify no provider request is made.

## How to add tests

For new mechanics, construct Simulation directly, place units deliberately, and advance fixed steps. Assert outcomes and invariants rather than copying implementation formulas. For generation, inject fetchImpl; never put real keys in test fixtures. For UI transitions, extend the existing jsdom harness and explicitly distinguish DOM evidence from graphics evidence.

Use many seeds for movement/balance investigations. Avoid asserting a specific winner for arbitrary mixed armies unless that outcome is the actual intended rule.
