import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { Simulation, FIXED_DT } from "../src/game/simulation.js";
import * as catalog from "../src/game/catalog.js";
import { offlineArmy } from "../src/game/offline.js";
import { escape, clock, icon } from "../src/ui/html.js";

/** Execute the actual UI coordinator with a DOM and a stub graphics adapter.
 * This checks application behavior, not WebGL rendering or browser layout.
 */
async function harness(t) {
  const dom = new JSDOM(
    '<div id="battlefield"></div><div id="app"></div><div id="toast"></div>',
    {
      url: "http://127.0.0.1:3000",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  t.after(() => dom.window.close());
  const { window } = dom;
  const errors = [];
  window.console.error = (...args) => errors.push(args.join(" "));
  let nextFrame,
    now = window.performance.now(),
    graphics;
  const position = () => ({ set() {} });
  class FakeBattlefield {
    constructor(container, onSelect) {
      this.onSelect = onSelect;
      this.controls = { target: position() };
      this.camera = { position: position() };
      this.followId = null;
      graphics = this;
    }
    setMap(map) {
      this.map = map;
    }
    setUnits(units) {
      this.units = units;
      this.followId = null;
    }
    setActive() {}
    overview() {
      this.followId = null;
    }
    select(id) {
      this.selectedId = id;
    }
    follow(id) {
      this.followId = id;
    }
    event() {}
    update() {}
  }
  window.requestAnimationFrame = (callback) => {
    nextFrame = callback;
  };
  window.fetch = async (url, options) => {
    if (url === "/api/status")
      return { json: async () => ({ aiAvailable: false }) };
    if (url === "/api/generate")
      return {
        ok: true,
        json: async () => offlineArmy(JSON.parse(options.body).prompt),
      };
    throw new Error("Unexpected endpoint in UI test.");
  };
  Object.assign(window, {
    Battlefield: FakeBattlefield,
    Simulation,
    FIXED_DT,
    ...catalog,
    offlineArmy,
    e: escape,
    clock,
    icon,
    structuredClone,
  });
  const context = dom.getInternalVMContext();
  vm.runInContext(
    (
      await fs.readFile(
        new URL("../src/ui/storage.js", import.meta.url),
        "utf8",
      )
    ).replace(/^export /gm, ""),
    context,
  );
  const source = (
    await fs.readFile(new URL("../src/main.js", import.meta.url), "utf8")
  ).replace(/^import[\s\S]*?;\r?\n/gm, "");
  vm.runInContext(source, context);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  function click(action, extra = "") {
    const element = window.document.querySelector(
      '[data-action="' + action + '"]' + extra,
    );
    assert.ok(element, "Expected action: " + action + extra);
    assert.ok(!element.disabled, action + " must be enabled");
    element.click();
  }
  function input(selector, value) {
    const element = window.document.querySelector(selector);
    assert.ok(element);
    element.value = value;
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  }
  async function forge(prompt) {
    input("#army-prompt", prompt);
    click("generate");
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }
  function advance(seconds) {
    const frames = Math.ceil(seconds / 0.05);
    for (let i = 0; i < frames; i++) {
      now += 50;
      nextFrame(now);
    }
  }
  return {
    window,
    click,
    input,
    forge,
    advance,
    errors,
    get graphics() {
      return graphics;
    },
    text: () => window.document.querySelector("#app").textContent,
    screen: () => window.document.body.dataset.screen,
  };
}

test("full private draft -> battle -> result -> history -> rematch loop", async (t) => {
  const h = await harness(t);
  assert.equal(h.screen(), "menu");
  assert.match(h.text(), /Dream it/);
  h.click("new");
  assert.equal(h.screen(), "draft");
  assert.equal(
    h.window.document.querySelector('[data-action="lock"]').disabled,
    true,
  );
  h.input("#team-name", "Hidden FIRST Commander");
  await h.forge("Two stone titans, four knights");
  assert.equal(h.graphics.units.length, 6);
  h.click("lock");
  assert.equal(h.screen(), "handoff");
  assert.equal(
    h.graphics.units.length,
    0,
    "first army is removed from scene before handoff",
  );
  assert.ok(!h.text().includes("Hidden FIRST Commander"));
  h.click("ready");
  assert.equal(h.screen(), "draft");
  assert.ok(
    !h.text().includes("Hidden FIRST Commander"),
    "second player cannot see first roster/name",
  );
  await h.forge("One tiny skeleton");
  h.click("lock");
  assert.equal(h.screen(), "battle");
  h.click("speed", '[data-value="4"]');
  h.advance(35);
  assert.equal(h.screen(), "results");
  assert.match(h.text(), /Victory/);
  assert.match(h.text(), /Hidden FIRST Commander/);
  assert.match(h.text(), /One tiny skeleton/);
  const history = JSON.parse(
    h.window.localStorage.getItem("battlegrounds.history.v1"),
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].teams[0].name, "Hidden FIRST Commander");
  h.click("history");
  assert.match(h.text(), /Every clash/);
  assert.match(h.text(), /Hidden FIRST Commander/);
  h.click("close-modal");
  h.click("rematch");
  assert.equal(h.screen(), "battle");
  assert.equal(h.errors.length, 0);
});

test("draft presets enforce cap; modal pauses timer; unsupported text is escaped", async (t) => {
  const h = await harness(t);
  h.click("new");
  h.click("preset", '[data-value="titan"]');
  h.click("preset", '[data-value="titan"]');
  h.click("preset", '[data-value="titan"]');
  assert.equal(
    h.window.document.querySelector(
      '[data-action="preset"][data-value="titan"]',
    ).disabled,
    true,
  );
  const original = h.window.document.querySelector("#draft-clock").textContent;
  h.click("guide");
  h.advance(10);
  h.click("close-modal");
  assert.equal(
    h.window.document.querySelector("#draft-clock").textContent,
    original,
  );
  await h.forge("One knight called <img src=x onerror=alert(1)>");
  assert.equal(h.window.document.querySelector(".roster-list img"), null);
  assert.ok(h.text().includes("<img"));
  h.advance(125);
  assert.equal(h.screen(), "handoff");
  h.click("ready");
  h.advance(125);
  assert.equal(h.screen(), "battle", "empty expired draft gets default army");
  assert.equal(h.errors.length, 0);
});

test("battle pause, selection, follow, shortcuts, and exit confirmation", async (t) => {
  const h = await harness(t);
  h.click("demo");
  h.advance(4);
  h.click("pause");
  const pausedClock =
    h.window.document.querySelector("#battle-clock").textContent;
  h.advance(5);
  assert.equal(
    h.window.document.querySelector("#battle-clock").textContent,
    pausedClock,
  );
  h.click("next");
  assert.ok(h.graphics.selectedId);
  const followControl = h.window.document.querySelector(
    "#unit-inspector button",
  );
  followControl.focus();
  h.advance(0.5);
  assert.equal(
    h.window.document.activeElement,
    followControl,
    "HUD refresh preserves keyboard focus",
  );
  h.click("follow");
  assert.equal(h.graphics.followId, h.graphics.selectedId);
  h.window.document.dispatchEvent(
    new h.window.KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  assert.equal(h.graphics.followId, null);
  h.click("leave");
  assert.match(h.text(), /Leave this battle/);
  h.click("close-modal");
  assert.equal(h.screen(), "battle");
  h.click("leave");
  h.click("confirm-leave");
  assert.equal(h.screen(), "menu");
  assert.equal(
    h.window.localStorage.getItem("battlegrounds.history.v1"),
    null,
    "aborted match is not saved",
  );
  assert.equal(h.errors.length, 0);
});

test("corrupt local history cannot prevent the menu or history dialog from opening", async (t) => {
  const h = await harness(t);
  h.window.localStorage.setItem("battlegrounds.history.v1", "{broken");
  h.click("history");
  assert.match(h.text(), /No battles yet/);
  assert.equal(h.errors.length, 0);
});

test("provider failure preserves the existing army and exposes an explicit offline alternative", async (t) => {
  const h = await harness(t);
  h.click("new");
  h.click("preset", '[data-value="guardian"]');
  h.window.fetch = async () => ({
    ok: false,
    json: async () => ({ error: "Provider is unavailable." }),
  });
  await h.forge("Five robot archers");
  assert.equal(h.graphics.units.length, 1);
  assert.match(h.text(), /Provider is unavailable/);
  assert.match(h.text(), /existing army is kept/);
  assert.equal(
    h.window.document.querySelector('[data-action="lock"]').disabled,
    false,
  );
});
