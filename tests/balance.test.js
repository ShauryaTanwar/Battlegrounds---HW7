import test from "node:test";
import assert from "node:assert/strict";
import {
  armyCost,
  armyCount,
  normalizeArmy,
  POWER_CAP,
  ROLES,
  SUGGESTIONS,
} from "../src/game/catalog.js";
import { offlineArmy } from "../src/game/offline.js";
import { createMap } from "../src/game/maps.js";

test("overpowered and excessive model output cannot exceed the cap or inject stats", () => {
  const result = normalizeArmy([
    {
      role: "titan",
      name: "Invincible",
      count: 5000,
      hp: Infinity,
      damage: 999999,
    },
    { role: "swarm", count: 100 },
  ]);
  assert.ok(result.cost <= POWER_CAP);
  assert.equal(result.groups[0].count, 3);
  assert.equal(result.groups[0].hp, undefined);
  assert.equal(result.groups[0].damage, undefined);
  assert.ok(result.notes.length > 0);
  assert.equal(armyCost(result.groups), result.cost);
});
test("invalid roles, invalid counts, empty output and prototype names are handled", () => {
  for (const value of [
    [],
    null,
    {},
    [{ role: "god", count: 1 }],
    [{ role: "__proto__", count: 1 }],
    [{ role: "striker", count: -3 }],
  ])
    assert.throws(() => normalizeArmy(value));
  const result = normalizeArmy([
    { role: "ranger", count: "Infinity", form: "spaceship", element: "death" },
  ]);
  assert.equal(result.count, 1);
  assert.equal(result.groups[0].element, "physical");
  assert.equal(result.groups[0].form, "soldier");
});
test("normalization is repeatable and names/descriptions are bounded", () => {
  const input = [
    {
      role: "swarm",
      count: 100000,
      name: "X".repeat(1000),
      description: "x".repeat(2000),
    },
  ];
  assert.deepEqual(normalizeArmy(input), normalizeArmy(input));
  assert.equal(normalizeArmy(input).groups[0].name.length, 40);
  assert.equal(normalizeArmy(input).groups[0].description.length, 160);
  assert.ok(armyCount(normalizeArmy(input).groups) <= 32);
});
test("all built-in suggestions produce legal functional armies", () => {
  for (const prompt of SUGGESTIONS) {
    const army = offlineArmy(prompt);
    assert.ok(army.count > 0, prompt);
    assert.ok(army.cost <= 1000, prompt);
    for (const group of army.groups) assert.ok(ROLES[group.role]);
  }
});
test("offline builder preserves supported counts, forms, elements and roles", () => {
  const { groups } = offlineArmy(
    "Six robot archers, two frost wolves, one healer",
  );
  assert.equal(groups[0].count, 6);
  assert.equal(groups[0].role, "ranger");
  assert.equal(groups[0].form, "robot");
  assert.equal(groups[1].count, 2);
  assert.equal(groups[1].role, "beast");
  assert.equal(groups[1].element, "frost");
  assert.equal(groups[2].role, "healer");
});
test("seeded maps are reproducible and blockers leave central lanes clear", () => {
  assert.deepEqual(createMap(42), createMap(42));
  assert.notDeepEqual(createMap(42).obstacles, createMap(43).obstacles);
  for (let seed = 0; seed < 30; seed++)
    for (const obstacle of createMap(seed).obstacles)
      assert.ok(Math.abs(obstacle.z) - obstacle.radius > 4);
});
