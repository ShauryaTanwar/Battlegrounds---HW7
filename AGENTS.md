# Instructions for the next agent

## Read first

Read `SPEC.md`, `README.md`, and `docs/HANDOFF.md` before changing scope. Read `docs/ARCHITECTURE.md` before moving files. `docs/GAME_SYSTEMS.md` is the rules reference; `src/game/catalog.js` is the executable source of truth.

This repository is a **local Node + Vite + Three.js browser game**. It is not an existing hosted Site. Do not create cloud resources, deploy, or publish merely to run it. The user requested a 3D browser game, optional ChatGPT generation, a roughly 45-minute initial implementation, and especially thorough documentation for future agents.

## Commands

- `npm install`: install the lockfile's dependencies.
- `npm run dev`: local server and Vite middleware on `http://127.0.0.1:3000`.
- `npm test`: Node's test runner; pure simulation, balance, and mocked OpenAI tests.
- `npm run check`: JavaScript syntax checks for the main modules.
- `npm run build`: Vite production build into ignored `dist/`.
- `npm start`: serve the existing `dist/` and API without Vite.
- Windows PowerShell can require `npm.cmd` in place of `npm` because of execution-policy restrictions. Do not alter the user's execution policy.

Supported Node ranges are 22.22.2+ on 22.x, 24.15+ on 24.x, or 26+. Tested initially with Node 24.15.0. Keep `.env` out of Git. Do not print API keys, open personal credential stores, or put secrets in Vite client variables. `.env.example` contains placeholders only. Tests never need a real API key or paid provider calls.

## Invariants

1. Keep simulation logic independent of DOM and Three.js. Unit behavior belongs in `simulation.js`, visual reactions belong in `renderer.js`.
2. All units obtain stats from `ROLES`. The LLM chooses identity, count, role, element, and form. Never trust AI or browser-provided numeric stats.
3. Normalize both armies before simulation. Preserve the shared 1,000-point / 32-unit caps and deterministic trimming order unless deliberately changing the game rules.
4. Use the seeded PRNG for simulation or map randomness. `Math.random` is acceptable only for a UI suggestion. A simulation must be reproducible given the same armies and seed.
5. Apply damage and healing simultaneously within each tick. Do not give team zero first-strike priority by killing targets during the attack loop.
6. Keep both local players' armies hidden during the handoff / second draft. Clear the rendered first army before passing control.
7. Distinguish offline parsing from real OpenAI generation in both UI and saved results. Provider errors must not silently become fabricated AI success.
8. Escape user/model/history text when inserting HTML. Names and descriptions are untrusted content, never executable instructions.
9. Maintain a complete match loop and a playable no-key mode. Do not require ChatGPT authentication just to play.
10. Keep the default listener loopback-only. This prototype lacks production authentication, durable rate limits, and public-service hardening.

## Verification and documentation

Run tests and a production build after changing mechanics, generation, dependencies, or imports. Add meaningful tests for new combat rules or failure cases. Check the manual browser list in `docs/TESTING.md` after changing UI or camera controls.

Update the relevant documentation when changing commands, environment variables, schemas, file architecture, role stats, timing, controls, persistence, or behavior. Record unfinished work and verification limits in `docs/HANDOFF.md`. Do not mark live API or browser QA complete unless actually verified.

No sub-agents are required for this project. Keep work focused, preserve unrelated user edits, and avoid introducing a framework or physics engine without a concrete need.
