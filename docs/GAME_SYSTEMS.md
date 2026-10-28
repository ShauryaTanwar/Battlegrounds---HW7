# Game systems and balance reference

## Army rules

Each commander has **1,000 power** and at most **32 units**. Army groups are processed in input order. Each group's requested population is floored, then reduced to the remaining budget and population slots. An expensive earlier group can consume most of the budget. The normalizer reports reductions in notes. Unsupported roles are skipped; an army with no legal units is rejected.

The model never sets HP, damage, speed, range, cooldown, armor, splash, healing, radius, or scale. Those values come from the catalog. Arbitrary requests such as “an invincible god that instantly deletes the enemy” become a named supported role with normal stats, never executable special abilities.

Elements (physical, fire, frost, arcane, nature, lightning) change effects and appearance only. They have no burn, slow, stun, or damage advantage. Forms (soldier, skeleton, robot, beast, golem) change the model only. A form does not override a role's stats.

## The eight roles

These values are for orientation. **src/game/catalog.js is authoritative.** Update this document when changing them.

- **Vanguard / striker** — 80 power, 130 HP, 22 damage, 0.8-second attack cooldown, 1.7m range, 4.5m/s speed, 5% damage reduction. Fast baseline melee.
- **Guardian / guardian** — 125 power, 300 HP, 23 damage, 1.3-second cooldown, 1.9m range, 2.8m/s speed, 30% damage reduction. Durable front line.
- **Ranger / ranger** — 100 power, 90 HP, 23 damage, 1.2-second cooldown, 11m range, 3.8m/s speed, no armor. Ranged pressure.
- **Arcanist / mage** — 150 power, 85 HP, 30 damage, 1.8-second cooldown, 8m range, 3m/s speed, no armor. 2.8m splash radius.
- **Mender / healer** — 130 power, 100 HP, 10 damage, 1.3-second cooldown, 7m range, 3.4m/s speed, no armor. Restores 25 allied HP per healing action; attacks when healing is unnecessary.
- **Ravager / beast** — 110 power, 160 HP, 29 damage, 0.95-second cooldown, 1.8m range, 5.5m/s speed, no armor. Fast melee attacker.
- **Minion / swarm** — 40 power, 48 HP, 10 damage, 0.7-second cooldown, 1.3m range, 4.6m/s speed, no armor. Cheap melee population.
- **Titan / titan** — 300 power, 550 HP, 48 damage, 1.7-second cooldown, 2.7m range, 2.2m/s speed, 18% damage reduction. 2.6m splash radius and larger collision body.

Roles also define collision radius and render scale. Scale is visual; a larger form does not create extra HP. Radius contributes to contact range, separation, and terrain constraints.

The cap is consistent and transparent, not a learned estimate of unrestricted semantic power. No comprehensive competitive balance study has been performed. Compare many seeds and both team orientations when measuring composition strength.

## Fixed-step simulation

Combat advances at **60 simulation steps per second**. The browser accumulates elapsed time multiplied by playback speed and calls the simulation once per fixed slice. Rendering remains at the available frame rate. Pause and modals stop combat. Hidden tabs pause game work and reset the time baseline on visibility changes.

The frame loop clamps visual deltas to 0.08 seconds to avoid enormous catch-up work after stalls. Under severe performance pressure, active game time can run slower than wall time. Combat remains deterministic per simulated tick.

The constructor normalizes armies, expands groups into units, places forces on opposite X sides, and sets seeded initial attack cooldown offsets. Map and cooldown randomness use separate PRNG instances. Mechanics never use Math.random.

## Per-tick sequence

1. Advance time and reset transient events.
2. At 120 seconds, begin sudden death and emit its event once.
3. Snapshot living units and initialize queued damage/healing.
4. Update cooldowns and choose targets.
5. Move toward out-of-range targets or queue attacks/heals.
6. Resolve unit separation and constrain terrain positions.
7. Apply queued healing, damage, and arena decay to all snapshot units.
8. Mark defeats, credit kills, and emit death events.
9. Count survivors and declare a winner or draw if a team is eliminated.

Resolution is simultaneous within a tick. A unit killed that tick can still deliver its queued attack. Healing and damage combine before death is evaluated. The simulation does not stop at the first defeated unit.

## Targeting and healing

