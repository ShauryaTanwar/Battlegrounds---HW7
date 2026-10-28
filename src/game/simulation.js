import { ROLES, normalizeArmy } from "./catalog.js";
import { random } from "./random.js";
import { createMap } from "./maps.js";

export const FIXED_DT = 1 / 60;
export const SUDDEN_DEATH_AT = 120;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Pure simulation: no DOM, Three.js, API, wall clock, or global random state. */
export class Simulation {
  constructor(armies, seed = 1, theme = "ruins") {
    this.seed = seed;
    this.rng = random(seed);
    this.map = createMap(seed, theme);
    this.time = 0;
    this.units = [];
    this.events = [];
    this.result = null;
    this.suddenDeath = false;
    this.damage = [0, 0];
    armies.forEach((army, team) => {
      let n = 0;
      for (const [g, group] of normalizeArmy(army).groups.entries()) {
        for (let i = 0; i < group.count; i++) {
          const stats = ROLES[group.role];
          const row = Math.floor(n / 6),
            col = n % 6;
          this.units.push({
            ...stats,
            ...group,
            count: undefined,
            id: `${team}-${g}-${i}`,
            team,
            x: (team ? 1 : -1) * (15 + row * 1.8),
            z: (col - 2.5) * 2.3,
            maxHp: stats.hp,
            hp: stats.hp,
            alive: true,
            cooldownLeft: this.rng() * stats.cooldown,
            facing: team ? -Math.PI / 2 : Math.PI / 2,
            attackFlash: 0,
            moving: false,
            kills: 0,
            damageDealt: 0,
            healingDone: 0,
            targetId: null,
          });
          n++;
        }
      }
    });
  }

  living(team) {
    return this.units.filter(
      (u) => u.alive && (team === undefined || u.team === team),
    );
  }

  step(dt = FIXED_DT) {
    if (this.result) return;
    this.time += dt;
    this.events = [];
    if (this.time >= SUDDEN_DEATH_AT && !this.suddenDeath) {
      this.suddenDeath = true;
      this.events.push({ type: "sudden-death" });
    }
    const alive = this.living();
    const pending = new Map(
      alive.map((u) => [u.id, { damage: 0, healing: 0, attacker: null }]),
    );
    for (const unit of alive) {
      unit.cooldownLeft -= dt;
      unit.attackFlash = Math.max(0, unit.attackFlash - dt);
      let target,
        healing = false;
      if (unit.heal && !this.suddenDeath) {
        target = alive
          .filter(
            (u) =>
              u.team === unit.team &&
              u.hp < u.maxHp - 8 &&
              distance(u, unit) < 12,
          )
          .sort(
            (a, b) =>
              a.hp / a.maxHp - b.hp / b.maxHp ||
              distance(unit, a) - distance(unit, b),
          )[0];
        healing = Boolean(target);
      }
      if (!target)
        target = alive
          .filter((u) => u.team !== unit.team)
          .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
      if (!target) continue;
      unit.targetId = target.id;
      const dx = target.x - unit.x,
        dz = target.z - unit.z;
      const dist = Math.hypot(dx, dz);
      unit.facing = Math.atan2(dx, dz);
      unit.moving = dist > unit.range + target.radius;
      if (unit.moving) this.move(unit, dx / (dist || 1), dz / (dist || 1), dt);
      if (!unit.moving && unit.cooldownLeft <= 0) {
        unit.cooldownLeft = unit.cooldown;
        unit.attackFlash = 0.2;
        if (healing) {
          pending.get(target.id).healing += unit.heal;
          unit.healingDone += Math.min(unit.heal, target.maxHp - target.hp);
          this.events.push({
            type: "heal",
            from: unit.id,
            to: target.id,
            x: target.x,
            z: target.z,
            element: "nature",
          });
        } else {
          const victims = unit.splash
            ? alive.filter(
                (u) =>
                  u.team !== unit.team &&
                  distance(u, target) <= unit.splash + u.radius,
              )
            : [target];
          for (const victim of victims) {
            const damage =
              unit.damage *
              (1 - victim.armor) *
              (victim.id === target.id ? 1 : 0.65);
            const effect = pending.get(victim.id);
            effect.damage += damage;
            effect.attacker = unit;
            unit.damageDealt += Math.min(damage, victim.hp);
            this.damage[unit.team] += damage;
          }
          this.events.push({
            type: "attack",
            from: unit.id,
            to: target.id,
            x: target.x,
            z: target.z,
            element: unit.element,
            ranged: unit.range > 3,
            splash: unit.splash || 0,
          });
        }
      }
    }
    this.separate(alive);
    for (const unit of alive) {
      const effect = pending.get(unit.id);
      const decay = this.suddenDeath
        ? (8 + (this.time - SUDDEN_DEATH_AT) * 0.75) * dt
        : 0;
      unit.hp = Math.max(
        0,
        Math.min(unit.maxHp, unit.hp + effect.healing - effect.damage - decay),
      );
      if (unit.hp <= 0) {
        unit.alive = false;
        if (effect.attacker) effect.attacker.kills++;
        this.events.push({
          type: "death",
          id: unit.id,
          team: unit.team,
          name: unit.name,
          x: unit.x,
          z: unit.z,
        });
      }
    }
    const counts = [this.living(0).length, this.living(1).length];
    if (!counts[0] || !counts[1]) {
      this.result = {
        winner: counts[0] ? 0 : counts[1] ? 1 : null,
        time: this.time,
        survivors: counts,
        seed: this.seed,
      };
      this.events.push({ type: "end", result: this.result });
    }
  }

