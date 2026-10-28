const KEY = "battlegrounds.history.v1";
export function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              Array.isArray(item.teams) &&
              item.teams.length === 2 &&
              item.teams.every(
                (team) =>
                  team &&
                  typeof team.name === "string" &&
                  Array.isArray(team.prompts),
              ),
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
export function saveMatch(match) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([match, ...readHistory()].slice(0, 20)),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