Normal attackers choose the nearest living enemy by ground-plane distance and retarget every tick. A target's collision radius extends effective contact range. Ranged units stop once in range; no deliberate backward kiting or line-of-sight checks are implemented.

A mender searches living allies within 12m who are missing more than 8 HP. It prefers the lowest health fraction, then nearest distance. It can heal itself. It approaches until in action range and restores 25 HP. If no qualifying ally exists, it attacks an enemy for 10 damage. Healing is disabled during sudden death.

Support is the implemented friendly-unit interaction, alongside body separation. There are no ally buffs, resurrection, summons, formation orders, or player commands during battle.

## Damage, splash, and statistics

Direct damage equals attack damage times one minus victim armor. Splash attacks evaluate enemies near the primary target. The primary target receives full damage and secondary targets receive 65%; each victim's own armor applies. Splash never hits allies.

Ranged projectiles are **visual effects**. Damage is queued at attack time, not graphical impact. Projectiles do not miss or collide with terrain. This keeps mechanics independent of frame rate and travel animation.

The simulation tracks team damage, individual damage/healing, and kills. Per-hit HP caps reduce overkill statistics, but simultaneous hits can still overcount overkill, and overlapping heals can overcount healing. These are presentation statistics, never win-condition inputs. The last queued attacker gets the kill when several attackers contribute in one tick.

The results screen chooses a standout unit by damage plus healing. It does not credit absorbed damage or objective control.

## Movement and collisions

The playable square spans -23 to +23 on X and Z. Units approach targets at their role speed. Nearby circular blockers add radial repulsion and a consistent tangent steering component. Final projection keeps centers outside blocker radius plus body radius.

Living pairs receive overlap separation in an O(n²) pass. Small capped armies keep this affordable. Terrain circles are shared between simulation and renderer; visual rocks/pillars are approximate, not rigid-body collision meshes.

This is steering, not global pathfinding. Crowding and occasional obstacle stalls can occur. Units cannot fall off, jump, fly, push props, or apply momentum. Sudden death prevents stalled matches from running forever.

## Win condition and stalemates

Only one team retaining living units wins. Both reaching zero in the same tick produces a draw. No score or timer assigns an artificial winner.

At **120 simulated seconds**, healing stops and unavoidable arena damage begins. Damage per second starts at 8 and increases by 0.75 for each additional sudden-death second, bypassing armor. Finite maximum HP and disabled healing guarantee that surviving units eventually die if combat stalls. Tests require termination within 200 simulated seconds.

The UI announces arena collapse in the feed and status label. Playback speed changes wall-clock duration, never the simulation-time threshold.

## Maps and seeds

The seeded map generator returns the theme, eight circular obstacles, and arena bounds. Four blockers appear on either Z side; the center lane remains clear. Themes change ground, sky, rock, and accent colors; seeds change blocker positions and sizes.

Themes are The Sunken Colosseum, Ember Expanse, and Frostfall Sanctuary. Menu thumbnails are procedural CSS; the battlefield is Three.js geometry. Each battle/rematch creates a fresh seed. Exact normalized armies, seed, and code version reproduce a simulation, but the UI has no seed-entry or replay-import controls yet.

## Rendering and cameras

The renderer builds a floating island, grid, center rune, ruins, debris, team boundary lights, and characters. Materials and common geometries are cached. Scene replacement removes objects while retaining shared resources. At most 120 transient effects can exist at once. Defeated units tilt, sink, and hide.

Directional and hemisphere lights provide flat shaded models and soft shadows. Device pixel ratio is capped at 1.75. Health bars billboard toward the camera. Team rings identify teal/coral troops. Walking and attack animation never feed back into rules.

OrbitControls provides orbit, pan, and zoom. WASD moves camera and orbit target horizontally; Q/E adjusts altitude. Following moves with a living unit while retaining orbit controls. Overview restores an arena-wide view. A followed unit's death releases follow. Escape releases follow and selection. There is no pointer lock or first-person view.

## Draft timing and privacy

Each player receives 120 active draft seconds. Generation, modal reading, and background tab time do not consume the budget. The timer option is shared across commanders. On expiry, a nonempty army locks; an empty army receives a default roster with an explicit timeout note.

The first roster and meshes are removed before handoff. Both teams remain in browser memory because this is local pass-and-play, not adversarial secret storage.
