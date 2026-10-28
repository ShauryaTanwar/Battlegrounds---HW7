/** The one source of truth for mechanical power. AI can choose roles, never stats. */
export const POWER_CAP = 1000;
export const MAX_UNITS = 32;
export const DRAFT_SECONDS = 120;
export const ROLES = Object.freeze({
  striker: {
    name: "Vanguard",
    icon: "◆",
    cost: 80,
    hp: 130,
    damage: 22,
    range: 1.7,
    speed: 4.5,
    cooldown: 0.8,
    armor: 0.05,
    radius: 0.48,
    scale: 1,
    ability: "Quick melee attacks",
  },
  guardian: {
    name: "Guardian",
    icon: "⬟",
    cost: 125,
    hp: 300,
    damage: 23,
    range: 1.9,
    speed: 2.8,
    cooldown: 1.3,
    armor: 0.3,
    radius: 0.65,
    scale: 1.2,
    ability: "30% damage resistance",
  },
  ranger: {
    name: "Ranger",
    icon: "➶",
    cost: 100,
    hp: 90,
    damage: 23,
    range: 11,
    speed: 3.8,
    cooldown: 1.2,
    armor: 0,
    radius: 0.44,
    scale: 0.95,
    ability: "Long-range bolts",
  },
  mage: {
    name: "Arcanist",
    icon: "✦",
    cost: 150,
    hp: 85,
    damage: 30,
    range: 8,
    speed: 3,
    cooldown: 1.8,
    armor: 0,
    radius: 0.5,
    scale: 1.05,
    splash: 2.8,
    ability: "Area damage in a 2.8m radius",
  },
  healer: {
    name: "Mender",
    icon: "✚",
    cost: 130,
    hp: 100,
    damage: 10,
    range: 7,
    speed: 3.4,
    cooldown: 1.3,
    armor: 0,
    radius: 0.48,
    scale: 1,
    heal: 25,
    ability: "Restores 25 allied HP; fights when no healing is needed",
  },
  beast: {
    name: "Ravager",
    icon: "⟐",
    cost: 110,
    hp: 160,
    damage: 29,
    range: 1.8,
    speed: 5.5,
    cooldown: 0.95,
    armor: 0,
    radius: 0.6,
    scale: 1.1,
    ability: "Fast flanking melee",
  },
  swarm: {
    name: "Minion",
    icon: "⋮",
    cost: 40,
    hp: 48,
    damage: 10,
    range: 1.3,
    speed: 4.6,
    cooldown: 0.7,
    armor: 0,
    radius: 0.32,
    scale: 0.65,
    ability: "Cheap, numerous melee troops",
  },
  titan: {
    name: "Titan",
    icon: "♜",
    cost: 300,
    hp: 550,
    damage: 48,
    range: 2.7,
    speed: 2.2,
    cooldown: 1.7,
    armor: 0.18,
    radius: 0.95,
    scale: 1.8,
    splash: 2.6,
    ability: "Heavy armored area attacks",
  },
});
export const ELEMENTS = [
  "physical",
  "fire",
  "frost",
  "arcane",
  "nature",
  "lightning",
];
export const FORMS = ["soldier", "skeleton", "robot", "beast", "golem"];
export const MAPS = [
  {
    id: "ruins",
    name: "The Sunken Colosseum",
    subtitle: "Ancient stone. New legends.",
    ground: "#52665a",
    rock: "#79867b",
    sky: "#17282c",
    accent: "#c7be90",
  },
  {
    id: "desert",
    name: "Ember Expanse",
    subtitle: "Where the dust remembers.",
    ground: "#8e7957",
    rock: "#b5a17b",
    sky: "#302b28",
    accent: "#edb77c",
  },
  {
    id: "frost",
    name: "Frostfall Sanctuary",
    subtitle: "A silence waiting to break.",
    ground: "#607c87",
    rock: "#a2bac0",
    sky: "#1a2c3a",
    accent: "#a5e5f1",
  },
];
export const SUGGESTIONS = [
  "A stone titan, three fire mages, and four tiny skeleton warriors.",
  "A squad of six robot archers protected by three armored guardians.",
  "Seven frost wolves led by a nature healer.",
  "Two ancient golems, four knights, and three lightning archers.",
  "A chaotic horde of twenty tiny goblins and a battle wizard.",
  "Space marines with laser rifles, a medic, and a giant battle mech.",
];

export function armyCost(army) {
  return army.reduce(
    (sum, group) => sum + (ROLES[group.role]?.cost ?? 0) * group.count,
    0,
  );
}
export function armyCount(army) {
  return army.reduce((sum, group) => sum + group.count, 0);
}

/** Validate model/browser input, ignore arbitrary stats, and enforce caps in stable order. */
export function normalizeArmy(input) {
  if (!Array.isArray(input))
    throw new Error("Army must be a list of unit groups.");
  let budget = POWER_CAP;
  let slots = MAX_UNITS;
  const groups = [];
  const notes = [];
  for (const raw of input.slice(0, 16)) {
    if (!raw || !Object.hasOwn(ROLES, raw.role)) {
      notes.push("An unsupported role was skipped.");
      continue;
    }
    const role = ROLES[raw.role];
    const requested = Number.isFinite(Number(raw.count))
      ? Math.max(0, Math.floor(Number(raw.count)))
      : 1;
    const count = Math.min(requested, slots, Math.floor(budget / role.cost));
    if (count < requested)
      notes.push(
        `${String(raw.name || role.name).slice(0, 40)} limited to ${count} to respect the power / unit cap.`,
      );
    if (count < 1) continue;
    groups.push({
      role: raw.role,
      count,
      name:
        String(raw.name || role.name)
          .trim()
          .slice(0, 40) || role.name,
      description: String(raw.description || role.ability).slice(0, 160),
      element: ELEMENTS.includes(raw.element) ? raw.element : "physical",
      form: FORMS.includes(raw.form)
        ? raw.form
        : raw.role === "beast"
          ? "beast"
          : raw.role === "titan"
            ? "golem"
            : "soldier",
    });
    slots -= count;
    budget -= count * role.cost;
  }
  if (!groups.length)
    throw new Error(
      "No units fit this army. Try adding at least one supported troop.",
    );
  return { groups, notes, cost: POWER_CAP - budget, count: MAX_UNITS - slots };
}
