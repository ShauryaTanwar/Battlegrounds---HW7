import "./style.css";
import { Battlefield } from "./game/renderer.js";
import { Simulation, FIXED_DT } from "./game/simulation.js";
import {
  ROLES,
  MAPS,
  SUGGESTIONS,
  POWER_CAP,
  DRAFT_SECONDS,
  armyCost,
  armyCount,
  normalizeArmy,
} from "./game/catalog.js";
import { offlineArmy } from "./game/offline.js";
import { escape as e, clock, icon } from "./ui/html.js";
import { readHistory, saveMatch, clearHistory } from "./ui/storage.js";

const app = document.querySelector("#app");
const state = {
  screen: "menu",
  player: 0,
  teams: [],
  map: "ruins",
  seed: newSeed(),
  seconds: DRAFT_SECONDS,
  busy: false,
  timerEnabled: true,
  mode: "auto",
  aiAvailable: false,
  apiOnline: false,
  paused: false,
  speed: 1,
  selected: null,
  modal: null,
  sound: false,
  prompt: "",
};
let world,
  simulation,
  lastFrame = performance.now(),
  accumulator = 0,
  uiElapsed = 0,
  countdown = 0;
let toastTimer, audio;
function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
function team(index) {
  return state.teams[index];
}
function currentTeam() {
  return team(state.player);
}
function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 5000);
}
function sound(frequency = 220, duration = 0.06) {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch {
    /* Audio is optional; browser permission cannot prevent play. */
  }
}
function freshTeams() {
  return [
    { name: "The Verdant Order", army: [], prompts: [], source: "presets" },
    { name: "The Ember Legion", army: [], prompts: [], source: "presets" },
  ];
}
function button(action, content, cls = "", extra = "") {
  return `<button class="${cls}" data-action="${action}" ${extra}>${content}</button>`;
}
function badge() {
  return `<button class="mode-badge" data-action="settings"><span class="status-dot ${state.aiAvailable && state.mode !== "offline" ? "online" : ""}"></span>${state.aiAvailable && state.mode !== "offline" ? "ChatGPT connected" : "Offline forge"}${icon("settings", 13)}</button>`;
}
function header() {
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="Battlegrounds home"><span class="brand-mark">${icon("swords", 27)}</span><span>BATTLEGROUNDS<small>AI BATTLE SIMULATOR</small></span></button><nav aria-label="Main navigation">${button("new", "New battle", state.screen === "menu" ? "nav-link active" : "nav-link")}${button("guide", `${icon("book", 15)} Field guide`, "nav-link")}${button("history", `${icon("history", 15)} Match history`, "nav-link")}</nav><div class="header-right">${badge()}${button("sound", icon("volume"), `icon-btn ${state.sound ? "enabled" : "muted"}`, `aria-label="${state.sound ? "Mute" : "Enable"} sound" title="Toggle sound"`)}</div></header>`;
}
function mapCard(map, i) {
  return `<button class="map-card ${state.map === map.id ? "selected" : ""} ${map.id}" data-action="map" data-value="${map.id}"><span class="map-art"><span class="map-pillar p1"></span><span class="map-pillar p2"></span><span class="map-pillar p3"></span><span class="map-sun"></span><span class="map-number">0${i + 1}</span></span><span class="map-info"><span>${map.name}</span><small>${map.subtitle}</small></span><span class="map-radio">${state.map === map.id ? icon("check", 12) : ""}</span></button>`;
}
function menu() {
  return `${header()}<main class="menu-layout"><section class="hero"><p class="eyebrow"><span class="tiny-line"></span>THE ULTIMATE “WHAT IF?”</p><h1>Dream it.<br><em>Deploy it.</em></h1><p class="hero-copy">An army of wizards. A legion of robots.<br>Your wildest ideas, on the same battlefield.</p><p class="hero-subcopy">Two commanders. One arena. Let imagination fight.</p><div class="hero-actions">${button("new", `Create a battle ${icon("arrow")}`, "primary large")}${button("demo", `${icon("play", 15)} Watch a demo`, "secondary large")}</div><div class="hero-facts"><span><b>02</b> LOCAL PLAYERS</span><span><b>1,000</b> POWER PER TEAM</span><span><b>∞</b> POSSIBILITIES</span></div></section><aside class="scene-caption"><span class="eyebrow"><span class="live-dot"></span>THE ARENA IS WAITING</span><span>Imagination meets its match.</span><small>Real-time 3D · Procedural battlefields</small></aside><section class="battlefield-picker"><div class="section-label"><span><span class="index-number">01 /</span> CHOOSE YOUR BATTLEGROUND</span><span class="subtle">A different stage. The same rivalry.</span></div><div class="map-grid">${MAPS.map(mapCard).join("")}</div></section></main><footer class="menu-footer"><span>BUILT FOR IMPOSSIBLE MATCHUPS.</span><span>${icon("globe", 13)} LOCAL SANDBOX <span class="footer-divider">/</span> NO DOWNLOADS. JUST IDEAS.</span></footer>`;
}
function roster(groups, editable = false) {
  if (!groups.length)
    return `<div class="empty-roster"><span>${icon("flag", 28)}</span><b>Your army starts with an idea.</b><p>Describe a force above, or add ready-made troops below.</p></div>`;
  return groups
    .map(
      (g, i) =>
        `<div class="roster-row"><span class="role-icon ${g.element}">${ROLES[g.role].icon}</span><div class="roster-name"><b>${e(g.name)}</b><small>${ROLES[g.role].name} · ${e(g.element)} · ${ROLES[g.role].cost} power each</small></div><span class="roster-count">×${g.count}</span>${editable ? button("remove", "−", "remove-btn", `data-index="${i}" aria-label="Remove one ${e(g.name)}"`) : ""}</div>`,
    )
    .join("");
}
function draft() {
  const t = currentTeam(),
    cost = armyCost(t.army);
  return `${header()}<main class="draft-layout"><section class="draft-panel panel team-${state.player}"><div class="draft-heading"><div><p class="eyebrow">COMMANDER 0${state.player + 1} / ARMY FORGE</p><h2>Make the impossible.</h2></div><div class="draft-clock" id="draft-clock">${state.timerEnabled ? clock(state.seconds) : "∞"}</div></div><label class="field-label" for="team-name">YOUR ARMY’S NAME</label><input id="team-name" maxlength="28" value="${e(t.name)}" autocomplete="off"><label class="field-label prompt-label" for="army-prompt">DESCRIBE YOUR FORCE <span id="prompt-count">${state.prompt.length}/1600</span></label><textarea id="army-prompt" maxlength="1600" placeholder="Six robot archers, three shield guardians, and a fearless battle medic…" ${state.busy ? "disabled" : ""}>${e(state.prompt)}</textarea><div class="prompt-tools">${button("suggest", `${icon("spark", 14)} Inspire me`, "text-btn", state.busy ? "disabled" : "")}<span>Generating replaces your current army.</span></div>${button("generate", `${icon("spark")} ${state.busy ? "Forging your army…" : state.aiAvailable && state.mode !== "offline" ? "Generate with ChatGPT" : "Forge army"} ${icon("arrow", 16)}`, "primary generate-btn", state.busy ? "disabled" : "")}<div class="forge-message" id="forge-message" role="status">${e(t.message || (state.aiAvailable && state.mode !== "offline" ? "ChatGPT interprets your idea. The game enforces the same rules for everyone." : "Offline keyword builder: try knights, archers, wizards, wolves, robots, or titans."))}</div><div class="roster-heading"><span>YOUR ROSTER <b>${armyCount(t.army)}</b></span><span><strong>${cost}</strong> / ${POWER_CAP} POWER</span></div><div class="power-track"><span style="width:${cost / 10}%"></span></div><div class="roster-list">${roster(t.army, true)}</div><div class="preset-heading"><span>REINFORCEMENTS</span><small>Click to add one</small></div><div class="preset-grid">${Object.entries(
    ROLES,
  )
    .map(([id, role]) =>
      button(
        "preset",
        `<span>${role.icon}</span>${role.name}<small>${role.cost}</small>`,
        "preset-btn",
        `data-value="${id}" title="${e(role.ability)}" ${state.busy || cost + role.cost > POWER_CAP ? "disabled" : ""}`,
      ),
    )
    .join(
      "",
    )}</div><div class="draft-bottom"><label class="toggle-label"><input type="checkbox" id="timer-toggle" ${state.timerEnabled ? "checked" : ""} ${state.busy ? "disabled" : ""}> 2-minute draft timer</label>${button("lock", `Lock army ${icon("check", 16)}`, "primary", !t.army.length || state.busy ? "disabled" : "")}</div></section><aside class="draft-aside"><p class="eyebrow">${icon("camera", 15)} LIVE ARMY PREVIEW</p><h3>${e(t.name)}</h3><p>Every legend starts somewhere.</p><div class="preview-note"><span class="live-dot"></span>Drag to orbit · Scroll to zoom</div></aside></main><div class="draft-progress"><span class="${state.player === 0 ? "current" : "complete"}">01 <b>Commander one</b></span><i></i><span class="${state.player === 1 ? "current" : ""}">02 <b>Commander two</b></span><i></i><span>03 <b>Battle</b></span></div>`;
}
function handoff() {
  return `${header()}<main class="center-screen"><section class="handoff-card panel"><span class="card-symbol coral">${icon("flag", 36)}</span><p class="eyebrow">COMMANDER ONE’S ARMY IS SEALED</p><h2>Pass the command.</h2><p>Hand the device to Commander Two.<br>Your opponent’s army stays hidden until battle.</p><div class="handoff-rule"><span>0${state.player + 1}</span><div><b>Your imagination is your advantage.</b><small>Build your own force with 1,000 power.</small></div></div>${button("ready", `I’m Commander Two ${icon("arrow")}`, "primary large")}<small class="privacy-note">Local pass-and-play · Share the screen once both armies are locked</small></section></main>`;
}
function battle() {
  return `<main class="battle-ui"><div class="battle-top"><div class="battle-team team-0"><span class="team-number">01</span><div><p>${e(team(0).name)}</p><span id="team-0-count"></span></div><div class="team-hp"><span id="team-0-bar"></span></div></div><div class="battle-clock"><span id="battle-state">BATTLE IN PROGRESS</span><b id="battle-clock">00:00</b><small>${e(MAPS.find((m) => m.id === state.map).name)}</small></div><div class="battle-team team-1"><span class="team-number">02</span><div><p>${e(team(1).name)}</p><span id="team-1-count"></span></div><div class="team-hp"><span id="team-1-bar"></span></div></div></div><aside class="battle-log panel"><p class="eyebrow"><span class="live-dot"></span> BATTLE FEED</p><div id="battle-feed"><p class="log-intro">Two armies enter. A legend leaves.</p></div></aside><aside id="unit-inspector" class="unit-inspector panel"></aside><div class="battle-bottom"><div class="camera-tools">${button("overview", `${icon("camera")} Overview`, "secondary")}${button("next", "Next unit <kbd>Tab</kbd>", "secondary")}${button("follow", "Follow <kbd>F</kbd>", "secondary", 'id="follow-btn"')}${button("guide", "?", "icon-btn", 'aria-label="Camera controls"')}</div><div class="playback panel">${button("pause", icon("pause"), "icon-btn", 'id="pause-btn" aria-label="Pause battle"')}${[0.5, 1, 2, 4].map((speed) => button("speed", `${speed}×`, state.speed === speed ? "speed-btn selected" : "speed-btn", `data-value="${speed}"`)).join("")}<span class="playback-divider"></span>${button("leave", icon("close"), "icon-btn", 'aria-label="Leave battle"')}</div></div><div class="camera-help"><kbd>W A S D</kbd> fly <kbd>Q E</kbd> altitude <span>·</span> Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Click a unit to inspect</div><div class="countdown" id="countdown" aria-live="polite"></div></main>`;
}
function results() {
  const result = simulation.result,
    winner = result.winner;
  const mvp = [...simulation.units].sort(
    (a, b) => b.damageDealt + b.healingDone - a.damageDealt - a.healingDone,
  )[0];
  return `${header()}<main class="results-layout"><section class="results-card panel"><p class="eyebrow">THE DUST HAS SETTLED</p><span class="victory-symbol ${winner === 1 ? "coral" : ""}">${icon("flag", 40)}</span><h2>${winner === null ? "Mutual destruction." : "Victory, imagined."}</h2><h3 class="${winner === 1 ? "coral" : "mint"}">${winner === null ? "No army survived the clash." : e(team(winner).name)}</h3><p>${winner === null ? "Both forces fell. Some rivalries have no winner." : `Commander ${winner + 1} takes the battlefield.`}</p><div class="result-stats"><div><b>${clock(result.time)}</b><span>BATTLE TIME</span></div><div><b>${result.survivors.reduce((a, b) => a + b, 0)}</b><span>SURVIVORS</span></div><div><b>${simulation.units.length}</b><span>UNITS DEPLOYED</span></div></div><div class="mvp"><span>${icon("spark", 25)}</span><div><small>STANDOUT UNIT</small><b>${e(mvp.name)}</b><p>${mvp.kills} eliminations · ${Math.round(mvp.damageDealt)} damage · ${Math.round(mvp.healingDone)} healing</p></div></div><div class="result-actions">${button("rematch", `Rematch ${icon("swords", 16)}`, "primary")}${button("new", "New armies", "secondary")}${button("home", "Main menu", "text-btn")}</div><small class="seed-label">BATTLE SEED ${state.seed} · ${e(MAPS.find((m) => m.id === state.map).name)}</small></section><section class="reveal-panel panel"><div class="section-label"><span>THE IDEAS BEHIND THE ARMIES</span>${icon("book", 18)}</div>${state.teams.map((t, i) => `<article class="reveal-team team-${i}"><p class="eyebrow">COMMANDER 0${i + 1} · ${e(t.source === "openai" ? "CHATGPT" : t.source === "offline" ? "OFFLINE FORGE" : "PRESET TROOPS")}</p><h3>${e(t.name)}</h3><blockquote>${t.prompts.length ? t.prompts.map((p) => e(p)).join("<br>") : "An army assembled from ready-made reinforcements."}</blockquote><div class="reveal-roster">${roster(t.army)}</div><p class="reveal-total">${armyCount(t.army)} units · ${armyCost(t.army)} / ${POWER_CAP} power</p></article>`).join("")}</section></main>`;
}
function guideContent() {
  return `<p class="eyebrow">A COMMANDER’S HANDBOOK</p><h2>Ideas in. Legends out.</h2><div class="guide-steps"><div><b>01</b><h3>Forge your army</h3><p>Take turns on one device. Each commander gets two minutes and 1,000 power. Describe a force or add preset troops. The timer pauses during generation and when this guide is open.</p></div><div><b>02</b><h3>Watch the clash</h3><p>Your units choose targets, navigate obstacles, and fight automatically. Menders heal wounded allies. Arcanists and titans deal area damage. Every role has fixed stats.</p></div><div><b>03</b><h3>Reveal the rivalry</h3><p>The last surviving army wins. Both players’ prompts are revealed afterward. Rematch with a new map seed, or return to the forge.</p></div></div><h3 class="guide-subtitle">Your seat above the battlefield</h3><div class="controls-grid"><span><kbd>Drag</kbd> Orbit camera</span><span><kbd>Right drag</kbd> Pan camera</span><span><kbd>Scroll</kbd> Zoom in / out</span><span><kbd>W A S D</kbd> Fly horizontally</span><span><kbd>Q / E</kbd> Descend / ascend</span><span><kbd>Shift</kbd> Fly faster</span><span><kbd>Click</kbd> Inspect a unit</span><span><kbd>F</kbd> Follow selected unit</span><span><kbd>Tab</kbd> Select next survivor</span><span><kbd>Esc</kbd> Release follow / close dialog</span><span><kbd>Space</kbd> Pause / resume battle</span><span><kbd>O</kbd> Arena overview</span></div><h3 class="guide-subtitle">The rules of imagination</h3><p class="guide-copy">Names and appearances can be fantastical; mechanics use eight balanced roles. Elements change visual effects, not damage. Flying, invincibility, summoning, and unique scripted powers are approximated. After two battle minutes, healing stops and escalating arena damage prevents endless stalemates. Simultaneous defeat is a draw.</p><div class="role-guide">${Object.entries(
    ROLES,
  )
    .map(
      ([, r]) =>
        `<div><span class="role-icon">${r.icon}</span><b>${r.name}<small>${r.cost} power · ${r.hp} HP</small></b><p>${r.ability}</p></div>`,
    )
    .join("")}</div>`;
}
function historyContent() {
  const history = readHistory();
  return `<p class="eyebrow">THE ARCHIVE / THIS BROWSER</p><h2>Every clash, a story.</h2><p class="guide-copy">Your last 20 completed matches. Prompts are stored locally on this browser.</p>${history.length ? `<div class="history-list">${history.map((item) => `<article class="history-item"><div><p class="eyebrow">${e(new Date(item.date).toLocaleString())} · ${clock(item.time)}</p><h3>${e(item.teams[0].name)} <span>vs</span> ${e(item.teams[1].name)}</h3><p class="mint">${item.winner === null ? "Draw" : `${e(item.teams[item.winner === 1 ? 1 : 0].name)} won`}</p></div><details><summary>Reveal prompts</summary>${item.teams.map((t, i) => `<p><b>Commander ${i + 1}:</b> ${t.prompts.length ? t.prompts.map(e).join(" / ") : "Preset troops"}</p>`).join("")}<small>Seed: ${e(item.seed)}</small></details></article>`).join("")}</div>${button("clear-history", "Clear local history", "secondary danger")}` : '<div class="history-empty">No battles yet. Your first legend is waiting.</div>'}`;
}
function settingsContent() {
  return `<p class="eyebrow">THE ENGINE BEHIND THE IDEAS</p><h2>Choose your forge.</h2><div class="connection-card"><span class="status-dot ${state.aiAvailable ? "online" : ""}"></span><div><b>${state.aiAvailable ? "OpenAI server key is configured" : "Running without an OpenAI API key"}</b><p>${state.apiOnline ? "Local game server is connected." : "Server unavailable. Offline generation still works in the browser."}</p></div></div><label class="setting-option"><input type="radio" name="mode" value="auto" ${state.mode === "auto" ? "checked" : ""}><span><b>ChatGPT when available</b><small>Use the OpenAI API if the server has a key. Otherwise use the offline builder.</small></span></label><label class="setting-option"><input type="radio" name="mode" value="offline" ${state.mode === "offline" ? "checked" : ""}><span><b>Always offline</b><small>Fast keyword generation. No network calls to OpenAI.</small></span></label><div class="setup-instructions"><h3>Connect ChatGPT generation</h3><ol><li>Copy <code>.env.example</code> to <code>.env</code> in the project folder.</li><li>Set <code>OPENAI_API_KEY</code> and optionally <code>OPENAI_MODEL</code>.</li><li>Restart <code>npm run dev</code>, then refresh this page.</li></ol><p>The key stays on your local server. Live generation sends the army description to OpenAI. See <code>docs/AI_INTEGRATION.md</code> for the full setup and data flow.</p></div>`;
}
function modal() {
  if (!state.modal) return "";
  const content =
    state.modal === "guide"
      ? guideContent()
      : state.modal === "history"
        ? historyContent()
        : state.modal === "settings"
          ? settingsContent()
          : `<p class="eyebrow">RETURN TO BASE?</p><h2>Leave this ${state.screen === "battle" ? "battle" : "draft"}?</h2><p class="guide-copy">Your current match will end without saving a result.</p><div class="hero-actions">${button("confirm-leave", "Return to menu", "primary")}${button("close-modal", "Keep playing", "secondary")}</div>`;
  return `<div class="modal-backdrop" data-backdrop="true"><section class="modal panel ${state.modal === "leave" ? "small-modal" : ""}" role="dialog" aria-modal="true" aria-label="${e(state.modal)}" tabindex="-1">${button("close-modal", icon("close", 23), "modal-close icon-btn", 'aria-label="Close dialog"')}${content}</section></div>`;
}
function render() {
  app.innerHTML =
    (state.screen === "menu"
      ? menu()
      : state.screen === "draft"
        ? draft()
        : state.screen === "handoff"
          ? handoff()
          : state.screen === "battle"
            ? battle()
            : results()) + modal();
  document.body.dataset.screen = state.screen;
  if (state.modal) document.querySelector(".modal")?.focus();
  if (state.screen === "battle") updateBattleUI();
}
function showcase() {
  const armies = [
    offlineArmy("Three armored knights, two nature mages, four robot archers")
      .groups,
    offlineArmy("A stone titan, four tiny skeletons, two fire wizards").groups,
  ];
  const preview = new Simulation(armies, state.seed, state.map);
  world.setMap(preview.map);
  world.setUnits(preview.units);
  world.setActive(false);
  world.overview();
  world.controls.target.set(-9, 0, 0);
  world.camera.position.set(40, 36, 49);
}
function previewArmy() {
  const army = currentTeam().army.length
    ? currentTeam().army
    : [{ role: "striker", count: 1, name: "Your first idea" }];
  const preview = new Simulation(
    [army, [{ role: "striker", count: 1 }]],
    state.seed,
    state.map,
  );
  const visible = currentTeam().army.length
    ? preview.units.filter((u) => u.team === 0)
    : [];
  visible.forEach((u, i) => {
    u.team = state.player;
    u.x = 1 + Math.floor(i / 5) * 2.4;
    u.z = ((i % 5) - 2) * 2.5;
    u.facing = Math.PI * 0.3;
  });
  world.setMap(preview.map);
  world.setUnits(visible);
  world.setActive(false);
  world.controls.autoRotate = false;
  world.camera.position.set(28, 22, 31);
  world.controls.target.set(-6, 0, 0);
}
function startDraft() {
  state.teams = freshTeams();
  state.player = 0;
  state.seconds = DRAFT_SECONDS;
  state.prompt = "";
  state.busy = false;
  state.screen = "draft";
  state.modal = null;
  simulation = null;
  previewArmy();
  render();
  document.querySelector("#army-prompt")?.focus();
}
function lockArmy() {
  if (state.busy || !currentTeam().army.length) return;
  currentTeam().army = normalizeArmy(currentTeam().army).groups;
  state.prompt = "";
  sound(440);
  if (state.player === 0) {
    state.screen = "handoff";
    state.player = 1;
    // Clear all first-player meshes before the next commander sees the device.
    world.setUnits([]);
    render();
  } else startBattle();
}
async function generate() {
  if (state.busy) return;
  const prompt = state.prompt.trim();
  if (prompt.length < 3)
    return toast("Describe your force in at least three characters.");
  state.busy = true;
  render();
  try {
    let result;
    if (state.mode === "offline" || !state.apiOnline)
      result = offlineArmy(prompt);
    else {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: state.mode }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      result = data;
    }
    const validated = normalizeArmy(result.groups);
    currentTeam().army = validated.groups;
    currentTeam().prompts.push(prompt);
    currentTeam().source = result.source;
    currentTeam().message = [result.summary, ...(result.notes || [])].join(" ");
    sound(540);
    previewArmy();
  } catch (error) {
    currentTeam().message = `${error.name === "TimeoutError" ? "Generation timed out." : error.message} Your existing army is kept. You can switch to offline mode in settings.`;
    toast(
      "Could not forge this army. See the message below the generate button.",
    );
  } finally {
    state.busy = false;
    render();
  }
}
function addPreset(role) {
  if (state.busy || !Object.hasOwn(ROLES, role)) return;
  const t = currentTeam();
  if (
    armyCost(t.army) + ROLES[role].cost > POWER_CAP ||
    armyCount(t.army) >= 32
  )
    return toast("Power cap reached. Remove a troop to make room.");
  const existing = t.army.find(
    (g) => g.role === role && g.description === "Ready-made reinforcement.",
  );
  if (existing) existing.count++;
  else
    t.army.push({
      role,
      name: ROLES[role].name,
      count: 1,
      element:
        role === "mage" ? "arcane" : role === "healer" ? "nature" : "physical",
      form: role === "beast" ? "beast" : role === "titan" ? "golem" : "soldier",
      description: "Ready-made reinforcement.",
    });
  t.message = `${ROLES[role].name} added. ${POWER_CAP - armyCost(t.army)} power remaining.`;
  sound(330);
  previewArmy();
  render();
}
function startBattle() {
  state.screen = "battle";
  state.modal = null;
  state.paused = false;
  state.speed = 1;
  state.selected = null;
  state.seed = newSeed();
  accumulator = 0;
  countdown = 3;
  simulation = new Simulation(
    state.teams.map((t) => t.army),
    state.seed,
    state.map,
  );
  world.setMap(simulation.map);
  world.setUnits(simulation.units);
  world.setActive(true);
  world.overview();
  render();
}
function finishBattle() {
  state.screen = "results";
  state.selected = null;
  world.setActive(false);
  world.controls.autoRotate = false;
  sound(660, 0.3);
  const saved = saveMatch({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    teams: structuredClone(state.teams),
    winner: simulation.result.winner,
    time: simulation.time,
    seed: state.seed,
    map: state.map,
    survivors: simulation.result.survivors,
  });
  if (!saved)
    toast(
      "This browser could not save match history. The result is still available here.",
    );
  render();
}
function selectUnit(id) {
  if (state.screen !== "battle") return;
  state.selected = id;
  world.select(id);
  updateInspector();
}
function updateInspector() {
  const inspector = document.querySelector("#unit-inspector");
  if (!inspector) return;
  const unit = simulation?.units.find((u) => u.id === state.selected);
  const view = unit
    ? [unit.id, unit.alive, world.followId === unit.id].join(":")
    : "none";
  // Keep the follow button stable between HUD updates so keyboard focus survives.
  if (inspector.dataset.view === view) {
    if (unit) {
      inspector.querySelector(".inspector-hp > span").textContent =
        `${Math.ceil(unit.hp)} / ${unit.maxHp} HP`;
      inspector.querySelector(".inspector-hp .power-track > span").style.width =
        `${Math.max(0, unit.hp / unit.maxHp) * 100}%`;
      inspector.querySelector(".unit-stats > span:last-child b").textContent =
        unit.kills;
    }
    return;
  }
  inspector.dataset.view = view;
  if (!unit) {
    inspector.innerHTML = `<p class="eyebrow">EYES ON THE FIELD</p><h3>Meet your legends.</h3><p>Click a unit to inspect its health and abilities, then press <kbd>F</kbd> to follow.</p>`;
    return;
  }
  inspector.innerHTML = `<p class="eyebrow ${unit.team === 0 ? "mint" : "coral"}">COMMANDER 0${unit.team + 1} / ${unit.alive ? (world.followId === unit.id ? "FOLLOWING" : "ACTIVE") : "DEFEATED"}</p><h3>${e(unit.name)}</h3><span class="inspector-role">${ROLES[unit.role].icon} ${ROLES[unit.role].name} · ${e(unit.element)}</span><div class="inspector-hp"><span>${Math.ceil(unit.hp)} / ${unit.maxHp} HP</span><div class="power-track"><span style="width:${Math.max(0, unit.hp / unit.maxHp) * 100}%"></span></div></div><div class="unit-stats"><span><b>${unit.damage}</b>damage</span><span><b>${unit.range}m</b>range</span><span><b>${unit.kills}</b>kills</span></div><p>${e(ROLES[unit.role].ability)}</p>${button("follow", `${icon("camera", 15)} ${world.followId === unit.id ? "Release camera" : "Follow this unit"}`, "secondary", unit.alive ? "" : "disabled")}`;
}
function updateBattleUI() {
  if (!simulation) return;
  for (const i of [0, 1]) {
    const units = simulation.units.filter((u) => u.team === i),
      living = units.filter((u) => u.alive);
    const element = document.querySelector(`#team-${i}-count`);
    if (element)
      element.textContent = `${living.length} / ${units.length} units standing`;
    const bar = document.querySelector(`#team-${i}-bar`);
    if (bar)
      bar.style.width = `${(living.reduce((s, u) => s + u.hp, 0) / units.reduce((s, u) => s + u.maxHp, 0)) * 100}%`;
  }
  const timer = document.querySelector("#battle-clock");
  if (timer) timer.textContent = clock(Math.floor(simulation.time));
  const status = document.querySelector("#battle-state");
  if (status)
    status.textContent =
      state.paused || state.modal
        ? "BATTLE PAUSED"
        : simulation.suddenDeath
          ? "SUDDEN DEATH · HEALING DISABLED"
          : "BATTLE IN PROGRESS";
  const count = document.querySelector("#countdown");
  if (count)
    count.innerHTML =
      countdown > 0
        ? `<span>PREPARE FOR THE IMPOSSIBLE</span><b>${Math.ceil(countdown)}</b>`
        : "";
  updateInspector();
}
function feed(event) {
  const element = document.querySelector("#battle-feed");
  if (!element) return;
  if (event.type !== "death" && event.type !== "sudden-death") return;
  const p = document.createElement("p");
  p.className =
    event.type === "death"
      ? `feed-entry team-${event.team}`
      : "feed-entry warning";
  p.innerHTML = `<small>${clock(Math.floor(simulation.time))}</small> ${event.type === "death" ? `<b>${e(event.name)}</b> defeated` : "Arena collapse! Healing disabled."}`;
  element.prepend(p);
  while (element.children.length > 6) element.lastElementChild.remove();
}
function goHome() {
  state.screen = "menu";
  state.modal = null;
  state.busy = false;
  simulation = null;
  state.selected = null;
  state.seed = newSeed();
  showcase();
  render();
}
function tryNew() {
  if (state.busy) return toast("Wait for army generation to finish.");
  if (
    state.screen === "draft" ||
    state.screen === "battle" ||
    state.screen === "handoff"
  ) {
    state.modal = "leave";
    render();
  } else startDraft();
}

