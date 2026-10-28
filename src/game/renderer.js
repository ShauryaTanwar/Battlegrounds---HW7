import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { random } from "./random.js";

const TEAM_COLORS = [0x70e0c2, 0xf48f82];
const ELEMENT_COLORS = {
  physical: 0xf2dab0,
  fire: 0xff954c,
  frost: 0x9ceaff,
  arcane: 0xcb9aff,
  nature: 0x8cf2a0,
  lightning: 0xffe78c,
};

/** Visual adapter only. Mechanics live in Simulation; meshes never determine damage. */
export class Battlefield {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x17282c);
    this.scene.fog = new THREE.FogExp2(0x17282c, 0.009);
    this.camera = new THREE.PerspectiveCamera(
      43,
      innerWidth / innerHeight,
      0.1,
      260,
    );
    this.camera.position.set(42, 36, 47);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.enableKeys = false;
    this.keys = new Set();
    this.meshes = new Map();
    this.materials = new Map();
    this.geometries = new Map();
    this.effects = [];
    this.unitGroup = new THREE.Group();
    this.mapGroup = new THREE.Group();
    this.effectGroup = new THREE.Group();
    this.scene.add(this.mapGroup, this.unitGroup, this.effectGroup);
    this.scene.add(new THREE.HemisphereLight(0xc8e6ed, 0x35382d, 2.5));
    const sun = new THREE.DirectionalLight(0xffe3b5, 3.7);
    sun.position.set(-18, 38, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 38,
      bottom: -38,
      near: 1,
      far: 100,
    });
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8bd5e5, 1.4);
    rim.position.set(20, 12, -25);
    this.scene.add(rim);
    this.raycaster = new THREE.Raycaster();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointerup", (event) => {
      if (
        event.button !== 0 ||
        !this.pointerStart ||
        Math.hypot(
          event.clientX - this.pointerStart.x,
          event.clientY - this.pointerStart.y,
        ) > 6
      )
        return;
      const bounds = canvas.getBoundingClientRect();
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = this.raycaster
        .intersectObjects(this.unitGroup.children, true)
        .find((hit) => hit.object.userData.unitId);
      this.onSelect(hit?.object.userData.unitId || null);
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("keydown", (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      this.keys.add(event.code);
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code) &&
        this.active
      )
        event.preventDefault();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("resize", () => this.resize());
    this.active = false;
  }

  geometry(key, make) {
    if (!this.geometries.has(key)) this.geometries.set(key, make());
    return this.geometries.get(key);
  }
  material(color, glow = false) {
    const key = `${color}-${glow}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.85,
          flatShading: true,
          ...(glow ? { emissive: color, emissiveIntensity: 0.45 } : {}),
        }),
      );
    return this.materials.get(key);
  }
  box(parent, w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(
      this.geometry("box", () => new THREE.BoxGeometry(1, 1, 1)),
      this.material(color),
    );
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  poly(parent, radius, x, y, z, color, detail = 0) {
    const mesh = new THREE.Mesh(
      this.geometry(
        `ico-${detail}`,
        () => new THREE.IcosahedronGeometry(1, detail),
      ),
      this.material(color),
    );
    mesh.scale.setScalar(radius);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  cylinder(parent, top, bottom, height, x, y, z, color, sides = 8) {
    const key = `cyl-${top}-${bottom}-${height}-${sides}`;
    const mesh = new THREE.Mesh(
      this.geometry(
        key,
        () => new THREE.CylinderGeometry(top, bottom, height, sides),
      ),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  setMap(map) {
    this.clearGroup(this.mapGroup);
    const rng = random(map.seed + 93);
    this.scene.background.set(map.theme.sky);
    this.scene.fog.color.set(map.theme.sky);
    const ground = map.theme.ground,
      stone = map.theme.rock;
    // The arena is a floating, faceted piece of an ancient world.
    this.box(this.mapGroup, 49, 1.5, 49, 0, -0.8, 0, ground);
    this.box(this.mapGroup, 50, 0.35, 50, 0, -1.7, 0, stone);
    this.box(this.mapGroup, 46, 2, 46, 0, -2.8, 0, "#394644");
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const rock = this.poly(
        this.mapGroup,
        5 + rng() * 4,
        Math.cos(angle) * 20,
        -4,
        Math.sin(angle) * 20,
        "#394644",
      );
      rock.scale.y *= 0.65;
    }
    const grid = new THREE.GridHelper(
      46,
      23,
      map.theme.accent,
      map.theme.accent,
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.09;
    grid.position.y = 0.01;
    this.mapGroup.add(grid);
    this.cylinder(this.mapGroup, 5.3, 5.5, 0.1, 0, 0, 0, stone, 48);
    this.cylinder(this.mapGroup, 4.8, 4.8, 0.12, 0, 0.02, 0, ground, 48);
    const rune = new THREE.Mesh(
      this.geometry("rune", () => new THREE.RingGeometry(4.4, 4.46, 64)),
      this.material(map.theme.accent, true),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.09;
    this.mapGroup.add(rune);
    for (const x of [-22, 22]) {
      const color = x < 0 ? TEAM_COLORS[0] : TEAM_COLORS[1];
      this.box(this.mapGroup, 0.12, 0.06, 38, x, 0.05, 0, color);
      for (const z of [-21, 21]) {
        this.box(this.mapGroup, 1.5, 0.4, 1.5, x, 0.2, z, stone);
        this.cylinder(this.mapGroup, 0.38, 0.6, 2.5, x, 1.45, z, stone, 6);
        this.poly(this.mapGroup, 0.52, x, 3, z, color);
      }
    }
    for (const o of map.obstacles) {
      if (o.kind === "pillar") {
        this.cylinder(
          this.mapGroup,
          o.radius * 0.88,
          o.radius,
          0.4,
          o.x,
          0.2,
          o.z,
          stone,
        );
        this.cylinder(
          this.mapGroup,
          o.radius * 0.62,
          o.radius * 0.68,
          o.height,
          o.x,
          o.height / 2 + 0.25,
          o.z,
          stone,
        );
        this.cylinder(
          this.mapGroup,
          o.radius * 0.85,
          o.radius * 0.85,
          0.35,
          o.x,
          o.height + 0.45,
          o.z,
          stone,
        );
        for (let j = 0; j < 3; j++)
          this.box(
            this.mapGroup,
            0.14,
            o.height * 0.8,
            0.1,
            o.x + (j - 1) * 0.35,
            o.height / 2 + 0.3,
            o.z + o.radius * 0.64,
            "#4e605a",
          );
      } else {
        const rock = this.poly(
          this.mapGroup,
          o.radius * 1.1,
          o.x,
          o.height * 0.28,
          o.z,
          stone,
        );
        rock.scale.y = o.height * 0.5;
        rock.rotation.set(rng(), rng(), rng());
      }
    }
    // Nonblocking small debris outside the movement square.
    for (let i = 0; i < 60; i++) {
      const x = rng() * 46 - 23,
        z = rng() * 46 - 23;
      if (Math.abs(z) < 7 || Math.abs(x) > 18) continue;
      const r = this.poly(
        this.mapGroup,
        0.1 + rng() * 0.32,
        x,
        0.06,
        z,
        i % 3 ? stone : "#879976",
      );
      r.scale.y *= 0.55;
    }
    for (let i = 0; i < 30; i++) {
      const mote = this.poly(
        this.mapGroup,
        0.035 + rng() * 0.04,
        rng() * 70 - 35,
        1 + rng() * 14,
        rng() * 70 - 35,
        map.theme.accent,
      );
      mote.material = this.material(map.theme.accent, true);
    }
  }

  createUnit(unit) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const color = TEAM_COLORS[unit.team],
      metal = "#bdc6bc",
      dark = "#283b3e";
    const skin =
      unit.form === "skeleton"
        ? "#dfdab9"
        : unit.form === "robot"
          ? "#9eaaa7"
          : "#b0ad94";
    const element = ELEMENT_COLORS[unit.element];
    const limbs = [];
    if (unit.form === "beast") {
      this.box(body, 0.8, 0.65, 1.35, 0, 0.85, 0, dark);
      this.poly(body, 0.48, 0, 1.1, 0.72, color);
      this.box(body, 0.4, 0.3, 0.6, 0, 0.98, 1.05, skin);
      for (const x of [-0.24, 0.24])
        this.cylinder(body, 0, 0.12, 0.4, x, 1.6, 0.7, skin, 4);
      for (const x of [-0.33, 0.33])
        for (const z of [-0.45, 0.45])
          limbs.push(this.box(body, 0.19, 0.6, 0.22, x, 0.35, z, skin));
      const tail = this.box(body, 0.18, 0.2, 0.7, 0, 0.9, -0.9, color);
      tail.rotation.x = -0.5;
    } else if (unit.form === "golem" || unit.role === "titan") {
      this.poly(body, 0.68, 0, 1.2, 0, "#84918a");
      this.box(body, 0.7, 0.65, 0.65, 0, 1.95, 0.04, "#b0b8a4");
      this.box(body, 0.4, 0.12, 0.04, 0, 2, 0.38, element);
      for (const side of [-1, 1]) {
        this.poly(body, 0.37, side * 0.86, 1.5, 0, color);
        limbs.push(
          this.box(body, 0.42, 0.7, 0.46, side * 0.93, 0.9, 0, "#79867d"),
        );
        limbs.push(
          this.box(body, 0.4, 0.65, 0.5, side * 0.35, 0.35, 0, "#a0aa99"),
        );
      }
      this.poly(body, 0.17, 0, 1.25, 0.62, color);
    } else {
      const cloak = unit.role === "mage" || unit.role === "healer";
      if (cloak) this.cylinder(body, 0.3, 0.57, 1.2, 0, 0.85, 0, color, 6);
      else this.box(body, 0.72, 0.75, 0.42, 0, 1.05, 0, color);
      this.box(body, 0.78, 0.14, 0.48, 0, 0.72, 0, dark);
      if (unit.form === "skeleton")
        for (let j = 0; j < 3; j++)
          this.box(body, 0.6, 0.07, 0.08, 0, 1 + j * 0.15, 0.25, skin);
      this.box(body, 0.5, 0.49, 0.48, 0, 1.72, 0, skin);
      if (unit.form === "robot") {
        this.box(body, 0.57, 0.16, 0.1, 0, 1.76, 0.26, element);
        this.box(body, 0.13, 0.38, 0.13, 0.17, 2.12, 0, metal);
      } else {
        this.box(body, 0.55, 0.2, 0.53, 0, 1.98, 0, dark);
        for (const x of [-0.13, 0.13])
          this.box(body, 0.09, 0.08, 0.04, x, 1.75, 0.25, "#132529");
      }
      if (unit.role === "mage") {
        this.cylinder(body, 0, 0.45, 0.85, 0, 2.35, 0, "#657481", 6);
        this.cylinder(body, 0.52, 0.52, 0.1, 0, 2, 0, "#657481", 8);
      }
      for (const side of [-1, 1]) {
        limbs.push(this.box(body, 0.2, 0.55, 0.26, side * 0.22, 0.36, 0, dark));
        limbs.push(
          this.box(body, 0.22, 0.65, 0.27, side * 0.49, 1, 0.02, skin),
        );
        this.box(body, 0.3, 0.24, 0.44, side * 0.22, 0.1, 0.08, dark);
      }
      if (cloak) {
        this.cylinder(body, 0.045, 0.045, 1.9, 0.65, 1, 0.2, "#665846", 5);
        this.poly(body, 0.22, 0.65, 2.03, 0.2, element);
        if (unit.role === "healer") {
          this.box(body, 0.46, 0.1, 0.1, 0.65, 2.04, 0.2, element);
          this.box(body, 0.1, 0.46, 0.1, 0.65, 2.04, 0.2, element);
        }
      } else if (unit.role === "ranger") {
        this.box(body, 0.14, 0.16, 1.2, 0.46, 1.05, 0.6, dark);
        this.box(body, 0.65, 0.12, 0.13, 0.46, 1.05, 0.75, metal);
      } else {
        this.box(body, 0.12, 1.1, 0.12, 0.58, 1.1, 0.28, metal);
        this.box(body, 0.4, 0.1, 0.18, 0.58, 0.75, 0.28, "#ddc49a");
        if (unit.role === "guardian")
          this.box(body, 0.65, 1, 0.2, -0.55, 1.05, 0.36, metal);
      }
    }
    body.scale.setScalar(unit.scale);
    const ring = new THREE.Mesh(
      this.geometry("unit-ring", () => new THREE.RingGeometry(0.65, 0.73, 24)),
      this.material(color, true),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.055;
    ring.scale.setScalar(unit.scale);
    root.add(ring);
    const health = new THREE.Group();
    health.position.y = 2.8 * unit.scale;
    this.box(health, 1.15, 0.085, 0.01, 0, 0, 0, "#23373a");
    const bar = this.box(health, 1.1, 0.06, 0.02, 0, 0, 0.015, color);
    root.add(health);
    root.traverse((child) => {
      if (child.isMesh) child.userData.unitId = unit.id;
    });
    root.position.set(unit.x, 0, unit.z);
    this.unitGroup.add(root);
    this.meshes.set(unit.id, {
      root,
      body,
      limbs,
      ring,
      health,
      bar,
      deathAge: 0,
    });
  }

  setUnits(units) {
    this.clearGroup(this.unitGroup);
    this.clearGroup(this.effectGroup);
    this.meshes.clear();
    this.effects = [];
    this.followId = null;
    this.selectedId = null;
    units.forEach((unit) => this.createUnit(unit));
    this.units = units;
  }

  setActive(active) {
    this.active = active;
    this.controls.autoRotate = !active;
  }
  select(id) {
    this.selectedId = id;
  }
  follow(id) {
    this.followId = id;
    if (id) {
      const unit = this.units?.find((u) => u.id === id);
      if (unit) {
        this.camera.position.set(unit.x - 7, 6, unit.z + 8);
        this.controls.target.set(unit.x, 1, unit.z);
      }
    }
  }
  overview() {
    this.followId = null;
    this.camera.position.set(39, 35, 43);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  event(event) {
    if (
      event.type !== "attack" &&
      event.type !== "heal" &&
      event.type !== "death"
    )
      return;
    if (this.effects.length > 120) return;
    const source = this.units.find((u) => u.id === event.from);
    const color =
      event.type === "heal"
        ? 0x8cf2a0
        : event.type === "death"
          ? TEAM_COLORS[event.team]
          : ELEMENT_COLORS[event.element];
    const mesh = this.poly(
      this.effectGroup,
      event.type === "death" ? 0.5 : 0.15,
      source?.x ?? event.x,
      source ? 1.5 * source.scale : 0.6,
      source?.z ?? event.z,
      color,
    );
    mesh.material = this.material(color, true);
    this.effects.push({
      mesh,
      age: 0,
      duration:
        event.type === "death"
          ? 0.5
          : event.ranged || event.type === "heal"
            ? 0.3
            : 0.16,
      from: mesh.position.clone(),
      to: new THREE.Vector3(event.x, 1.2, event.z),
      burst: event.type === "death" || (!event.ranged && event.type !== "heal"),
    });
  }

  update(dt, now, animationPaused = false) {
    const animationDt = animationPaused ? 0 : dt;
    this.animationTime = (this.animationTime || 0) + animationDt;
    const visualTime = this.animationTime;
    if (this.units)
      for (const unit of this.units) {
        const mesh = this.meshes.get(unit.id);
        if (!mesh) continue;
        if (!unit.alive) {
          mesh.deathAge += animationDt;
          mesh.root.rotation.z = Math.min(Math.PI / 2, mesh.deathAge * 4);
          mesh.root.position.y = -Math.min(3, Math.max(0, mesh.deathAge - 0.5));
          mesh.health.visible = false;
          mesh.ring.visible = false;
          mesh.root.visible = mesh.deathAge < 3;
          continue;
        }
        mesh.root.position.set(unit.x, 0, unit.z);
        mesh.body.rotation.y = unit.facing;
        mesh.body.position.y =
          unit.moving && this.active
            ? Math.abs(Math.sin(visualTime * 11 + unit.x)) * 0.09
            : Math.sin(visualTime * 2 + unit.z) * 0.025;
        mesh.body.rotation.x =
          unit.attackFlash > 0 ? -Math.sin(unit.attackFlash * 16) * 0.14 : 0;
        mesh.limbs.forEach((limb, i) => {
          limb.rotation.x =
            unit.moving && this.active
              ? Math.sin(visualTime * 11 + i * Math.PI) * 0.4
              : 0;
        });
        mesh.ring.scale.setScalar(
          unit.scale *
            (unit.id === this.selectedId
              ? 1.35 + Math.sin(visualTime * 5) * 0.07
              : 1),
        );
        mesh.health.quaternion.copy(this.camera.quaternion);
        const percent = Math.max(0.001, unit.hp / unit.maxHp);
        mesh.bar.scale.x = 1.1 * percent;
        mesh.bar.position.x = -(1.1 - 1.1 * percent) / 2;
        mesh.health.visible = this.active || unit.id === this.selectedId;
      }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += animationDt;
      const progress = effect.age / effect.duration;
      if (progress >= 1) {
        this.effectGroup.remove(effect.mesh);
        this.effects.splice(i, 1);
        continue;
      }
      if (effect.burst) {
        effect.mesh.position.copy(effect.to);
        effect.mesh.scale.setScalar(0.25 + progress * 1.5);
      } else {
        effect.mesh.position.lerpVectors(effect.from, effect.to, progress);
        effect.mesh.position.y += Math.sin(progress * Math.PI) * 0.8;
      }
    }
    if (this.followId) {
      const unit = this.units?.find((u) => u.id === this.followId && u.alive);
      if (unit) {
        const next = new THREE.Vector3(unit.x, 1.3 * unit.scale, unit.z);
        const delta = next
          .clone()
          .sub(this.controls.target)
          .multiplyScalar(Math.min(1, dt * 8));
        this.controls.target.add(delta);
        this.camera.position.add(delta);
      } else this.followId = null;
    }
    if (this.active && !this.followId && this.keys.size) {
      const speed = (this.keys.has("ShiftLeft") ? 26 : 12) * dt;
      const forward = this.controls.target.clone().sub(this.camera.position);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3()
        .crossVectors(forward, this.camera.up)
        .normalize();
      const offset = new THREE.Vector3();
      if (this.keys.has("KeyW")) offset.addScaledVector(forward, speed);
      if (this.keys.has("KeyS")) offset.addScaledVector(forward, -speed);
      if (this.keys.has("KeyD")) offset.addScaledVector(right, speed);
      if (this.keys.has("KeyA")) offset.addScaledVector(right, -speed);
      if (this.keys.has("KeyE")) offset.y += speed;
      if (this.keys.has("KeyQ")) offset.y -= speed;
      if (
        this.camera.position.y + offset.y > 0.7 &&
        this.camera.position.y + offset.y < 100
      ) {
        this.camera.position.add(offset);
        this.controls.target.add(offset);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
  clearGroup(group) {
    while (group.children.length) group.remove(group.children[0]);
  }
}
