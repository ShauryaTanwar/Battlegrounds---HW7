import { normalizeArmy } from "./catalog.js";

const NUMBERS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
};
const counts =
  /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty)\b/i;
/** Explicit keyword fallback, not a language model. Kept usable without internet or a key. */
export function offlineArmy(prompt) {
  if (typeof prompt !== "string" || !prompt.trim())
    throw new Error("Describe an army first.");
  const parts = prompt
    .toLowerCase()
    .replace(/[.!?]/g, "")
    .split(/[,;\n]|\band\b|\bplus\b|\bled by\b|\bprotected by\b/)
    .map((p) => p.trim())
    .filter(Boolean);
  const groups = parts.slice(0, 16).map((part) => {
    let role = "striker";
    if (/titan|giant|dragon|dinosaur|mech\b|ancient golem/.test(part))
      role = "titan";
    else if (/heal|medic|priest|mender|druid/.test(part)) role = "healer";
    else if (/mage|wizard|witch|sorcer|arcanist/.test(part)) role = "mage";
    else if (/archer|ranger|rifle|sniper|laser|marine|gun/.test(part))
      role = "ranger";
    else if (/guardian|shield|tank|armored|golem|defender/.test(part))
      role = "guardian";
    else if (/wolf|wolves|beast|dog|lion|raptor|bear/.test(part))
      role = "beast";
    else if (/tiny|goblin|swarm|minion|skeleton/.test(part)) role = "swarm";
    const match = part.match(counts);
    const count = match ? (NUMBERS[match[1]] ?? Number(match[1])) : 3;
    const element = /fire|flame|ember/.test(part)
      ? "fire"
      : /ice|frost|snow/.test(part)
        ? "frost"
        : /lightning|electric|shock|laser/.test(part)
          ? "lightning"
          : /nature|druid|heal/.test(part)
            ? "nature"
            : /magic|mage|wizard|arcane/.test(part)
              ? "arcane"
              : "physical";
    const form = /robot|mech|marine|space|laser/.test(part)
      ? "robot"
      : /skeleton|undead/.test(part)
        ? "skeleton"
        : /golem|stone|titan/.test(part)
          ? "golem"
          : role === "beast"
            ? "beast"
            : "soldier";
    const name = part
      .replace(counts, "")
      .replace(/^(of |a squad of |a chaotic horde of )/, "")
      .trim();
    return {
      role,
      count,
      name: name ? name[0].toUpperCase() + name.slice(1) : "Vanguard",
      description: `Offline interpretation: ${part}`,
      element,
      form,
    };
  });
  const result = normalizeArmy(groups);
  return {
    ...result,
    source: "offline",
    summary:
      "Keyword interpretation. Names, roles, counts, and appearances use supported words; custom powers map to balanced roles.",
  };
}
