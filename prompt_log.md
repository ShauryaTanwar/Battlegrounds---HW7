# Battlegrounds (HW7) — Prompt Log

This log records the available project request history and how it shaped the implementation. Earlier requests are reconstructed from `SPEC.md` and `docs/HANDOFF.md`; they are summaries, not verbatim chat transcripts. Their original dates and exact wording are unavailable in this session. Implementation details are corroborated by `README.md`.

## 1. Initial game proposal

**Source:** [SPEC.md](SPEC.md)

**Request summary:** Build a two-player battle simulator where players describe armies in natural language, an LLM converts those descriptions into balanced units, and the armies fight automatically on a shared battlefield.

**Requested features:** Same-device multiplayer, two-minute army drafts, a team power cap, randomized maps, automatic targeting and combat, health and death, a free-roaming camera, unit spectating, a winner, and a post-match prompt reveal. Optional additions included preset troops, army suggestions, and match history.

**Priorities:** Make movement, combat, maps, cameras, and the complete match loop work first. If time is limited, simplify LLM generation to predefined characters before cutting the playable battle loop.

## 2. Implementation request and clarifications

**Source:** [docs/HANDOFF.md](docs/HANDOFF.md), “Original request and decisions”

**Request summary:** Implement the proposal and provide especially thorough architecture and continuation documentation for future agents.

**Recorded user choices:**

- Build a **3D browser game**.
- Use **ChatGPT** for optional LLM generation.
- Spend approximately **45 minutes** on the initial implementation; unfinished work was acceptable.

**Recorded implementation outcome:** A local Node + Vite + Three.js game with sequential private drafting, autonomous battles, camera controls, results and prompt reveal, rematches, and browser-local history. Optional OpenAI API generation maps descriptions to fixed-stat roles; an offline parser allows play without an API key. These are implementation decisions and outcomes, not additional verbatim user prompts.

**Documentation outcome:** Setup instructions, architecture, game rules, AI integration, testing, development guidance, and a future-agent handoff were added. The handoff reports automated verification while explicitly leaving interactive WebGL QA and live paid OpenAI generation unverified.

## 3. Prompt-log request — November 1, 2026

**Source:** Current conversation

**Exact user prompt:**

> Do you remember this project? If so, create a prompt log for battlegrounds (HW7) under prompt_log.md

**Action:** Reviewed `SPEC.md`, `README.md`, and `docs/HANDOFF.md`, then created this file. No game behavior was changed. The historical entries above are limited to what those project records establish; a complete earlier conversation transcript was not available.

## Continuing this log

For future substantive requests, append the date, exact user prompt when available, resulting changes, and any verification limits. Keep development prompts separate from the in-game army prompts revealed after matches and stored in browser-local match history. Never include API keys or other credentials.
