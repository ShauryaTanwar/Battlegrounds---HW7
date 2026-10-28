import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Battlefield } from "../src/game/renderer.js";
import { Simulation } from "../src/game/simulation.js";
import { ROLES, FORMS, MAPS } from "../src/game/catalog.js";
import { createMap } from "../src/game/maps.js";

/** Exercise actual scene geometry without a canvas or WebGL context.
 * This cannot prove shaders, screenshots, layout, or GPU compatibility.
 */
function sceneAdapter() {
  const field = Object.create(Battlefield.prototype);
  field.scene = new THREE.Scene();
  field.scene.background = new THREE.Color();
  field.scene.fog = new THREE.FogExp2(0x17282c, 0.009);
  field.camera = new THREE.PerspectiveCamera();
  field.camera.position.set(30, 30, 30);
  field.controls = { target: new THREE.Vector3(), update() {} };
  field.renderer = { render() {} };
  field.mapGroup = new THREE.Group();
  field.unitGroup = new THREE.Group();
  field.effectGroup = new THREE.Group();
  field.scene.add(field.mapGroup, field.unitGroup, field.effectGroup);
  field.materials = new Map();
  field.geometries = new Map();
  field.meshes = new Map();
  field.effects = [];
  field.keys = new Set();
  field.active = true;
  return field;
}

test("all themes build real Three.js scenes with finite transform geometry", () => {
  const field = sceneAdapter();
  for (const theme of MAPS) {
    field.setMap(createMap(42, theme.id));
    assert.ok(field.mapGroup.children.length > 100);
    field.mapGroup.traverse((object) => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.scale.toArray().every(Number.isFinite));
      if (object.isMesh)
        assert.ok(object.geometry.attributes.position.count > 0);
    });
  }
});

test("every role and supported form builds selectable models without affecting mechanics", () => {
  const field = sceneAdapter();
  for (const role of Object.keys(ROLES))
    for (const form of FORMS) {
      const sim = new Simulation(
        [[{ role, count: 1, form }], [{ role: "swarm", count: 1 }]],
        1,
      );
      field.setUnits(sim.units);
      assert.equal(field.meshes.size, 2);
      let selectable = 0;
      field.unitGroup.traverse((object) => {
        if (object.isMesh) {
          assert.ok(object.userData.unitId);
          selectable++;
        }
      });
      assert.ok(selectable > 5);
      field.update(1 / 60, 1);
      assert.equal(sim.units[0].maxHp, ROLES[role].hp);
    }
});

test("health bars, death removal, and effect expiry respond to simulation state", () => {
  const field = sceneAdapter();
  const sim = new Simulation(
    [[{ role: "ranger", count: 1 }], [{ role: "swarm", count: 1 }]],
    1,
  );
  field.setUnits(sim.units);
  const unit = sim.units[0];
  unit.hp = unit.maxHp / 2;
  field.update(1 / 60, 1);
  assert.equal(field.meshes.get(unit.id).bar.scale.x, 0.55);
  field.event({
    type: "attack",
    from: unit.id,
    to: sim.units[1].id,
    x: 3,
    z: 4,
    element: "fire",
    ranged: true,
  });
  assert.equal(field.effects.length, 1);
  field.update(1, 2);
  assert.equal(field.effects.length, 0);
  unit.alive = false;
  field.update(4, 6);
  assert.equal(field.meshes.get(unit.id).root.visible, false);
});

test("paused visual effects freeze while free camera flight remains available", () => {
  const field = sceneAdapter();
  const sim = new Simulation(
    [[{ role: "ranger", count: 1 }], [{ role: "swarm", count: 1 }]],
    1,
  );
  field.setUnits(sim.units);
  field.update(0.1, 1);
  const before = field.animationTime;
  const cameraPosition = field.camera.position.clone();
  field.keys.add("KeyW");
  field.update(0.1, 2, true);
  assert.equal(field.animationTime, before);
  assert.notDeepEqual(
    field.camera.position.toArray(),
    cameraPosition.toArray(),
  );
});
