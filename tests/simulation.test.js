import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, FIXED_DT } from "../src/game/simulation.js";
import { offlineArmy } from "../src/game/offline.js";
import { ROLES, SUGGESTIONS } from "../src/game/catalog.js";

function finish(sim, maxSeconds = 200) {
  for (let i = 0; i < maxSeconds / FIXED_DT && !sim.result; i++) sim.step();
  assert.ok(sim.result, "every battle must terminate");
  return sim.result;
}
test("units move, target only opponents, deal damage, die, and declare a survivor", () => {
  const sim = new Simulation(
    [[{ role: "titan", count: 2 }], [{ role: "swarm", count: 1 }]],
    45,
  );
  const originalX = sim.units[0].x;
  for (let i = 0; i < 60; i++) sim.step();
  assert.notEqual(sim.units[0].x, originalX);
  assert.ok(
    sim.units.every(
      (u) => sim.units.find((t) => t.id === u.targetId)?.team !== u.team,
    ),
  );
  assert.equal(finish(sim).winner, 0);
  assert.equal(sim.living(1).length, 0);
  const time = sim.time;
  sim.step();
  assert.equal(sim.time, time, "finished simulation is frozen");
});
test("a seed and army configuration produce identical match results and unit stats", () => {
  const armies = [
    offlineArmy(SUGGESTIONS[0]).groups,
    offlineArmy(SUGGESTIONS[1]).groups,
  ];
  const first = new Simulation(armies, 104),
    second = new Simulation(armies, 104);
  assert.deepEqual(finish(first), finish(second));
  assert.deepEqual(first.units, second.units);
});
test("healers heal allies, never damage them, and stop healing in sudden death", () => {
  const sim = new Simulation(
    [
      [
        { role: "healer", count: 1 },
        { role: "guardian", count: 1 },
      ],
      [{ role: "titan", count: 1 }],
    ],
    8,
  );
  const healer = sim.units[0],
    ally = sim.units[1];
  ally.hp = 50;
  healer.cooldownLeft = 0;
  sim.step();
  assert.ok(ally.hp > 50);
  assert.ok(healer.healingDone > 0);
  for (const unit of sim.units) {
    unit.damage = 0;
    unit.speed = 0;
    unit.hp = unit.maxHp;
  }
  sim.time = 120;
  healer.cooldownLeft = 0;
  ally.hp = 50;
  sim.step();
  assert.equal(sim.suddenDeath, true);
  assert.ok(ally.hp < 50);
  assert.ok(!sim.events.some((event) => event.type === "heal"));
});
test("simultaneous lethal attacks can draw; first team is not granted victory by iteration order", () => {
  const sim = new Simulation(
    [[{ role: "striker", count: 1 }], [{ role: "striker", count: 1 }]],
    1,
  );
  sim.units.forEach((u, i) => {
    u.x = i;
    u.z = 0;
    u.hp = 1;
    u.cooldownLeft = 0;
  });
  sim.step();
  assert.equal(sim.result.winner, null);
  assert.deepEqual(sim.result.survivors, [0, 0]);
});
test("splash attacks damage nearby enemies without friendly fire", () => {
  const sim = new Simulation(
    [
      [
        { role: "mage", count: 1 },
        { role: "guardian", count: 1 },
      ],
      [{ role: "swarm", count: 2 }],
    ],
    1,
  );
  const [mage, ally, a, b] = sim.units;
  mage.x = 0;
  mage.z = 0;
  mage.cooldownLeft = 0;
  ally.x = 2;
  ally.z = 0;
  ally.cooldownLeft = 99;
  a.x = 3;
  a.z = 0;
  b.x = 3.6;
  b.z = 0.2;
  a.cooldownLeft = b.cooldownLeft = 99;
  sim.step();
  assert.ok(a.hp < a.maxHp);
  assert.ok(b.hp < b.maxHp);
  assert.equal(ally.hp, ally.maxHp);
});
test("all role mirror matches and suggested army matchups terminate without invalid positions", () => {
  for (const [role, stats] of Object.entries(ROLES)) {
    const army = [{ role, count: Math.floor(1000 / stats.cost) }];
    const sim = new Simulation([army, army], 42);
    finish(sim);
    for (const u of sim.units) {
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.z));
      assert.ok(u.hp >= 0 && u.hp <= u.maxHp);
      assert.ok(Math.abs(u.x) <= 23 && Math.abs(u.z) <= 23);
    }
  }
  for (let seed = 0; seed < 8; seed++)
    finish(
      new Simulation(
        [
          offlineArmy(SUGGESTIONS[seed % SUGGESTIONS.length]).groups,
          offlineArmy(SUGGESTIONS[(seed + 1) % SUGGESTIONS.length]).groups,
        ],
        seed,
      ),
    );
});