  move(unit, dx, dz, dt) {
    let steerX = dx,
      steerZ = dz;
    for (const obstacle of this.map.obstacles) {
      const ox = unit.x - obstacle.x,
        oz = unit.z - obstacle.z;
      const dist = Math.hypot(ox, oz),
        safe = obstacle.radius + unit.radius + 1.6;
      if (dist < safe) {
        const force = ((safe - dist) / safe) * 3;
        steerX += (ox / (dist || 1)) * force;
        steerZ += (oz / (dist || 1)) * force;
        // A consistent tangent prevents a head-on encounter from stalling.
        steerX += (-oz / (dist || 1)) * 0.65;
        steerZ += (ox / (dist || 1)) * 0.65;
      }
    }
    const length = Math.hypot(steerX, steerZ) || 1;
    unit.x += (steerX / length) * unit.speed * dt;
    unit.z += (steerZ / length) * unit.speed * dt;
    this.constrain(unit);
  }

  constrain(unit) {
    const limit = this.map.half - unit.radius;
    unit.x = Math.max(-limit, Math.min(limit, unit.x));
    unit.z = Math.max(-limit, Math.min(limit, unit.z));
    for (const obstacle of this.map.obstacles) {
      const dx = unit.x - obstacle.x,
        dz = unit.z - obstacle.z,
        d = Math.hypot(dx, dz);
      const r = obstacle.radius + unit.radius;
      if (d < r) {
        unit.x = obstacle.x + ((dx || 0.001) / (d || 0.001)) * r;
        unit.z = obstacle.z + (dz / (d || 0.001)) * r;
      }
    }
  }

  separate(alive) {
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i],
          b = alive[j],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const dist = Math.hypot(dx, dz),
          safe = (a.radius + b.radius) * 0.9;
        if (dist < safe) {
          const force = (safe - dist) * 0.5;
          const nx = dist > 0.001 ? dx / dist : 1,
            nz = dist > 0.001 ? dz / dist : 0;
          a.x -= nx * force;
          a.z -= nz * force;
          b.x += nx * force;
          b.z += nz * force;
        }
      }
    alive.forEach((u) => this.constrain(u));
  }
}
