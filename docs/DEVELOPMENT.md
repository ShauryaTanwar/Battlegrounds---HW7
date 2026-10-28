# Development and troubleshooting

## Environment and commands

Use Node.js 24.15+ in the 24.x series, 22.22.2+ in the 22.x series, or 26+. These ranges match the installed jsdom development dependency as well as Vite's requirements. The initial implementation was tested with Node 24.15.0 on Windows. The lockfile captures the exact dependency set. For a clean checkout use npm install, or npm ci when the lockfile is current and reproducible installation is preferred.

- **npm run dev** starts Node with optional .env loading and Vite middleware. Default URL: http://127.0.0.1:3000.
- **npm test** runs the rule, generation, and DOM-flow tests.
- **npm run check** checks syntax of the core entry points.
- **npm run build** writes browser assets to dist.
- **npm start** serves the built dist and API in production mode.
- **npm run format** formats source, tests, and documentation with Prettier.
- **npm run format:check** verifies formatting without changing files.

Stop a server using Ctrl+C in its terminal before starting another on the same port. The server needs to stay running while playing, including in production mode. A static file double-click does not resolve module dependencies or provide the API.

## Configuration

Only the server reads .env. Supported variables:

- OPENAI_API_KEY: optional provider credential. Missing means offline generation.
- OPENAI_MODEL: model name for structured Responses API generation; defaults to gpt-4o-mini.
- PORT: HTTP port; defaults to 3000.
- HOST: listen interface; defaults to 127.0.0.1.

Keep the default local bind unless deliberately redesigning access. Do not distribute a configured .env. The repository intentionally has no real credentials or hosted Site configuration.

## Common issues

### PowerShell says npm.ps1 cannot be loaded

Use npm.cmd instead of npm. This avoids the shell script execution-policy issue without changing the user's system policy.

### npm install fails with EACCES or a network error

Check registry access, package-cache permissions, and whether the execution environment requires approved network access. During initial development, installation needed network escalation. Do not disable security software or weaken system policy to fix dependency installation.

### Vite/esbuild cannot read parent directories in the agent sandbox

The initial Windows workspace sandbox blocked dependency resolution despite the dependency files existing. Running the authorized local dev/build command with the necessary tool permissions resolved it. This is an execution-environment issue; do not rewrite imports or copy arbitrary parent directories as a workaround.

### Port 3000 is occupied

Stop the existing project server you own or set another PORT in .env and restart. Do not terminate unrelated user processes.

### “ChatGPT connected” but generation fails

The badge detects a nonempty key, not a validated provider session. Check the forge error message, model support, account/API access, key, limits, and connectivity. Restart after .env changes. Always offline remains available.

### Browser shows a blank or unsupported arena

Check browser developer console locally, WebGL support, and hardware acceleration. Confirm the Node server is running and assets return successfully. A modern desktop browser is the supported target. Browser layout and WebGL were not visually verified in the initial agent session; see TESTING.md.

### Source edits do not change the production page

npm start serves the last dist build. Run npm run build again, or use npm run dev during development. Production hashes change with output; index HTML is not cached indefinitely.

### Offline prompts do not match the desired units

Use short comma-separated groups and explicit counts. Supported roles include knights, guardians, archers, wizards, healers, wolves, minions, and titans. Custom names and unsupported powers cannot create new mechanics. See AI_INTEGRATION.md before extending parser behavior.

### Slow rendering

Reduce pixel-ratio cap or shadow resolution in renderer.js, or add a graphics setting. Keep the battle population capped. Prefer instancing/batching if adding many decorative meshes. Do not change fixed-step combat to variable delta as a graphics optimization.

## Implementing changes safely

### New role

1. Add a catalog entry with cost, HP, damage, range, speed, cooldown, armor, radius, scale, and ability text.
2. Add a pure mechanic only if necessary; avoid branching in renderer for rules.
3. Teach the offline parser suitable keywords.
4. Add visual accessories or a supported form in renderer.
5. Verify the AI schema and instruction catalog pick up the new role.
6. Add role-specific tests and update GAME_SYSTEMS.md, README, and guide text as needed.

### New layout or terrain behavior

Generate colliders in maps.js. The renderer must use those same colliders. Keep spawn areas navigable, test multiple seeds, and preserve the clear center lane unless a stronger pathfinder is introduced.

### UI restructuring

main.js currently combines screen markup and orchestration. A reasonable next refactor is to move pure screen functions into src/ui/screens.js and leave state transitions in main.js. Pass state explicitly rather than creating independent global state stores. Preserve the single animation loop and existing delegated action convention.

### Production hosting

No deployment was requested or performed. A public version needs an explicit hosting design, secret configuration, authentication/abuse controls, and spend management for API requests. Static hosting alone supports the no-key client but not the Node generation endpoint. Do not present the development server as a public-service deployment.

## Dependencies and assets

Three.js is the runtime 3D dependency. Vite builds and serves client modules. jsdom is used only by tests, and Prettier formats source. Character models, map geometry, effects, CSS thumbnails, and the favicon are created in source. Optional DM Sans and Barlow Condensed load through Google Fonts, with local system fallbacks. There are no third-party downloaded character models or image files to manage.

For dependency changes, commit package.json and package-lock.json together, rerun tests/build, and update this guide if the runtime requirements change.
