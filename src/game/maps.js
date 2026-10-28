import { random } from "./random.js";
import { MAPS } from "./catalog.js";

export const ARENA_HALF = 23;
/** Circular blockers used by both the simulator and renderer. Center lanes stay open. */
export function createMap(seed, theme = "ruins") {
  const rng = random(seed);
  const obstacles = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      obstacles.push({
        x: rng() * 22 - 11,
        z: side * (7 + rng() * 10),
        radius: 1 + rng() * 1.3,
        height: 1.7 + rng() * 3.6,
        kind: i % 2 ? "rock" : "pillar",
      });
    }
  }
  return {
    seed,
    theme: MAPS.find((m) => m.id === theme) || MAPS[0],
    obstacles,
    half: ARENA_HALF,
  };
}