app.addEventListener("click", (event) => {
  if (event.target.dataset.backdrop && state.modal) {
    state.modal = null;
    render();
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const { action, value } = target.dataset;
  switch (action) {
    case "home":
      if (["draft", "battle", "handoff"].includes(state.screen)) {
        if (state.busy) return toast("Wait for generation to finish.");
        state.modal = "leave";
        render();
      } else goHome();
      break;
    case "new":
      tryNew();
      break;
    case "demo":
      state.teams = freshTeams();
      state.teams[0].prompts = [SUGGESTIONS[1]];
      state.teams[1].prompts = [SUGGESTIONS[0]];
      state.teams.forEach((t) => {
        t.army = offlineArmy(t.prompts[0]).groups;
        t.source = "offline";
      });
      startBattle();
      break;
    case "map":
      state.map = value;
      state.seed = newSeed();
      showcase();
      render();
      break;
    case "guide":
    case "history":
    case "settings":
      if (state.busy) return toast("Wait for generation to finish.");
      state.modal = action;
      render();
      break;
    case "close-modal":
      state.modal = null;
      render();
      break;
    case "sound":
      state.sound = !state.sound;
      sound(440);
      render();
      break;
    case "ready":
      state.screen = "draft";
      state.seconds = DRAFT_SECONDS;
      previewArmy();
      render();
      document.querySelector("#army-prompt")?.focus();
      break;
    case "suggest":
      state.prompt =
        SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
      render();
      document.querySelector("#army-prompt")?.focus();
      break;
    case "generate":
      generate();
      break;
    case "preset":
      addPreset(value);
      break;
    case "remove": {
      const t = currentTeam(),
        index = Number(target.dataset.index);
      if (state.busy || !t.army[index]) break;
      if (--t.army[index].count <= 0) t.army.splice(index, 1);
      previewArmy();
      render();
      break;
    }
    case "lock":
      lockArmy();
      break;
    case "pause":
      state.paused = !state.paused;
      target.innerHTML = icon(state.paused ? "play" : "pause");
      target.setAttribute(
        "aria-label",
        state.paused ? "Resume battle" : "Pause battle",
      );
      updateBattleUI();
      break;
    case "speed":
      state.speed = Number(value);
      document
        .querySelectorAll(".speed-btn")
        .forEach((b) =>
          b.classList.toggle(
            "selected",
            Number(b.dataset.value) === state.speed,
          ),
        );
      break;
    case "overview":
      world.overview();
      break;
    case "next": {
      const living = simulation.living();
      if (!living.length) break;
      const index = living.findIndex((u) => u.id === state.selected);
      selectUnit(living[(index + 1) % living.length].id);
      if (world.followId) world.follow(state.selected);
      break;
    }
    case "follow":
      if (!state.selected) selectUnit(simulation.living()[0]?.id);
      if (world.followId && world.followId === state.selected)
        world.follow(null);
      else if (simulation.units.find((u) => u.id === state.selected)?.alive)
        world.follow(state.selected);
      updateInspector();
      break;
    case "leave":
      state.modal = "leave";
      render();
      break;
    case "confirm-leave":
      goHome();
      break;
    case "rematch":
      startBattle();
      break;
    case "clear-history":
      if (clearHistory()) {
        render();
        toast("Local match history cleared.");
      } else toast("Could not clear history in this browser.");
      break;
  }
});
app.addEventListener("input", (event) => {
  if (event.target.id === "army-prompt") {
    state.prompt = event.target.value;
    const count = document.querySelector("#prompt-count");
    if (count) count.textContent = `${state.prompt.length}/1600`;
  }
  if (event.target.id === "team-name") {
    currentTeam().name =
      event.target.value.trim() || `Commander ${state.player + 1}`;
    const title = document.querySelector(".draft-aside h3");
    if (title) title.textContent = currentTeam().name;
  }
});
app.addEventListener("change", (event) => {
  if (event.target.id === "timer-toggle") {
    state.timerEnabled = event.target.checked;
    if (state.timerEnabled && state.seconds <= 0) state.seconds = DRAFT_SECONDS;
  }
  if (event.target.name === "mode") {
    state.mode = event.target.value;
    render();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.modal) {
      state.modal = null;
      render();
    } else {
      world?.follow(null);
      selectUnit(null);
    }
    return;
  }
  if (state.modal) {
    if (event.key === "Tab") {
      const nodes = [
        ...document.querySelectorAll(
          ".modal button, .modal input, .modal summary, .modal [href]",
        ),
      ].filter((el) => !el.disabled);
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement.classList.contains("modal"))
      ) {
        last?.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first?.focus();
        event.preventDefault();
      }
    }
    return;
  }
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      state.screen === "draft"
    )
      generate();
    return;
  }
  if (state.screen !== "battle") return;
  const actions = {
    Space: "pause",
    KeyF: "follow",
    Tab: "next",
    KeyO: "overview",
  };
  if (actions[event.code]) {
    event.preventDefault();
    app.querySelector(`[data-action="${actions[event.code]}"]`)?.click();
  }
});
document.addEventListener("visibilitychange", () => {
  lastFrame = performance.now();
  accumulator = 0;
});

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.08);
  lastFrame = now;
  if (!document.hidden) {
    if (
      state.screen === "draft" &&
      state.timerEnabled &&
      !state.busy &&
      !state.modal
    ) {
      state.seconds -= dt;
      const clockEl = document.querySelector("#draft-clock");
      if (clockEl) {
        clockEl.textContent = clock(state.seconds);
        clockEl.classList.toggle("urgent", state.seconds < 20);
      }
      if (state.seconds <= 0) {
        if (!currentTeam().army.length) {
          currentTeam().army = offlineArmy(
            "Six knights, three archers, one healer",
          ).groups;
          currentTeam().source = "offline";
          currentTeam().prompts.push(
            "[Timer expired: default balanced army assigned]",
          );
        }
        toast(`Commander ${state.player + 1}: draft time is up. Army locked.`);
        lockArmy();
      }
    }
    if (state.screen === "battle" && !state.paused && !state.modal) {
      if (countdown > 0) countdown = Math.max(0, countdown - dt);
      else {
        accumulator += dt * state.speed;
        while (accumulator >= FIXED_DT && !simulation.result) {
          simulation.step();
          simulation.events.forEach((event) => {
            world.event(event);
            feed(event);
          });
          accumulator -= FIXED_DT;
        }
        if (simulation.result) finishBattle();
      }
    }
    uiElapsed += dt;
    if (uiElapsed > 0.15 && state.screen === "battle") {
      uiElapsed = 0;
      updateBattleUI();
    }
    world?.update(
      dt,
      now / 1000,
      state.screen === "battle" &&
        Boolean(state.paused || state.modal || countdown > 0),
    );
  }
  requestAnimationFrame(frame);
}

try {
  world = new Battlefield(document.querySelector("#battlefield"), selectUnit);
  showcase();
  render();
  requestAnimationFrame(frame);
  fetch("/api/status", { signal: AbortSignal.timeout(4000) })
    .then((response) => response.json())
    .then((data) => {
      state.aiAvailable = Boolean(data.aiAvailable);
      state.apiOnline = true;
      if (state.screen === "menu") render();
    })
    .catch(() => {
      state.apiOnline = false;
    });
} catch (error) {
  console.error(error);
  app.innerHTML = `<main class="center-screen"><section class="panel fallback"><h1>The arena needs WebGL.</h1><p>Your browser could not initialize 3D graphics. Enable hardware acceleration and use a current desktop browser.</p><p>${e(error.message)}</p><button onclick="location.reload()" class="primary">Try again</button></section></main>`;
}
